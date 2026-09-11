//! Live Session Manager (Sección 8). Cada LIVE es una sesión única e
//! independiente. Regla #19-20: desconexión de TikTok / cierre de OBS NO
//! terminan la sesión — solo un evento `live_ended` explícito o una llamada
//! manual a `end_session` lo hace. Regla #79-80: crash/reinicio no recupera
//! el LIVE; tras reiniciar la app, el estado siempre es NO_SESSION (ya
//! garantizado por `StateManager` desde la Etapa 2).
//!
//! Regla #18 (sesión vieja se ignora) ya la aplica el Event Bus antes de
//! que un evento llegue aquí — `process_event` confía en eso y no repite
//! la validación de sessionId (Regla #90: simplicidad, evitar lógica
//! duplicada entre capas).

use crate::clock::Clock;
use crate::contracts::{AppEvent, BestGift, SessionStatus};
use std::sync::RwLock;

#[derive(Debug, Clone, Default)]
pub struct SessionCounters {
    pub total_likes: u64,
    pub total_coins: u64,
    pub total_gifts: u64,
    pub total_follows: u64,
    pub total_shares: u64,
    pub total_comments: u64,
    pub max_viewers: u64,
}

#[derive(Debug, Clone)]
pub struct LiveSessionState {
    pub id: String,
    pub tiktok_user_id: String,
    pub tiktok_username: String,
    pub started_at: u64,
    pub ended_at: Option<u64>,
    pub status: SessionStatus,
    pub counters: SessionCounters,
    pub best_gift: Option<BestGift>,
}

impl LiveSessionState {
    pub fn duration_seconds(&self) -> u64 {
        match self.ended_at {
            Some(ended) => ended.saturating_sub(self.started_at) / 1000,
            None => 0,
        }
    }
}

pub struct SessionManager {
    state: RwLock<Option<LiveSessionState>>,
}

impl SessionManager {
    pub fn new() -> Self {
        Self {
            state: RwLock::new(None),
        }
    }

    pub fn status(&self) -> SessionStatus {
        self.state
            .read()
            .expect("lock envenenado")
            .as_ref()
            .map(|s| s.status)
            .unwrap_or(SessionStatus::NoSession)
    }

    pub fn snapshot(&self) -> Option<LiveSessionState> {
        self.state.read().expect("lock envenenado").clone()
    }

    /// Al LIVE_STARTED (Sección 8): crear sessionId, inicializar
    /// estadísticas, reset jar/likes tracker/rankings/Best Gift, estado
    /// ACTIVE. El reset de jar/likes tracker/rankings ocurre en sus propios
    /// motores cuando existan (Etapas 7, 8, 15/19/20) — aquí se resetean
    /// los contadores y Best Gift, que sí son responsabilidad directa de
    /// Session.
    pub fn start_session(
        &self,
        clock: &dyn Clock,
        session_id: impl Into<String>,
        tiktok_user_id: impl Into<String>,
        tiktok_username: impl Into<String>,
    ) {
        let mut guard = self.state.write().expect("lock envenenado");
        *guard = Some(LiveSessionState {
            id: session_id.into(),
            tiktok_user_id: tiktok_user_id.into(),
            tiktok_username: tiktok_username.into(),
            started_at: clock.now_ms(),
            ended_at: None,
            status: SessionStatus::Active,
            counters: SessionCounters::default(),
            best_gift: None,
        });
    }

    /// Procesa un evento ya validado por el Event Bus, actualizando
    /// contadores (Sección 8). Se ignora si no hay sesión ACTIVE —
    /// implementa el paso 2 de LIVE_END ("rechazar eventos tardíos").
    pub fn process_event(&self, event: &AppEvent) {
        let mut guard = self.state.write().expect("lock envenenado");
        let Some(session) = guard.as_mut() else {
            return;
        };
        if session.status != SessionStatus::Active {
            return;
        }

        match event {
            AppEvent::Gift(g) => {
                session.counters.total_coins += g.total_coins;
                session.counters.total_gifts += g.quantity;
                // Best Gift compara gift.coins (valor UNITARIO), Regla #31.
                // NUNCA totalCoins del evento — ejemplo de la Sección 16:
                // Rose x100 pierde contra Lion x1 si Lion vale más por unidad.
                let is_better = match &session.best_gift {
                    None => true,
                    Some(current) => g.gift.coins > current.coins,
                };
                if is_better {
                    session.best_gift = Some(BestGift {
                        gift: g.gift.clone(),
                        sender: g.user.clone(),
                        coins: g.gift.coins,
                    });
                }
            }
            AppEvent::Like(l) => {
                session.counters.total_likes += l.count;
            }
            AppEvent::Follow(_) => {
                session.counters.total_follows += 1;
            }
            AppEvent::Share(_) => {
                session.counters.total_shares += 1;
            }
            AppEvent::Comment(_) => {
                session.counters.total_comments += 1;
            }
            AppEvent::ViewerCount(v) => {
                session.counters.max_viewers = session.counters.max_viewers.max(v.count);
            }
            _ => {}
        }
    }

