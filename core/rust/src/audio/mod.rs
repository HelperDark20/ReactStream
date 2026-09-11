//! Audio Engine (Sección 13). Regla #41: independiente de KeyStroke.
//! Regla #42: máximo 5 sonidos simultáneos. Regla #47: LIVE_END cancela
//! sonidos pendientes. Regla #60: no permitir rutas arbitrarias para
//! sonidos (validación de ruta). Regla #63: MP3 no se almacena como BLOB.
//!
//! Nota de alcance (Etapa 13): el engine gestiona la cola, el límite de
//! simultáneos y la validación de seguridad. La reproducción real de audio
//! llega en la Etapa 26 (Tauri API) con acceso a las APIs de Windows.

use crate::contracts::{AudioRequest, AudioStatus};
use crate::logging::{ErrorCode, LogEntry, LogLevel, Logger};
use std::collections::VecDeque;
use std::sync::{Arc, Mutex};

pub const MAX_SIMULTANEOUS_AUDIO: usize = 5;

pub struct AudioEntry {
    pub request: AudioRequest,
    pub status: AudioStatus,
}

pub struct AudioEngine {
    queue: Mutex<VecDeque<AudioEntry>>,
    active: Mutex<Vec<AudioRequest>>,
    logger: Arc<dyn Logger>,
}

impl AudioEngine {
    pub fn new(logger: Arc<dyn Logger>) -> Self {
        Self {
            queue: Mutex::new(VecDeque::new()),
            active: Mutex::new(Vec::new()),
            logger,
        }
    }

    pub fn queue_len(&self) -> usize {
        self.queue.lock().expect("lock envenenado").len()
    }

    pub fn active_count(&self) -> usize {
        self.active.lock().expect("lock envenenado").len()
    }

    /// Valida que el sound_id no sea una ruta arbitraria del sistema de
    /// archivos (Regla #60). Solo IDs de la biblioteca interna permitidos
    /// (sin `/`, `\`, `..`, ni extensiones de ruta).
    fn validate_sound_id(sound_id: &str) -> Result<(), String> {
        if sound_id.is_empty() {
            return Err("sound_id vacío".to_string());
        }
        if sound_id.contains('/') || sound_id.contains('\\') || sound_id.contains("..") {
            return Err(format!(
                "sound_id contiene ruta arbitraria: '{sound_id}' (Regla #60)"
            ));
        }
        Ok(())
    }

    /// Encola una petición de audio. Valida el sound_id antes de aceptarla.
    pub fn enqueue(&self, request: AudioRequest) -> Result<(), String> {
        Self::validate_sound_id(&request.sound_id).map_err(|e| {
            self.logger.log(
                LogEntry::new(
                    &crate::clock::ProductionClock,
                    LogLevel::Error,
                    "audio",
                    &e,
                )
                .with_code(ErrorCode::Audio001),
            );
            e
        })?;

        self.queue.lock().expect("lock envenenado").push_back(AudioEntry {
            request,
            status: AudioStatus::Queued,
        });
        Ok(())
    }

    /// Devuelve la siguiente petición a reproducir si hay slot disponible.
    /// Regla #42: máximo 5 sonidos simultáneos (independiente de KeyStroke,
    /// Regla #41 — el audio no espera a que termine el KeyStroke).
    pub fn next_request(&self) -> Option<AudioRequest> {
        let active_count = self.active.lock().expect("lock envenenado").len();
        if active_count >= MAX_SIMULTANEOUS_AUDIO {
            return None;
        }
        let mut queue = self.queue.lock().expect("lock envenenado");
        if let Some(entry) = queue.pop_front() {
            self.active
                .lock()
                .expect("lock envenenado")
                .push(entry.request.clone());
            Some(entry.request)
        } else {
            None
        }
    }

    /// Marca un sonido como completado y libera su slot.
    pub fn complete(&self, request_id: &str) {
        self.active
            .lock()
            .expect("lock envenenado")
            .retain(|r| r.request_id != request_id);
    }

