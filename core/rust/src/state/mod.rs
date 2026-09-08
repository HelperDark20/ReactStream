//! State Manager (Sección 28). Estado global de la aplicación en RAM.
//! Regla #83: la UI refleja SOLO el estado que el Core ya confirmó.
//! Regla #84: no hay éxito optimista — React nunca actualiza su propio
//! estado antes de que el Core lo confirme vía Tauri Commands/Events.
//!
//! Regla explícita de la Sección 28: "Conexión TikTok y LIVE Session son
//! máquinas independientes" — por eso viven en campos separados, nunca
//! colapsados en un único enum (Regla #19: desconexión de TikTok NO
//! significa LIVE terminado).

pub mod settings;

use crate::contracts::{ApplicationState, BridgeState, SessionStatus, TikTokConnectionState};
use std::sync::RwLock;

#[derive(Debug, Clone)]
pub struct AppStateSnapshot {
    pub application: ApplicationState,
    pub tiktok_connection: TikTokConnectionState,
    pub bridge: BridgeState,
    pub session: SessionStatus,
}

impl Default for AppStateSnapshot {
    fn default() -> Self {
        // Regla #80: después de reiniciar la aplicación, estado de sesión = NO_SESSION.
        Self {
            application: ApplicationState::Starting,
            tiktok_connection: TikTokConnectionState::Disconnected,
            bridge: BridgeState::Stopped,
            session: SessionStatus::NoSession,
        }
    }
}

pub struct StateManager {
    state: RwLock<AppStateSnapshot>,
}

impl StateManager {
    pub fn new() -> Self {
        Self {
            state: RwLock::new(AppStateSnapshot::default()),
        }
    }

    /// Único punto de lectura para Tauri Commands/Events hacia React
    /// (Regla #83). React nunca debe mutar esto directamente.
    pub fn snapshot(&self) -> AppStateSnapshot {
        self.state.read().expect("lock envenenado").clone()
    }

    pub fn set_application(&self, value: ApplicationState) {
        self.state.write().expect("lock envenenado").application = value;
    }

    pub fn set_tiktok_connection(&self, value: TikTokConnectionState) {
        self.state.write().expect("lock envenenado").tiktok_connection = value;
    }

    pub fn set_bridge(&self, value: BridgeState) {
        self.state.write().expect("lock envenenado").bridge = value;
    }

    pub fn set_session(&self, value: SessionStatus) {
        self.state.write().expect("lock envenenado").session = value;
    }
}

impl Default for StateManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn estado_inicial_tras_arranque_es_no_session() {
        let manager = StateManager::new();
        let snap = manager.snapshot();
        assert_eq!(snap.session, SessionStatus::NoSession);
        assert_eq!(snap.tiktok_connection, TikTokConnectionState::Disconnected);
        assert_eq!(snap.bridge, BridgeState::Stopped);
        assert_eq!(snap.application, ApplicationState::Starting);
    }

    #[test]
    fn tiktok_connection_y_session_son_maquinas_independientes() {
        let manager = StateManager::new();
        manager.set_tiktok_connection(TikTokConnectionState::Connected);
        manager.set_session(SessionStatus::Active);

        let snap = manager.snapshot();
        assert_eq!(snap.tiktok_connection, TikTokConnectionState::Connected);
        assert_eq!(snap.session, SessionStatus::Active);

        // Regla #19: desconexión de TikTok NO significa LIVE terminado.
        manager.set_tiktok_connection(TikTokConnectionState::Disconnected);
        let snap2 = manager.snapshot();
        assert_eq!(snap2.session, SessionStatus::Active);
        assert_eq!(snap2.tiktok_connection, TikTokConnectionState::Disconnected);
    }
}
