//! Timer Engine (Sección 14). Regla #24: el Timer es propiedad exclusiva
//! del Core. Regla #25: nunca termina el LIVE. Regla #26: TIMER_ZERO se
//! emite UNA sola vez por transición a cero. Regla #27: usa timestamps
//! reales del Clock, NUNCA acumulación ingenua de ticks.

use crate::clock::Clock;
use crate::contracts::{
    AppEvent, EventSource, TimerZeroEvent,
};
use crate::state::settings::AppSettings;
use std::sync::RwLock;
use uuid::Uuid;

#[derive(Debug, Clone, PartialEq)]
pub enum TimerStatus {
    Stopped,
    Running,
    Zero,
}

#[derive(Debug)]
struct TimerInner {
    remaining_ms: i64,
    running: bool,
    last_tick_ms: u64,
    zero_emitted: bool,
    session_id: String,
}

pub struct TimerEngine {
    inner: RwLock<TimerInner>,
    initial_seconds: u64,
    coins_per_second: u64,
    reactivate_on_zero: bool,
}

impl TimerEngine {
    pub fn new(settings: &AppSettings, clock: &dyn Clock, session_id: impl Into<String>) -> Self {
        Self {
            inner: RwLock::new(TimerInner {
                remaining_ms: (settings.timer_initial * 1000) as i64,
                running: false,
                last_tick_ms: clock.now_ms(),
                zero_emitted: false,
                session_id: session_id.into(),
            }),
            initial_seconds: settings.timer_initial,
            coins_per_second: settings.timer_coins_per_second,
            reactivate_on_zero: settings.timer_reactivate_on_zero,
        }
    }

    pub fn start(&self, clock: &dyn Clock) {
        let mut g = self.inner.write().expect("lock envenenado");
        if g.remaining_ms > 0 {
            g.running = true;
            g.last_tick_ms = clock.now_ms();
        }
    }

    pub fn stop(&self) {
        self.inner.write().expect("lock envenenado").running = false;
    }

    pub fn reset(&self, clock: &dyn Clock) {
        let mut g = self.inner.write().expect("lock envenenado");
        g.remaining_ms = (self.initial_seconds * 1000) as i64;
        g.running = false;
        g.zero_emitted = false;
        g.last_tick_ms = clock.now_ms();
    }

    /// Avanza el timer según el tiempo real transcurrido desde el último
    /// tick (Regla #27). Devuelve `Some(TimerZeroEvent)` la primera vez
    /// que la cuenta llega a cero (Regla #26 — UNA sola vez).
    pub fn tick(&self, clock: &dyn Clock) -> Option<AppEvent> {
        let mut g = self.inner.write().expect("lock envenenado");
        if !g.running {
            return None;
        }
        let now = clock.now_ms();
        let delta_ms = (now.saturating_sub(g.last_tick_ms)) as i64;
        g.last_tick_ms = now;
        g.remaining_ms = (g.remaining_ms - delta_ms).max(0);

        if g.remaining_ms == 0 && !g.zero_emitted {
            g.running = false;
            g.zero_emitted = true;
            let session_id = g.session_id.clone();
            return Some(AppEvent::TimerZero(TimerZeroEvent {
                id: Uuid::new_v4().to_string(),
                timestamp: now,
                session_id,
                source: EventSource::System,
                user: None,
                metadata: None,
            }));
        }
        None
    }

    /// Convierte coins recibidos en segundos y los suma al timer.
    /// Respeta `reactivate_on_zero` (decisión adicional post-documento).
    pub fn add_coins(&self, coins: u64, clock: &dyn Clock) {
        if self.coins_per_second == 0 {
            return;
        }
        let add_ms = (coins * 1000) / self.coins_per_second;
        if add_ms == 0 {
            return;
        }
        let mut g = self.inner.write().expect("lock envenenado");
        let was_zero = g.remaining_ms == 0;
        g.remaining_ms += add_ms as i64;

        if was_zero {
            g.zero_emitted = false; // permite emitir TIMER_ZERO de nuevo en el futuro
            if self.reactivate_on_zero {
                g.running = true;
                g.last_tick_ms = clock.now_ms();
            }
        }
    }

    pub fn remaining_seconds(&self) -> u64 {
        let g = self.inner.read().expect("lock envenenado");
        (g.remaining_ms.max(0) as u64) / 1000
    }

    pub fn status(&self) -> TimerStatus {
        let g = self.inner.read().expect("lock envenenado");
        if g.remaining_ms == 0 {
            TimerStatus::Zero
        } else if g.running {
            TimerStatus::Running
        } else {
            TimerStatus::Stopped
        }
    }
}

