//! Core WebSocket Server (Puerto 47821, solo localhost — Regla #55-56).
//! Dos rutas:
//!   /bridge  — recibe eventos del TikTok Bridge
//!   /overlay/<id> — sirve actualizaciones a los overlays de OBS
//!
//! Regla #55: solo acepta conexiones de 127.0.0.1.
//! Regla #56: nunca expuesto a internet.
//! Regla #23: el Event Bus distribuye; este servidor solo recibe y reenvía.

use crate::clock::{Clock, ProductionClock};
use crate::contracts::AppEvent;
use crate::event_bus::EventBus;
use crate::logging::{ErrorCode, LogEntry, LogLevel, Logger};
use crate::overlays::OverlayEngine;
use futures_util::{SinkExt, StreamExt};
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::{Arc, Mutex};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::broadcast;
use tokio_tungstenite::{accept_async, tungstenite::Message};

pub const WS_PORT: u16 = 47821;
pub const WS_HOST: &str = "127.0.0.1";

/// Canal broadcast para distribuir mensajes de overlay a todos los clientes
/// conectados de esa ruta (Regla #23: el bus distribuye, no el servidor).
type OverlayBroadcast = broadcast::Sender<String>;

pub struct WsServer {
    event_bus:     Arc<EventBus>,
    overlay_engine:Arc<OverlayEngine>,
    logger:        Arc<dyn Logger>,
    /// Un canal broadcast por overlay_id (timer, donors, tappers, etc.)
    channels:      Arc<Mutex<HashMap<String, OverlayBroadcast>>>,
}

