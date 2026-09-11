//! KeyStroke Engine (Sección 12). Regla #37: estrictamente secuencial.
//! Regla #38: una secuencia no puede intercalarse con otra. Regla #39: la
//! prioridad no interrumpe una secuencia activa. Regla #40: las teclas
//! siempre deben liberarse. Regla #44: máximo 500 KeyStrokes pendientes.
//! Regla #48: no puede quedar KeyStroke pendiente después de LIVE_END.
//!
//! Nota de alcance (Etapa 12): el engine gestiona la cola, la prioridad y
//! la validación de seguridad. La ejecución real del input de teclado a
//! nivel del SO se implementa en la Etapa 26 (Tauri API) donde tenemos
//! acceso a las APIs nativas de Windows — aquí se expone `next_request`
//! para que ese capa lo consuma.

use crate::contracts::{KeyStrokeRequest, KeyStrokeStatus};
use crate::logging::{ErrorCode, LogEntry, LogLevel, Logger};
use std::collections::VecDeque;
use std::sync::{Arc, Mutex};

pub const MAX_KEYSTROKE_QUEUE: usize = 500;

/// Teclas que NUNCA pueden enviarse por seguridad (Regla #40 extendida).
/// Previene que una automatización mal configurada deje el sistema inutilizable.
const BLOCKED_KEYS: &[&str] = &[
    "win", "lwin", "rwin",
    "ctrl+alt+del",
    "alt+f4",
];

pub struct KeyStrokeEntry {
    pub request: KeyStrokeRequest,
    pub status: KeyStrokeStatus,
}

pub struct KeyStrokeEngine {
    queue: Mutex<VecDeque<KeyStrokeEntry>>,
    active: Mutex<Option<KeyStrokeRequest>>,
    logger: Arc<dyn Logger>,
}

impl KeyStrokeEngine {
    pub fn new(logger: Arc<dyn Logger>) -> Self {
        Self {
            queue: Mutex::new(VecDeque::new()),
            active: Mutex::new(None),
            logger,
        }
    }

    pub fn queue_len(&self) -> usize {
        self.queue.lock().expect("lock envenenado").len()
    }

    pub fn is_active(&self) -> bool {
        self.active.lock().expect("lock envenenado").is_some()
    }

    /// Encola una petición de KeyStroke. Regla #44: rechaza si ya hay 500
    /// pendientes. Valida que ninguna tecla de la secuencia esté bloqueada.
    pub fn enqueue(&self, request: KeyStrokeRequest) -> Result<(), String> {
        // Validación de seguridad (Regla #40)
        for step in &request.sequence {
            for key in &step.keys {
                let normalized = key.to_lowercase();
                if BLOCKED_KEYS.iter().any(|&blocked| normalized == blocked) {
                    let msg = format!("tecla bloqueada por seguridad: '{key}' (Regla #40)");
                    self.logger.log(LogEntry::new(
                        &crate::clock::ProductionClock,
                        LogLevel::Error,
                        "keystroke",
                        &msg,
                    ).with_code(ErrorCode::Keystroke001));
                    return Err(msg);
                }
            }
        }

        let mut queue = self.queue.lock().expect("lock envenenado");
        if queue.len() >= MAX_KEYSTROKE_QUEUE {
            let msg = "cola de KeyStroke llena (límite 500, Regla #44)".to_string();
            self.logger.log(LogEntry::new(
                &crate::clock::ProductionClock,
                LogLevel::Error,
                "keystroke",
                &msg,
            ).with_code(ErrorCode::Keystroke001));
            return Err(msg);
        }

        // Insertar ordenado por prioridad (menor = más alta)
        let pos = queue
            .iter()
            .position(|e| e.request.priority > request.priority)
            .unwrap_or(queue.len());

        queue.insert(
            pos,
            KeyStrokeEntry {
                request,
                status: KeyStrokeStatus::Queued,
            },
        );
        Ok(())
    }

    /// Devuelve la siguiente petición a ejecutar (Regla #37: secuencial
    /// estricto — solo si no hay una activa). El llamador (Tauri API en
    /// Etapa 26) lo ejecuta y llama `complete` cuando termina.
    pub fn next_request(&self) -> Option<KeyStrokeRequest> {
        let mut active = self.active.lock().expect("lock envenenado");
        if active.is_some() {
            return None; // Regla #38: no intercalar secuencias
        }
        let mut queue = self.queue.lock().expect("lock envenenado");
        if let Some(entry) = queue.pop_front() {
            *active = Some(entry.request.clone());
            Some(entry.request)
        } else {
            None
        }
    }

