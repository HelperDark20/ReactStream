//! Overlay Engine (Sección 17). Regla #52-53: los overlays solo visualizan,
//! no contienen lógica de negocio. Regla #54: el overlay reconecta y
//! solicita resync. Regla #55-56: comunicación solo por localhost.
//! Regla #45: máximo 100 eventos overlay pendientes.
//!
//! Nota de alcance (Etapa 14): el engine gestiona el estado de cada overlay,
//! construye los mensajes y los encola. El WebSocket real (tokio-tungstenite)
//! se conecta en la Etapa 26 (Tauri API) cuando el runtime async esté
//! disponible. Aquí se expone la interfaz completa y se prueba la lógica
//! de estado sin depender de red.

use crate::contracts::{
    AppEvent, BestGift, DonorRankingEntry, OverlayMessage, OverlayMessageType, TapRankingEntry,
    TimerState,
};
use crate::logging::{LogEntry, LogLevel, Logger};
use std::collections::{HashMap, VecDeque};
use std::sync::{Arc, RwLock};
use uuid::Uuid;

pub const MAX_OVERLAY_QUEUE: usize = 100;

#[derive(Debug, Clone, PartialEq)]
pub enum OverlayId {
    Timer,
    Donors,
    Tappers,
    BestGift,
    Likes,
    Jar,
}

impl OverlayId {
    pub fn as_str(&self) -> &'static str {
        match self {
            OverlayId::Timer => "timer",
            OverlayId::Donors => "donors",
            OverlayId::Tappers => "tappers",
            OverlayId::BestGift => "best-gift",
            OverlayId::Likes => "likes",
            OverlayId::Jar => "jar",
        }
    }

    pub fn all() -> Vec<OverlayId> {
        vec![
            OverlayId::Timer,
            OverlayId::Donors,
            OverlayId::Tappers,
            OverlayId::BestGift,
            OverlayId::Likes,
            OverlayId::Jar,
        ]
    }
}

fn build_message(
    msg_type: OverlayMessageType,
    overlay_id: Option<&str>,
    session_id: Option<&str>,
    payload: serde_json::Value,
) -> OverlayMessage {
    OverlayMessage {
        protocol_version: 1,
        message_id: Uuid::new_v4().to_string(),
        message_type: msg_type,
        timestamp: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64,
        session_id: session_id.map(|s| s.to_string()),
        overlay_id: overlay_id.map(|s| s.to_string()),
        payload,
    }
}

pub struct OverlayEngine {
    /// Cola de mensajes pendientes de enviar por WebSocket.
    /// Regla #45: máximo 100 pendientes.
    queue: RwLock<VecDeque<OverlayMessage>>,
    /// Estado visible de cada overlay (para resync en reconexión, Regla #54)
    states: RwLock<HashMap<String, serde_json::Value>>,
    logger: Arc<dyn Logger>,
}

impl OverlayEngine {
    pub fn new(logger: Arc<dyn Logger>) -> Self {
        Self {
            queue: RwLock::new(VecDeque::new()),
            states: RwLock::new(HashMap::new()),
            logger,
        }
    }

    pub fn queue_len(&self) -> usize {
        self.queue.read().expect("lock envenenado").len()
    }

    fn enqueue(&self, msg: OverlayMessage) {
        let mut queue = self.queue.write().expect("lock envenenado");
        if queue.len() >= MAX_OVERLAY_QUEUE {
            self.logger.log(LogEntry::new(
                &crate::clock::ProductionClock,
                LogLevel::Warn,
                "overlay_engine",
                "cola de overlays llena (límite 100, Regla #45) — mensaje descartado",
            ));
            return;
        }
        queue.push_back(msg);
    }

    /// Retira el siguiente mensaje de la cola para enviarlo por WebSocket.
    pub fn next_message(&self) -> Option<OverlayMessage> {
        self.queue.write().expect("lock envenenado").pop_front()
    }

    // -------------------------------------------------------
    // Mensajes de sesión
    // -------------------------------------------------------

    pub fn broadcast_session_started(&self, session_id: &str) {
        let msg = build_message(
            OverlayMessageType::SessionStarted,
            None,
            Some(session_id),
            serde_json::json!({ "sessionId": session_id }),
        );
        self.enqueue(msg);
    }

    pub fn broadcast_session_ended(&self, session_id: &str) {
        let msg = build_message(
            OverlayMessageType::SessionEnded,
            None,
            Some(session_id),
            serde_json::json!({ "sessionId": session_id }),
        );
        self.enqueue(msg);
        // Limpiar estados al finalizar la sesión
        self.states.write().expect("lock envenenado").clear();
    }

    // -------------------------------------------------------
    // Timer overlay
    // -------------------------------------------------------

    pub fn push_timer_update(&self, session_id: &str, state: &TimerState) {
        let payload = serde_json::json!({
            "remainingSeconds": state.remaining_seconds,
            "initialSeconds": state.initial_seconds,
            "coinsPerSecond": state.coins_per_second,
            "running": state.running,
        });
        self.states
            .write()
            .expect("lock envenenado")
            .insert(OverlayId::Timer.as_str().to_string(), payload.clone());
        self.enqueue(build_message(
            OverlayMessageType::TimerUpdated,
            Some(OverlayId::Timer.as_str()),
            Some(session_id),
            payload,
        ));
    }