/// Suscribe el TimerEngine al Event Bus para recibir Gift events y
/// convertir coins en segundos.
pub fn wire_to_event_bus(
    engine: std::sync::Arc<TimerEngine>,
    bus: &crate::event_bus::EventBus,
    clock: std::sync::Arc<dyn Clock>,
) {
    use crate::contracts::EventType;
    use std::sync::Arc;

    let engine_clone = engine.clone();
    let clock_clone = clock.clone();
    bus.subscribe(
        EventType::Gift,
        Arc::new(move |event: &AppEvent| {
            if let AppEvent::Gift(g) = event {
                engine_clone.add_coins(g.total_coins, clock_clone.as_ref());
            }
        }),
    );
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::clock::SimulationClock;
    use crate::state::settings::AppSettings;

    fn default_engine(clock: &dyn Clock) -> TimerEngine {
        TimerEngine::new(&AppSettings::default(), clock, "live_test")
    }

    #[test]
    fn timer_inicia_detenido_con_valor_inicial() {
        let clock = SimulationClock::new(0);
        let engine = default_engine(&clock);
        assert_eq!(engine.status(), TimerStatus::Stopped);
        assert_eq!(engine.remaining_seconds(), 300);
    }

    #[test]
    fn tick_no_avanza_si_esta_detenido() {
        let clock = SimulationClock::new(0);
        let engine = default_engine(&clock);
        clock.advance_ms(5_000);
        let event = engine.tick(&clock);
        assert!(event.is_none());
        assert_eq!(engine.remaining_seconds(), 300);
    }

    #[test]
    fn tick_avanza_correctamente_con_timestamps_reales() {
        let clock = SimulationClock::new(0);
        let engine = default_engine(&clock);
        engine.start(&clock);
        clock.advance_ms(10_000);
        engine.tick(&clock);
        assert_eq!(engine.remaining_seconds(), 290);
    }

    #[test]
    fn timer_zero_se_emite_una_sola_vez() {
        let clock = SimulationClock::new(0);
        let mut settings = AppSettings::default();
        settings.timer_initial = 5;
        let engine = TimerEngine::new(&settings, &clock, "live_1");
        engine.start(&clock);

        clock.advance_ms(5_000);
        let first = engine.tick(&clock);
        assert!(matches!(first, Some(AppEvent::TimerZero(_))));

        // Segundo tick — no debe emitir otro TIMER_ZERO (Regla #26)
        clock.advance_ms(1_000);
        let second = engine.tick(&clock);
        assert!(second.is_none());
        assert_eq!(engine.status(), TimerStatus::Zero);
    }

    #[test]
    fn add_coins_suma_segundos_correctamente() {
        let clock = SimulationClock::new(0);
        // coins_per_second = 10, así que 20 coins = 2 segundos
        let engine = default_engine(&clock);
        engine.add_coins(20, &clock);
        assert_eq!(engine.remaining_seconds(), 302);
    }

    #[test]
    fn reactivate_on_zero_true_reactiva_el_timer_al_recibir_coins() {
        let clock = SimulationClock::new(0);
        let mut settings = AppSettings::default();
        settings.timer_initial = 2;
        settings.timer_reactivate_on_zero = true;
        let engine = TimerEngine::new(&settings, &clock, "live_1");
        engine.start(&clock);
        clock.advance_ms(2_000);
        engine.tick(&clock); // llega a cero

        assert_eq!(engine.status(), TimerStatus::Zero);
        engine.add_coins(10, &clock); // 10 coins = 1 segundo con coins_per_second=10
        assert_eq!(engine.status(), TimerStatus::Running);
    }

    #[test]
    fn reactivate_on_zero_false_no_reactiva_el_timer() {
        let clock = SimulationClock::new(0);
        let mut settings = AppSettings::default();
        settings.timer_initial = 2;
        settings.timer_reactivate_on_zero = false;
        let engine = TimerEngine::new(&settings, &clock, "live_1");
        engine.start(&clock);
        clock.advance_ms(2_000);
        engine.tick(&clock);

        engine.add_coins(10, &clock);
        assert_eq!(engine.status(), TimerStatus::Stopped);
    }

    #[test]
    fn reset_vuelve_al_estado_inicial() {
        let clock = SimulationClock::new(0);
        let engine = default_engine(&clock);
        engine.start(&clock);
        clock.advance_ms(60_000);
        engine.tick(&clock);
        engine.reset(&clock);
        assert_eq!(engine.remaining_seconds(), 300);
        assert_eq!(engine.status(), TimerStatus::Stopped);
    }

    #[test]
    fn wire_to_event_bus_recibe_coins_de_gift_events() {
        use crate::event_bus::EventBus;
        use crate::logging::InMemoryLogger;
        use std::sync::Arc;

        let clock = Arc::new(SimulationClock::new(0));
        let bus = EventBus::new(Arc::new(InMemoryLogger::new()));
        let engine = Arc::new(default_engine(clock.as_ref()));
        wire_to_event_bus(engine.clone(), &bus, clock.clone());

        bus.publish(crate::contracts::AppEvent::Gift(crate::contracts::GiftEvent {
            id: "evt_1".to_string(),
            timestamp: 0,
            session_id: "live_1".to_string(),
            source: crate::contracts::EventSource::Simulation,
            user: crate::contracts::User {
                id: "u1".to_string(),
                username: "u1".to_string(),
                display_name: "U1".to_string(),
                avatar_url: None,
            },
            metadata: None,
            gift: crate::contracts::Gift {
                id: "5655".to_string(),
                name: "Rosa".to_string(),
                coins: 1,
                image_url: None,
                region: "CO".to_string(),
            },
            quantity: 20,
            total_coins: 20,
            repeat_end: true,
        }));

        // 20 total_coins / 10 coins_per_second = 2 segundos más
        assert_eq!(engine.remaining_seconds(), 302);
    }
}