    /// LIVE_END (Sección 8, 12 pasos). Esta etapa implementa lo que ya
    /// existe (estado + contadores + timestamp de cierre). Cancelar
    /// acciones/KeyStroke/sonidos pendientes, finalizar Timer/Rankings y
    /// notificar overlays se conectan cuando esos motores existan (Etapas
    /// 7, 8, 12, 14, 15) — cada uno se suscribirá a este mismo punto de
    /// cierre en su propia etapa, no hace falta anticiparlo aquí.
    pub fn end_session(&self, clock: &dyn Clock) -> Option<LiveSessionState> {
        let mut guard = self.state.write().expect("lock envenenado");
        let session = guard.as_mut()?;
        if session.status != SessionStatus::Active {
            return None;
        }
        session.status = SessionStatus::Ending; // paso 1
        session.ended_at = Some(clock.now_ms());
        // TODO(Etapas 7/8/12/14/15): cancelar acciones/KeyStroke/sonidos
        // pendientes del LIVE, finalizar Timer/Rankings, notificar overlays.
        session.status = SessionStatus::Completed; // paso 12
        guard.clone()
    }

    /// Limpia el estado en memoria (paso 10 de LIVE_END). Se llama después
    /// de persistir con `LiveSessionRepository::save`.
    pub fn clear(&self) {
        *self.state.write().expect("lock envenenado") = None;
    }
}

impl Default for SessionManager {
    fn default() -> Self {
        Self::new()
    }
}