    /// Cancela todos los sonidos pendientes y activos de la sesión
    /// (Regla #47: LIVE_END cancela acciones pendientes del LIVE).
    pub fn cancel_session(&self, session_id: &str) {
        self.queue
            .lock()
            .expect("lock envenenado")
            .retain(|e| e.request.session_id != session_id);
        self.active
            .lock()
            .expect("lock envenenado")
            .retain(|r| r.session_id != session_id);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::logging::InMemoryLogger;

    fn audio_request(id: &str, session_id: &str, sound_id: &str) -> AudioRequest {
        AudioRequest {
            request_id: id.to_string(),
            execution_id: "exec_1".to_string(),
            automation_id: "auto_1".to_string(),
            event_id: "evt_1".to_string(),
            session_id: session_id.to_string(),
            priority: 10,
            sound_id: sound_id.to_string(),
            volume: Some(80),
            repeat_count: 1,
            repeat_interval_ms: 0,
        }
    }

    #[test]
    fn encola_y_devuelve_el_siguiente_sonido() {
        let engine = AudioEngine::new(Arc::new(InMemoryLogger::new()));
        engine.enqueue(audio_request("req_1", "live_1", "snd_rose")).unwrap();
        let next = engine.next_request();
        assert!(next.is_some());
        assert_eq!(next.unwrap().sound_id, "snd_rose");
    }

    #[test]
    fn maximo_5_sonidos_simultaneos() {
        // Regla #42
        let engine = AudioEngine::new(Arc::new(InMemoryLogger::new()));
        for i in 0..6 {
            engine
                .enqueue(audio_request(&format!("req_{i}"), "live_1", "snd_rose"))
                .unwrap();
        }
        for _ in 0..MAX_SIMULTANEOUS_AUDIO {
            assert!(engine.next_request().is_some());
        }
        // El sexto debe quedar bloqueado
        assert!(engine.next_request().is_none());
        assert_eq!(engine.active_count(), MAX_SIMULTANEOUS_AUDIO);
    }

    #[test]
    fn complete_libera_slot_para_el_siguiente() {
        let engine = AudioEngine::new(Arc::new(InMemoryLogger::new()));
        for i in 0..6 {
            engine
                .enqueue(audio_request(&format!("req_{i}"), "live_1", "snd_rose"))
                .unwrap();
        }
        for _ in 0..MAX_SIMULTANEOUS_AUDIO {
            engine.next_request();
        }
        // Cola vacía temporalmente, activos llenos
        assert!(engine.next_request().is_none());

        // Completar uno libera un slot
        engine.complete("req_0");
        let next = engine.next_request();
        assert!(next.is_some());
    }

    #[test]
    fn rechaza_sound_id_con_ruta_arbitraria() {
        // Regla #60
        let engine = AudioEngine::new(Arc::new(InMemoryLogger::new()));
        let bad_paths = [
            "../../system/sound.mp3",
            "/etc/passwd",
            "C:\\Windows\\sound.wav",
        ];
        for path in &bad_paths {
            let result = engine.enqueue(audio_request("req_1", "live_1", path));
            assert!(result.is_err(), "debería rechazar: {path}");
        }
    }

    #[test]
    fn acepta_sound_id_simple_sin_ruta() {
        let engine = AudioEngine::new(Arc::new(InMemoryLogger::new()));
        assert!(engine.enqueue(audio_request("req_1", "live_1", "snd_rose_001")).is_ok());
    }

    #[test]
    fn cancel_session_limpia_cola_y_activos() {
        // Regla #47
        let engine = AudioEngine::new(Arc::new(InMemoryLogger::new()));
        engine.enqueue(audio_request("req_1", "live_1", "snd_a")).unwrap();
        engine.enqueue(audio_request("req_2", "live_1", "snd_b")).unwrap();
        engine.next_request(); // activa req_1

        engine.cancel_session("live_1");

        assert_eq!(engine.queue_len(), 0);
        assert_eq!(engine.active_count(), 0);
    }

    #[test]
    fn audio_es_independiente_de_keystroke_puede_correr_en_paralelo() {
        // Regla #41: audio NO espera a que termine un KeyStroke — este test
        // verifica que el Audio Engine no tiene ninguna dependencia con el
        // KeyStroke Engine (son structs completamente separados).
        use crate::keystroke::KeyStrokeEngine;
        let audio = AudioEngine::new(Arc::new(InMemoryLogger::new()));
        let keystroke = KeyStrokeEngine::new(Arc::new(InMemoryLogger::new()));

        audio.enqueue(audio_request("req_audio", "live_1", "snd_rose")).unwrap();

        // Simulamos un KeyStroke activo
        keystroke
            .enqueue(crate::contracts::KeyStrokeRequest {
                request_id: "req_ks".to_string(),
                execution_id: "exec_1".to_string(),
                automation_id: "auto_1".to_string(),
                event_id: "evt_1".to_string(),
                session_id: "live_1".to_string(),
                priority: 10,
                sequence: vec![crate::contracts::KeyStrokeStep {
                    keys: vec!["a".to_string()],
                    duration_ms: Some(100),
                    interval_ms: None,
                }],
                repeat_count: 1,
                repeat_interval_ms: 0,
            })
            .unwrap();
        keystroke.next_request(); // activa el keystroke
        assert!(keystroke.is_active());

        // El audio puede reproducirse igual aunque haya un keystroke activo
        let audio_next = audio.next_request();
        assert!(audio_next.is_some());
    }
}