    pub fn push_timer_zero(&self, session_id: &str) {
        self.enqueue(build_message(
            OverlayMessageType::TimerZero,
            Some(OverlayId::Timer.as_str()),
            Some(session_id),
            serde_json::json!({}),
        ));
    }

    // -------------------------------------------------------
    // Rankings overlays
    // -------------------------------------------------------

    pub fn push_donors_update(&self, session_id: &str, donors: &[DonorRankingEntry]) {
        let payload = serde_json::json!({
            "donors": donors.iter().map(|d| serde_json::json!({
                "userId": d.user.id,
                "displayName": d.user.display_name,
                "avatarUrl": d.user.avatar_url,
                "coins": d.coins,
            })).collect::<Vec<_>>()
        });
        self.states
            .write()
            .expect("lock envenenado")
            .insert(OverlayId::Donors.as_str().to_string(), payload.clone());
        self.enqueue(build_message(
            OverlayMessageType::RankingUpdated,
            Some(OverlayId::Donors.as_str()),
            Some(session_id),
            payload,
        ));
    }

    pub fn push_tappers_update(&self, session_id: &str, tappers: &[TapRankingEntry]) {
        let payload = serde_json::json!({
            "tappers": tappers.iter().map(|t| serde_json::json!({
                "userId": t.user.id,
                "displayName": t.user.display_name,
                "avatarUrl": t.user.avatar_url,
                "likes": t.likes,
            })).collect::<Vec<_>>()
        });
        self.states
            .write()
            .expect("lock envenenado")
            .insert(OverlayId::Tappers.as_str().to_string(), payload.clone());
        self.enqueue(build_message(
            OverlayMessageType::RankingUpdated,
            Some(OverlayId::Tappers.as_str()),
            Some(session_id),
            payload,
        ));
    }

    // -------------------------------------------------------
    // Best Gift overlay
    // -------------------------------------------------------

    pub fn push_best_gift_update(&self, session_id: &str, best: &BestGift) {
        let payload = serde_json::json!({
            "giftId": best.gift.id,
            "giftName": best.gift.name,
            "coins": best.coins,
            "imageUrl": best.gift.image_url,
            "senderName": best.sender.display_name,
            "senderAvatarUrl": best.sender.avatar_url,
        });
        self.states
            .write()
            .expect("lock envenenado")
            .insert(OverlayId::BestGift.as_str().to_string(), payload.clone());
        self.enqueue(build_message(
            OverlayMessageType::BestGiftUpdated,
            Some(OverlayId::BestGift.as_str()),
            Some(session_id),
            payload,
        ));
    }

    // -------------------------------------------------------
    // Likes / Tap Tap overlay
    // -------------------------------------------------------

    pub fn push_likes(&self, session_id: &str, event: &AppEvent) {
        if let AppEvent::Like(l) = event {
            let payload = serde_json::json!({
                "userId": l.user.id,
                "displayName": l.user.display_name,
                "avatarUrl": l.user.avatar_url,
                "count": l.count,
            });
            self.enqueue(build_message(
                OverlayMessageType::LikesReceived,
                Some(OverlayId::Likes.as_str()),
                Some(session_id),
                payload,
            ));
        }
    }

    // -------------------------------------------------------
    // Gift Jar overlay
    // -------------------------------------------------------

    pub fn push_gift_jar(&self, session_id: &str, event: &AppEvent) {
        if let AppEvent::Gift(g) = event {
            let payload = serde_json::json!({
                "giftId": g.gift.id,
                "giftName": g.gift.name,
                "coins": g.gift.coins,
                "quantity": g.quantity,
                "totalCoins": g.total_coins,
                "imageUrl": g.gift.image_url,
                "senderName": g.user.display_name,
            });
            self.enqueue(build_message(
                OverlayMessageType::GiftReceived,
                Some(OverlayId::Jar.as_str()),
                Some(session_id),
                payload,
            ));
        }
    }

    // -------------------------------------------------------
    // Show / Hide overlay
    // -------------------------------------------------------

    pub fn show_overlay(&self, session_id: &str, overlay_id: &str) {
        self.enqueue(build_message(
            OverlayMessageType::OverlayShow,
            Some(overlay_id),
            Some(session_id),
            serde_json::json!({}),
        ));
    }

    pub fn hide_overlay(&self, session_id: &str, overlay_id: &str) {
        self.enqueue(build_message(
            OverlayMessageType::OverlayHide,
            Some(overlay_id),
            Some(session_id),
            serde_json::json!({}),
        ));
    }

    // -------------------------------------------------------
    // Resync (Regla #54: overlay reconecta y solicita estado)
    // -------------------------------------------------------