impl WsServer {
    pub fn new(
        event_bus: Arc<EventBus>,
        overlay_engine: Arc<OverlayEngine>,
        logger: Arc<dyn Logger>,
    ) -> Self {
        Self {
            event_bus,
            overlay_engine,
            logger,
            channels: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Arranca el servidor. Debe correrse dentro de un runtime tokio.
    pub async fn run(self: Arc<Self>) {
        let addr = format!("{WS_HOST}:{WS_PORT}");
        let listener = match TcpListener::bind(&addr).await {
            Ok(l) => l,
            Err(e) => {
                self.logger.log(
                    LogEntry::new(
                        &ProductionClock,
                        LogLevel::Error,
                        "ws_server",
                        format!("no se pudo bindear {addr}: {e}"),
                    )
                    .with_code(ErrorCode::Bridge001),
                );
                return;
            }
        };

        self.logger.log(LogEntry::new(
            &ProductionClock,
            LogLevel::Info,
            "ws_server",
            format!("WebSocket server escuchando en ws://{addr}"),
        ));

        loop {
            match listener.accept().await {
                Ok((stream, peer_addr)) => {
                    // Regla #55: rechazar conexiones que no sean de localhost
                    if !is_localhost(&peer_addr) {
                        self.logger.log(LogEntry::new(
                            &ProductionClock,
                            LogLevel::Warn,
                            "ws_server",
                            format!("conexión rechazada desde {peer_addr} (solo localhost)"),
                        ));
                        continue;
                    }
                    let server = self.clone();
                    tokio::spawn(async move {
                        server.handle_connection(stream, peer_addr).await;
                    });
                }
                Err(e) => {
                    self.logger.log(LogEntry::new(
                        &ProductionClock,
                        LogLevel::Error,
                        "ws_server",
                        format!("error aceptando conexión: {e}"),
                    ));
                }
            }
        }
    }

    /// Envía un mensaje de overlay a todos los clientes suscritos a ese overlay_id.
    pub fn broadcast_overlay(&self, overlay_id: &str, message: String) {
        let channels = self.channels.lock().expect("lock envenenado");
        if let Some(tx) = channels.get(overlay_id) {
            let _ = tx.send(message);
        }
    }

    async fn handle_connection(self: Arc<Self>, stream: TcpStream, peer_addr: SocketAddr) {
        let ws_stream = match accept_async(stream).await {
            Ok(ws) => ws,
            Err(e) => {
                self.logger.log(LogEntry::new(
                    &ProductionClock,
                    LogLevel::Warn,
                    "ws_server",
                    format!("error en handshake WS desde {peer_addr}: {e}"),
                ));
                return;
            }
        };

        // Determinar la ruta de la conexión a partir del URI del handshake.
        // tokio-tungstenite no expone el URI directamente después del accept,
        // así que lo obtenemos del primer mensaje de texto que el cliente
        // envía identificándose (protocolo interno ReactStream).
        let (mut write, mut read) = ws_stream.split();

        // Esperar mensaje de identificación del cliente
        let ident = match read.next().await {
            Some(Ok(Message::Text(txt))) => txt.to_string(),
            _ => return,
        };

        let parsed: serde_json::Value = match serde_json::from_str(&ident) {
            Ok(v) => v,
            Err(_) => return,
        };

        let client_type = parsed["clientType"].as_str().unwrap_or("unknown");
        let overlay_id  = parsed["overlayId"].as_str().unwrap_or("").to_string();

        match client_type {
            "bridge" => {
                self.logger.log(LogEntry::new(
                    &ProductionClock,
                    LogLevel::Info,
                    "ws_server",
                    "Bridge TikTok conectado",
                ));
                self.handle_bridge(read).await;
            }
            "overlay" => {
                self.logger.log(LogEntry::new(
                    &ProductionClock,
                    LogLevel::Info,
                    "ws_server",
                    format!("overlay '{overlay_id}' conectado desde OBS"),
                ));
                // Registrar canal broadcast para este overlay
                let rx = {
                    let mut channels = self.channels.lock().expect("lock envenenado");
                    let tx = channels
                        .entry(overlay_id.clone())
                        .or_insert_with(|| broadcast::channel(64).0);
                    tx.subscribe()
                };
                // Enviar resync inmediato
                let session_id = "live_current".to_string();
                let resync_msgs = self.overlay_engine.resync_messages(&session_id);
                for msg in resync_msgs {
                    if let Ok(json) = serde_json::to_string(&msg) {
                        let _ = write.send(Message::Text(json.into())).await;
                    }
                }
                self.handle_overlay(write, read, rx).await;
            }
            _ => {
                self.logger.log(LogEntry::new(
                    &ProductionClock,
                    LogLevel::Warn,
                    "ws_server",
                    format!("cliente desconocido: {client_type}"),
                ));
            }
        }
    }

    /// Maneja mensajes entrantes del Bridge — los publica en el Event Bus.
    async fn handle_bridge(
        &self,
        mut read: impl StreamExt<Item = Result<Message, tokio_tungstenite::tungstenite::Error>> + Unpin,
    ) {
        while let Some(msg) = read.next().await {
            let Ok(Message::Text(text)) = msg else { continue };
            let Ok(value) = serde_json::from_str::<serde_json::Value>(&text) else {
                continue;
            };

            // Mensaje especial: sincronización del catálogo de regalos
            if value["type"] == "gift_catalog_sync" {
                self.logger.log(LogEntry::new(
                    &ProductionClock,
                    LogLevel::Info,
                    "ws_server",
                    format!(
                        "catálogo de regalos recibido: {} items",
                        value["gifts"].as_array().map(|a| a.len()).unwrap_or(0)
                    ),
                ));
                // TODO(Etapa 38+): persistir en SQLite vía GiftCatalogSyncRepository
                continue;
            }

            // Ping/pong
            if value["messageType"] == "ping" {
                continue;
            }

            // Evento normal — deserializar y publicar en el Event Bus
            if let Some(payload) = value.get("payload") {
                match serde_json::from_value::<AppEvent>(payload.clone()) {
                    Ok(event) => {
                        self.logger.log(LogEntry::new(
                            &ProductionClock,
                            LogLevel::Debug,
                            "ws_server",
                            format!("evento recibido: {:?} id={}", event.event_type(), event.id()),
                        ));
                        let outcome = self.event_bus.publish(event);
                        self.logger.log(LogEntry::new(
                            &ProductionClock,
                            LogLevel::Debug,
                            "ws_server",
                            format!("publicado en Event Bus: {outcome:?}"),
                        ));
                    }
                    Err(e) => {
                        self.logger.log(
                            LogEntry::new(
                                &ProductionClock,
                                LogLevel::Warn,
                                "ws_server",
                                format!("no se pudo deserializar evento: {e}"),
                            )
                        );
                    }
                }
            }
        }

        self.logger.log(LogEntry::new(
            &ProductionClock,
            LogLevel::Info,
            "ws_server",
            "Bridge TikTok desconectado",
        ));
    }

    /// Maneja la conexión de un overlay — reenvía mensajes del canal broadcast.
    async fn handle_overlay(
        &self,
        mut write: impl SinkExt<Message, Error = tokio_tungstenite::tungstenite::Error> + Unpin,
        mut read: impl StreamExt<Item = Result<Message, tokio_tungstenite::tungstenite::Error>> + Unpin,
        mut rx: broadcast::Receiver<String>,
    ) {
        loop {
            tokio::select! {
                // Mensaje del canal broadcast → enviar al overlay
                msg = rx.recv() => {
                    match msg {
                        Ok(text) => {
                            if write.send(Message::Text(text.into())).await.is_err() {
                                break;
                            }
                        }
                        Err(broadcast::error::RecvError::Lagged(_)) => continue,
                        Err(_) => break,
                    }
                }
                // Mensaje entrante del overlay (ping/resync)
                incoming = read.next() => {
                    match incoming {
                        Some(Ok(Message::Text(txt))) => {
                            let val: serde_json::Value = serde_json::from_str(&txt).unwrap_or_default();
                            if val["type"] == "ping" {
                                let pong = serde_json::json!({ "messageType": "pong", "timestamp": crate::clock::ProductionClock.now_ms() });
                                let _ = write.send(Message::Text(pong.to_string().into())).await;
                            }
                        }
                        None | Some(Err(_)) => break,
                        _ => {}
                    }
                }
            }
        }
    }
}

/// Verificar que la conexión viene de localhost (Regla #55).
fn is_localhost(addr: &SocketAddr) -> bool {
    match addr.ip() {
        std::net::IpAddr::V4(ip) => ip.is_loopback(),
        std::net::IpAddr::V6(ip) => ip.is_loopback(),
    }
}