    /// Marca la secuencia activa como completada y libera el slot.
    pub fn complete(&self, request_id: &str) {
        let mut active = self.active.lock().expect("lock envenenado");
        if let Some(req) = active.as_ref() {
            if req.request_id == request_id {
                *active = None;
            }
        }
    }

    /// Cancela todas las peticiones de una sesión (Regla #48: LIVE_END).
    pub fn cancel_session(&self, session_id: &str) {
        let mut queue = self.queue.lock().expect("lock envenenado");
        queue.retain(|e| e.request.session_id != session_id);
        let mut active = self.active.lock().expect("lock envenenado");
        if let Some(req) = active.as_ref() {
            if req.session_id == session_id {
                *active = None;
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::contracts::KeyStrokeStep;
    use crate::logging::InMemoryLogger;

    fn request(id: &str, session_id: &str, priority: u32, keys: &[&str]) -> KeyStrokeRequest {
        KeyStrokeRequest {
            request_id: id.to_string(),
            execution_id: "exec_1".to_string(),
            automation_id: "auto_1".to_string(),
            event_id: "evt_1".to_string(),
            session_id: session_id.to_string(),
            priority,
            sequence: vec![KeyStrokeStep {
                keys: keys.iter().map(|k| k.to_string()).collect(),
                duration_ms: Some(100),
                interval_ms: None,
            }],
            repeat_count: 1,
            repeat_interval_ms: 0,
        }
    }

    #[test]
    fn encola_y_devuelve_en_orden_de_prioridad() {
        let engine = KeyStrokeEngine::new(Arc::new(InMemoryLogger::new()));
        engine.enqueue(request("req_low", "live_1", 100, &["a"])).unwrap();
        engine.enqueue(request("req_high", "live_1", 1, &["b"])).unwrap();

        let next = engine.next_request().unwrap();
        assert_eq!(next.request_id, "req_high");
    }

    #[test]
    fn secuencia_activa_bloquea_la_siguiente() {
        // Regla #38: no intercalar secuencias
        let engine = KeyStrokeEngine::new(Arc::new(InMemoryLogger::new()));
        engine.enqueue(request("req_1", "live_1", 10, &["a"])).unwrap();
        engine.enqueue(request("req_2", "live_1", 10, &["b"])).unwrap();

        let first = engine.next_request();
        assert!(first.is_some());
        assert!(engine.is_active());

        let second = engine.next_request();
        assert!(second.is_none()); // bloqueado hasta que complete
    }

    #[test]
    fn complete_libera_el_slot_activo() {
        let engine = KeyStrokeEngine::new(Arc::new(InMemoryLogger::new()));
        engine.enqueue(request("req_1", "live_1", 10, &["a"])).unwrap();
        engine.enqueue(request("req_2", "live_1", 10, &["b"])).unwrap();

        let first = engine.next_request().unwrap();
        engine.complete(&first.request_id);
        assert!(!engine.is_active());

        let second = engine.next_request();
        assert!(second.is_some());
    }

    #[test]
    fn rechaza_teclas_bloqueadas_por_seguridad() {
        let engine = KeyStrokeEngine::new(Arc::new(InMemoryLogger::new()));
        let result = engine.enqueue(request("req_1", "live_1", 10, &["win"]));
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("tecla bloqueada"));
    }

    #[test]
    fn rechaza_cuando_la_cola_esta_llena() {
        let engine = KeyStrokeEngine::new(Arc::new(InMemoryLogger::new()));
        for i in 0..MAX_KEYSTROKE_QUEUE {
            engine.enqueue(request(&format!("req_{i}"), "live_1", 10, &["a"])).unwrap();
        }
        let result = engine.enqueue(request("overflow", "live_1", 10, &["a"]));
        assert!(result.is_err());
    }

    #[test]
    fn cancel_session_limpia_cola_y_activo() {
        // Regla #48: no puede quedar KeyStroke pendiente después de LIVE_END
        let engine = KeyStrokeEngine::new(Arc::new(InMemoryLogger::new()));
        engine.enqueue(request("req_1", "live_1", 10, &["a"])).unwrap();
        engine.enqueue(request("req_2", "live_1", 10, &["b"])).unwrap();
        engine.next_request(); // activa req_1

        engine.cancel_session("live_1");

        assert_eq!(engine.queue_len(), 0);
        assert!(!engine.is_active());
    }
}