    /// Devuelve todos los mensajes de estado actuales para reenviar al
    /// overlay que se reconectó (Regla #54).
    pub fn resync_messages(&self, session_id: &str) -> Vec<OverlayMessage> {
        let states = self.states.read().expect("lock envenenado");
        states
            .iter()
            .map(|(overlay_id, payload)| {
                build_message(
                    OverlayMessageType::OverlayState,
                    Some(overlay_id),
                    Some(session_id),
                    payload.clone(),
                )
            })
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::contracts::{BestGift, DonorRankingEntry, Gift, TimerState, User};
    use crate::logging::InMemoryLogger;

    fn user(id: &str) -> User {
        User {
            id: id.to_string(),
            username: id.to_string(),
            display_name: id.to_string(),
            avatar_url: None,
        }
    }

    #[test]
    fn session_started_encola_mensaje() {
        let engine = OverlayEngine::new(Arc::new(InMemoryLogger::new()));
        engine.broadcast_session_started("live_1");
        assert_eq!(engine.queue_len(), 1);
        let msg = engine.next_message().unwrap();
        assert!(matches!(msg.message_type, OverlayMessageType::SessionStarted));
    }

    #[test]
    fn push_timer_update_encola_y_guarda_estado() {
        let engine = OverlayEngine::new(Arc::new(InMemoryLogger::new()));
        engine.push_timer_update(
            "live_1",
            &TimerState {
                remaining_seconds: 290,
                initial_seconds: 300,
                coins_per_second: 10,
                running: true,
            },
        );
        assert_eq!(engine.queue_len(), 1);
        let msg = engine.next_message().unwrap();
        assert!(matches!(msg.message_type, OverlayMessageType::TimerUpdated));
        assert_eq!(msg.payload["remainingSeconds"], 290);
    }

    #[test]
    fn push_donors_update_encola_correctamente() {
        let engine = OverlayEngine::new(Arc::new(InMemoryLogger::new()));
        let donors = vec![DonorRankingEntry {
            user: user("alice"),
            coins: 500,
        }];
        engine.push_donors_update("live_1", &donors);
        let msg = engine.next_message().unwrap();
        assert!(matches!(msg.message_type, OverlayMessageType::RankingUpdated));
        assert_eq!(msg.overlay_id, Some("donors".to_string()));
    }

    #[test]
    fn push_best_gift_encola_correctamente() {
        let engine = OverlayEngine::new(Arc::new(InMemoryLogger::new()));
        let best = BestGift {
            gift: Gift {
                id: "6216".to_string(),
                name: "Leon".to_string(),
                coins: 29999,
                image_url: None,
                region: "CO".to_string(),
            },
            sender: user("carlos"),
            coins: 29999,
        };
        engine.push_best_gift_update("live_1", &best);
        let msg = engine.next_message().unwrap();
        assert!(matches!(msg.message_type, OverlayMessageType::BestGiftUpdated));
        assert_eq!(msg.payload["coins"], 29999);
    }

    #[test]
    fn cola_llena_descarta_mensajes_y_genera_warn() {
        let logger = Arc::new(InMemoryLogger::new());
        let engine = OverlayEngine::new(logger.clone());
        for _ in 0..MAX_OVERLAY_QUEUE {
            engine.broadcast_session_started("live_1");
        }
        assert_eq!(engine.queue_len(), MAX_OVERLAY_QUEUE);
        engine.broadcast_session_started("live_1"); // debe descartarse
        assert_eq!(engine.queue_len(), MAX_OVERLAY_QUEUE);
        assert!(!logger.entries().is_empty());
    }

    #[test]
    fn session_ended_limpia_estados_para_resync() {
        let engine = OverlayEngine::new(Arc::new(InMemoryLogger::new()));
        engine.push_timer_update(
            "live_1",
            &TimerState {
                remaining_seconds: 100,
                initial_seconds: 300,
                coins_per_second: 10,
                running: true,
            },
        );
        engine.broadcast_session_ended("live_1");
        let resync = engine.resync_messages("live_1");
        assert!(resync.is_empty());
    }

    #[test]
    fn resync_devuelve_estado_actual_de_todos_los_overlays() {
        let engine = OverlayEngine::new(Arc::new(InMemoryLogger::new()));
        engine.push_timer_update(
            "live_1",
            &TimerState {
                remaining_seconds: 200,
                initial_seconds: 300,
                coins_per_second: 10,
                running: true,
            },
        );
        engine.push_donors_update(
            "live_1",
            &[DonorRankingEntry {
                user: user("alice"),
                coins: 100,
            }],
        );
        let resync = engine.resync_messages("live_1");
        assert_eq!(resync.len(), 2);
        assert!(resync
            .iter()
            .all(|m| matches!(m.message_type, OverlayMessageType::OverlayState)));
    }

    #[test]
    fn show_y_hide_overlay_encolan_mensajes_correctos() {
        let engine = OverlayEngine::new(Arc::new(InMemoryLogger::new()));
        engine.show_overlay("live_1", "jar");
        engine.hide_overlay("live_1", "jar");
        let show = engine.next_message().unwrap();
        let hide = engine.next_message().unwrap();
        assert!(matches!(show.message_type, OverlayMessageType::OverlayShow));
        assert!(matches!(hide.message_type, OverlayMessageType::OverlayHide));
    }
}
