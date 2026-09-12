//! Simulation Engine (Sección 25). Regla #67: usa exactamente el mismo
//! pipeline que producción — el mismo Event Bus, el mismo Automation Engine,
//! los mismos motores. Regla #68: nunca envía nada a TikTok. Regla #69:
//! Safe Action Mode es el modo predeterminado (las acciones se loguean pero
//! no se ejecutan físicamente — no se presionan teclas ni se reproducen
//! sonidos reales). Regla #85: integración debe probarse sin depender de
//! TikTok real. Regla #86: solo mockear fronteras externas.

use crate::clock::{Clock, SimulationClock};
use crate::contracts::{
    AppEvent, EventSource, Gift, GiftEvent, LikeEvent, LiveEndedEvent, LiveStartedEvent,
    MemberEvent, ShareEvent, User, ViewerCountEvent,
};
use crate::event_bus::EventBus;
use crate::logging::{LogEntry, LogLevel, Logger};
use std::sync::Arc;
use uuid::Uuid;

/// Velocidades de simulación soportadas.
#[derive(Debug, Clone, Copy)]
pub enum SimulationSpeed {
    X1,
    X2,
    X5,
    X10,
    X60,
}

impl SimulationSpeed {
    pub fn multiplier(&self) -> u64 {
        match self {
            SimulationSpeed::X1 => 1,
            SimulationSpeed::X2 => 2,
            SimulationSpeed::X5 => 5,
            SimulationSpeed::X10 => 10,
            SimulationSpeed::X60 => 60,
        }
    }
}

/// Un evento programado para la simulación.
pub struct SimulationEvent {
    /// Milisegundos desde el inicio de la simulación en que debe dispararse.
    pub offset_ms: u64,
    pub event: AppEvent,
}

pub struct SimulationEngine {
    clock: Arc<SimulationClock>,
    bus: Arc<EventBus>,
    logger: Arc<dyn Logger>,
    /// Regla #69: Safe Action Mode — cuando es true, KeyStroke/Audio NO
    /// se ejecutan físicamente, solo se loguean.
    safe_action_mode: bool,
    session_id: String,
}

impl SimulationEngine {
    pub fn new(
        clock: Arc<SimulationClock>,
        bus: Arc<EventBus>,
        logger: Arc<dyn Logger>,
    ) -> Self {
        let session_id = Uuid::new_v4().to_string();
        Self {
            clock,
            bus,
            logger,
            safe_action_mode: true, // Regla #69: default true
            session_id,
        }
    }

    pub fn session_id(&self) -> &str {
        &self.session_id
    }

    pub fn safe_action_mode(&self) -> bool {
        self.safe_action_mode
    }

    /// Permite deshabilitar Safe Action Mode explícitamente. Requiere
    /// confirmación deliberada del llamador (Regla #69).
    pub fn set_safe_action_mode(&mut self, enabled: bool) {
        self.safe_action_mode = enabled;
        self.logger.log(LogEntry::new(
            self.clock.as_ref(),
            if enabled { LogLevel::Info } else { LogLevel::Warn },
            "simulation",
            format!(
                "Safe Action Mode: {} — acciones físicas {}",
                if enabled { "ON" } else { "OFF" },
                if enabled { "deshabilitadas" } else { "HABILITADAS (precaución)" }
            ),
        ));
    }

    /// Ejecuta un escenario de simulación — publica eventos en el Bus en
    /// el orden y tiempo definidos por `events`, avanzando el reloj de
    /// simulación según `speed`. Regla #67: usa exactamente el mismo
    /// Event Bus que producción.
    pub fn run_scenario(&self, mut events: Vec<SimulationEvent>, speed: SimulationSpeed) {
        events.sort_by_key(|e| e.offset_ms);

        self.bus.set_active_session(Some(self.session_id.clone()));

        // Emitir live_started al inicio del escenario
        let live_started = AppEvent::LiveStarted(LiveStartedEvent {
            id: Uuid::new_v4().to_string(),
            timestamp: self.clock.now_ms(),
            session_id: self.session_id.clone(),
            source: EventSource::Simulation,
            user: None,
            metadata: None,
        });
        self.bus.publish(live_started);

        let mut last_offset = 0u64;
        for sim_event in events {
            let delta = sim_event.offset_ms.saturating_sub(last_offset);
            // Avanzar el reloj de simulación a la velocidad configurada
            self.clock.advance_ms(delta * speed.multiplier());
            last_offset = sim_event.offset_ms;

            let outcome = self.bus.publish(sim_event.event);
            self.logger.log(LogEntry::new(
                self.clock.as_ref(),
                LogLevel::Debug,
                "simulation",
                format!("evento publicado: {outcome:?}"),
            ));
        }
    }