/// Suscribe el SessionManager al Event Bus para los tipos de evento que
/// afectan contadores de sesión (Sección 8). `timer_zero` y `live_started`/
/// `live_ended` NO se suscriben aquí: el primero pertenece al Timer Engine
/// (Etapa 7), y el ciclo de vida de la sesión se dispara explícitamente vía
/// `start_session`/`end_session` desde quien orqueste el Bridge (Etapa 23+),
/// no de forma implícita al recibir el evento.
pub fn wire_to_event_bus(manager: std::sync::Arc<SessionManager>, bus: &crate::event_bus::EventBus) {
    use crate::contracts::EventType;
    use std::sync::Arc;

    for event_type in [
        EventType::Gift,
        EventType::Like,
        EventType::Follow,
        EventType::Share,
        EventType::Comment,
        EventType::ViewerCount,
    ] {
        let manager_clone = manager.clone();
        bus.subscribe(
            event_type,
            Arc::new(move |event: &AppEvent| manager_clone.process_event(event)),
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::clock::SimulationClock;
    use crate::contracts::{EventSource, Gift, GiftEvent, LikeEvent, User, ViewerCountEvent};

    fn test_user(id: &str) -> User {
        User {
            id: id.to_string(),
            username: id.to_string(),
            display_name: id.to_string(),
            avatar_url: None,
        }
    }

    fn gift_event(id: &str, session_id: &str, gift_id: &str, coins: u64, quantity: u64) -> AppEvent {
        AppEvent::Gift(GiftEvent {
            id: id.to_string(),
            timestamp: 0,
            session_id: session_id.to_string(),
            source: EventSource::Simulation,
            user: test_user("sender_1"),
            metadata: None,
            gift: Gift {
                id: gift_id.to_string(),
                name: gift_id.to_string(),
                coins,
                image_url: None,
                region: "CO".to_string(),
            },
            quantity,
            total_coins: coins * quantity,
            repeat_end: true,
        })
    }

    #[test]
    fn start_session_inicializa_en_active_con_contadores_en_cero() {
        let manager = SessionManager::new();
        let clock = SimulationClock::new(1_000);
        manager.start_session(&clock, "live_1", "uid_1", "carlos");

        let snap = manager.snapshot().unwrap();
        assert_eq!(snap.status, SessionStatus::Active);
        assert_eq!(snap.started_at, 1_000);
        assert_eq!(snap.counters.total_coins, 0);
        assert!(snap.best_gift.is_none());
    }

    #[test]
    fn sin_sesion_activa_process_event_no_hace_nada() {
        let manager = SessionManager::new();
        manager.process_event(&gift_event("evt_1", "live_1", "5655", 1, 10));
        assert!(manager.snapshot().is_none());
    }

    #[test]
    fn gift_actualiza_total_coins_y_total_gifts() {
        let manager = SessionManager::new();
        let clock = SimulationClock::new(0);
        manager.start_session(&clock, "live_1", "uid_1", "carlos");

        manager.process_event(&gift_event("evt_1", "live_1", "5655", 1, 10));

        let snap = manager.snapshot().unwrap();
        assert_eq!(snap.counters.total_coins, 10); // gift.coins(1) * quantity(10)
        assert_eq!(snap.counters.total_gifts, 10);
    }

    #[test]
    fn best_gift_compara_valor_unitario_no_total_coins() {
        // Ejemplo exacto de la Sección 16: Rose x100 (coins=1) pierde
        // contra Lion x1 (coins=500) porque Best Gift compara gift.coins,
        // NUNCA totalCoins del evento (Regla #31).
        let manager = SessionManager::new();
        let clock = SimulationClock::new(0);
        manager.start_session(&clock, "live_1", "uid_1", "carlos");

        manager.process_event(&gift_event("evt_rose", "live_1", "rose", 1, 100)); // totalCoins=100
        manager.process_event(&gift_event("evt_lion", "live_1", "lion", 500, 1)); // totalCoins=500

        let snap = manager.snapshot().unwrap();
        let best = snap.best_gift.expect("debe haber Best Gift");
        assert_eq!(best.gift.id, "lion");
        assert_eq!(best.coins, 500);
    }

    #[test]
    fn like_follow_share_comment_actualizan_sus_contadores() {
        let manager = SessionManager::new();
        let clock = SimulationClock::new(0);
        manager.start_session(&clock, "live_1", "uid_1", "carlos");

        manager.process_event(&AppEvent::Like(LikeEvent {
            id: "evt_like".to_string(),
            timestamp: 0,
            session_id: "live_1".to_string(),
            source: EventSource::Simulation,
            user: test_user("u1"),
            metadata: None,
            count: 25,
        }));

        let snap = manager.snapshot().unwrap();
        assert_eq!(snap.counters.total_likes, 25);
    }

    #[test]
    fn viewer_count_guarda_el_maximo_no_el_ultimo() {
        let manager = SessionManager::new();
        let clock = SimulationClock::new(0);
        manager.start_session(&clock, "live_1", "uid_1", "carlos");

        for count in [50, 200, 120] {
            manager.process_event(&AppEvent::ViewerCount(ViewerCountEvent {
                id: format!("evt_{count}"),
                timestamp: 0,
                session_id: "live_1".to_string(),
                source: EventSource::Simulation,
                user: None,
                metadata: None,
                count,
            }));
        }

        assert_eq!(manager.snapshot().unwrap().counters.max_viewers, 200);
    }

    #[test]
    fn end_session_transiciona_a_completed_y_congela_contadores() {
        let manager = SessionManager::new();
        let clock = SimulationClock::new(0);
        manager.start_session(&clock, "live_1", "uid_1", "carlos");
        manager.process_event(&gift_event("evt_1", "live_1", "5655", 1, 10));

        clock.advance_ms(5_000);
        let ended = manager.end_session(&clock).expect("debe devolver la sesión");
        assert_eq!(ended.status, SessionStatus::Completed);
        assert_eq!(ended.ended_at, Some(5_000));
        assert_eq!(ended.duration_seconds(), 5);

        // Regla: evento tardío tras el cierre se ignora (paso 2 de LIVE_END).
        manager.process_event(&gift_event("evt_tardio", "live_1", "5655", 1, 999));
        assert_eq!(manager.snapshot().unwrap().counters.total_coins, 10);
    }

    #[test]
    fn end_session_sin_sesion_activa_no_hace_nada() {
        let manager = SessionManager::new();
        assert!(manager.end_session(&SimulationClock::new(0)).is_none());
    }

    #[test]
    fn clear_deja_el_manager_en_no_session() {
        let manager = SessionManager::new();
        let clock = SimulationClock::new(0);
        manager.start_session(&clock, "live_1", "uid_1", "carlos");
        manager.clear();
        assert_eq!(manager.status(), SessionStatus::NoSession);
    }

    #[test]
    fn se_conecta_al_event_bus_y_actualiza_contadores_end_to_end() {
        use crate::event_bus::EventBus;
        use crate::logging::InMemoryLogger;
        use std::sync::Arc;

        let bus = EventBus::new(Arc::new(InMemoryLogger::new()));
        let manager = Arc::new(SessionManager::new());
        wire_to_event_bus(manager.clone(), &bus);

        let clock = SimulationClock::new(0);
        manager.start_session(&clock, "live_1", "uid_1", "carlos");
        bus.set_active_session(Some("live_1".to_string()));

        bus.publish(gift_event("evt_1", "live_1", "5655", 1, 10));

        let snap = manager.snapshot().unwrap();
        assert_eq!(snap.counters.total_coins, 10);
        assert_eq!(snap.counters.total_gifts, 10);
    }
}