    /// Construye un `GiftEvent` listo para usar en escenarios de simulación.
    pub fn make_gift(&self, user_id: &str, gift_id: &str, coins: u64, quantity: u64) -> AppEvent {
        AppEvent::Gift(GiftEvent {
            id: Uuid::new_v4().to_string(),
            timestamp: self.clock.now_ms(),
            session_id: self.session_id.clone(),
            source: EventSource::Simulation,
            user: User {
                id: user_id.to_string(),
                username: user_id.to_string(),
                display_name: user_id.to_string(),
                avatar_url: None,
            },
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

    pub fn make_like(&self, user_id: &str, count: u64) -> AppEvent {
        AppEvent::Like(LikeEvent {
            id: Uuid::new_v4().to_string(),
            timestamp: self.clock.now_ms(),
            session_id: self.session_id.clone(),
            source: EventSource::Simulation,
            user: User {
                id: user_id.to_string(),
                username: user_id.to_string(),
                display_name: user_id.to_string(),
                avatar_url: None,
            },
            metadata: None,
            count,
        })
    }

    pub fn make_viewer_count(&self, count: u64) -> AppEvent {
        AppEvent::ViewerCount(ViewerCountEvent {
            id: Uuid::new_v4().to_string(),
            timestamp: self.clock.now_ms(),
            session_id: self.session_id.clone(),
            source: EventSource::Simulation,
            user: None,
            metadata: None,
            count,
        })
    }

    pub fn make_follow(&self, user_id: &str) -> AppEvent {
        AppEvent::Follow(crate::contracts::FollowEvent {
            id: Uuid::new_v4().to_string(),
            timestamp: self.clock.now_ms(),
            session_id: self.session_id.clone(),
            source: EventSource::Simulation,
            user: User {
                id: user_id.to_string(),
                username: user_id.to_string(),
                display_name: user_id.to_string(),
                avatar_url: None,
            },
            metadata: None,
        })
    }

    pub fn make_share(&self, user_id: &str) -> AppEvent {
        AppEvent::Share(ShareEvent {
            id: Uuid::new_v4().to_string(),
            timestamp: self.clock.now_ms(),
            session_id: self.session_id.clone(),
            source: EventSource::Simulation,
            user: User {
                id: user_id.to_string(),
                username: user_id.to_string(),
                display_name: user_id.to_string(),
                avatar_url: None,
            },
            metadata: None,
        })
    }

    pub fn make_member(&self, user_id: &str) -> AppEvent {
        AppEvent::Member(MemberEvent {
            id: Uuid::new_v4().to_string(),
            timestamp: self.clock.now_ms(),
            session_id: self.session_id.clone(),
            source: EventSource::Simulation,
            user: User {
                id: user_id.to_string(),
                username: user_id.to_string(),
                display_name: user_id.to_string(),
                avatar_url: None,
            },
            metadata: None,
        })
    }

    pub fn make_live_ended(&self) -> AppEvent {
        AppEvent::LiveEnded(LiveEndedEvent {
            id: Uuid::new_v4().to_string(),
            timestamp: self.clock.now_ms(),
            session_id: self.session_id.clone(),
            source: EventSource::Simulation,
            user: None,
            metadata: None,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::logging::InMemoryLogger;
    use crate::rankings::RankingEngine;
    use crate::session::SessionManager;
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::sync::Arc;

    fn setup() -> (SimulationEngine, Arc<EventBus>) {
        let clock = Arc::new(SimulationClock::new(0));
        let logger = Arc::new(InMemoryLogger::new());
        let bus = Arc::new(EventBus::new(logger.clone()));
        let engine = SimulationEngine::new(clock.clone(), bus.clone(), logger);
        (engine, bus)
    }

    #[test]
    fn safe_action_mode_es_true_por_defecto() {
        let (engine, _) = setup();
        assert!(engine.safe_action_mode());
    }

    #[test]
    fn run_scenario_publica_eventos_en_el_bus() {
        let (engine, _bus) = setup();
        let calls = Arc::new(AtomicU64::new(0));
        let calls_clone = calls.clone();

        _bus.subscribe(
            crate::contracts::EventType::Gift,
            Arc::new(move |_e| { calls_clone.fetch_add(1, Ordering::SeqCst); }),
        );

        let gift = engine.make_gift("alice", "5655", 1, 10);
        engine.run_scenario(
            vec![SimulationEvent { offset_ms: 0, event: gift }],
            SimulationSpeed::X1,
        );

        assert_eq!(calls.load(Ordering::SeqCst), 1);
    }

    #[test]
    fn simulation_usa_el_mismo_pipeline_que_produccion() {
        // Regla #67: conectamos SessionManager y RankingEngine reales al bus
        let (engine, bus) = setup();
        let session_manager = Arc::new(SessionManager::new());
        let ranking_engine = Arc::new(RankingEngine::new(10, 10));

        crate::session::wire_to_event_bus(session_manager.clone(), &bus);
        crate::rankings::wire_to_event_bus(ranking_engine.clone(), &bus);

        let clock = SimulationClock::new(0);
        session_manager.start_session(&clock, engine.session_id(), "uid_1", "carlos");

        let events = vec![
            SimulationEvent { offset_ms: 0, event: engine.make_gift("alice", "5655", 1, 10) },
            SimulationEvent { offset_ms: 1000, event: engine.make_like("bob", 25) },
            SimulationEvent { offset_ms: 2000, event: engine.make_gift("alice", "6216", 29999, 1) },
        ];

        engine.run_scenario(events, SimulationSpeed::X1);

        let snap = session_manager.snapshot().unwrap();
        assert_eq!(snap.counters.total_coins, 10 + 29999);
        assert_eq!(snap.counters.total_likes, 25);

        let top = ranking_engine.top_donors();
        assert_eq!(top[0].user.id, "alice");
        assert_eq!(top[0].coins, 10 + 29999);

        // Best Gift debe ser el León (29999 coins unitarios), no las Rosas
        let best = snap.best_gift.unwrap();
        assert_eq!(best.gift.id, "6216");
    }

    #[test]
    fn eventos_de_simulacion_tienen_source_simulation() {
        let (engine, _) = setup();
        let gift = engine.make_gift("u1", "5655", 1, 1);
        if let AppEvent::Gift(g) = &gift {
            assert_eq!(g.source, EventSource::Simulation);
        } else {
            panic!("esperaba Gift");
        }
    }

    #[test]
    fn simulation_nunca_mezcla_session_ids() {
        // Regla #17: sessionId separa completamente cada LIVE
        let (engine, _) = setup();
        let gift = engine.make_gift("u1", "5655", 1, 1);
        if let AppEvent::Gift(g) = &gift {
            assert_eq!(g.session_id, engine.session_id());
        }
    }
}
