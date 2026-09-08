//! Event Bus (Sección 9). Regla #23: distribuye eventos, NO ejecuta lógica
//! de negocio (eso vive en los Business Engines que se suscriben). Regla
//! #15-16: cada evento tiene ID único, duplicados se ignoran. Regla #17-18:
//! sessionId separa sesiones completamente; eventos de sesión vieja se
//! ignoran. Regla #46: máximo 1000 eventos pendientes. Regla #51: un error
//! (panic) de un consumidor no debe tumbar el bus ni a otros consumidores.
//! Regla #67: Simulation usa exactamente este mismo bus, sin camino aparte.
//!
//! Decisión de diseño: `enqueue` (valida + encola) y `dispatch_pending`
//! (despacha lo encolado) son métodos separados a propósito. `publish` es
//! el atajo síncrono más común (Simulation, tests), pero la separación deja
//! el camino libre para que, más adelante, el Bridge encole desde su propia
//! tarea async y un loop separado despache — misma cola, dos consumidores
//! posibles, sin tener que rediseñar nada.

use crate::clock::ProductionClock;
use crate::contracts::{AppEvent, EventType};
use crate::logging::{LogEntry, LogLevel, Logger};
use std::collections::{HashMap, HashSet, VecDeque};
use std::panic::AssertUnwindSafe;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex, RwLock};

/// Máximo de eventos pendientes en cola (Regla #46).
pub const MAX_PENDING_EVENTS: usize = 1000;

pub type EventHandler = dyn Fn(&AppEvent) + Send + Sync;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct SubscriptionId(u64);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PublishOutcome {
    Enqueued,
    /// Regla #16: duplicados se ignoran (mismo `id`).
    Duplicate,
    /// Regla #18: evento de una sesión distinta a la activa.
    StaleSession,
    /// Regla #46: cola llena, evento descartado.
    QueueFull,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct DispatchStats {
    pub dispatched: usize,
    pub consumer_panics: usize,
}

struct Subscription {
    id: SubscriptionId,
    handler: Arc<EventHandler>,
}

pub struct EventBus {
    subscribers: RwLock<HashMap<EventType, Vec<Subscription>>>,
    /// `None` = sin sesión activa todavía; en ese caso NO se filtra por
    /// sessionId (útil antes del primer LIVE_STARTED y en tests). Quien
    /// gestiona el ciclo de vida de la sesión (Etapa 5) es responsable de
    /// llamar `set_active_session` — el Event Bus no decide esto por sí
    /// mismo (Regla #23: no ejecuta lógica de negocio).
    active_session: RwLock<Option<String>>,
    seen_ids: RwLock<HashSet<String>>,
    queue: Mutex<VecDeque<AppEvent>>,
    next_subscription_id: AtomicU64,
    logger: Arc<dyn Logger>,
}

impl EventBus {
    pub fn new(logger: Arc<dyn Logger>) -> Self {
        Self {
            subscribers: RwLock::new(HashMap::new()),
            active_session: RwLock::new(None),
            seen_ids: RwLock::new(HashSet::new()),
            queue: Mutex::new(VecDeque::new()),
            next_subscription_id: AtomicU64::new(1),
            logger,
        }
    }

    /// Regla #17: sessionId separa completamente cada LIVE — cambiar de
    /// sesión limpia el set de deduplicación (cada LIVE es independiente).
    pub fn set_active_session(&self, session_id: Option<String>) {
        *self.active_session.write().expect("lock envenenado") = session_id;
        self.seen_ids.write().expect("lock envenenado").clear();
    }

    pub fn subscribe(&self, event_type: EventType, handler: Arc<EventHandler>) -> SubscriptionId {
        let id = SubscriptionId(self.next_subscription_id.fetch_add(1, Ordering::SeqCst));
        self.subscribers
            .write()
            .expect("lock envenenado")
            .entry(event_type)
            .or_default()
            .push(Subscription { id, handler });
        id
    }

    pub fn unsubscribe(&self, id: SubscriptionId) {
        let mut subs = self.subscribers.write().expect("lock envenenado");
        for handlers in subs.values_mut() {
            handlers.retain(|s| s.id != id);
        }
    }

    pub fn pending_count(&self) -> usize {
        self.queue.lock().expect("lock envenenado").len()
    }

    /// Valida (sesión + duplicados + capacidad) y encola. NO despacha a los
    /// consumidores — para eso está `dispatch_pending`.
    pub fn enqueue(&self, event: AppEvent) -> PublishOutcome {
        {
            let active = self.active_session.read().expect("lock envenenado");
            if let Some(active_id) = active.as_ref() {
                if event.session_id() != active_id.as_str() {
                    return PublishOutcome::StaleSession;
                }
            }
        }

        let mut seen = self.seen_ids.write().expect("lock envenenado");
        if seen.contains(event.id()) {
            return PublishOutcome::Duplicate;
        }

        let mut queue = self.queue.lock().expect("lock envenenado");
        if queue.len() >= MAX_PENDING_EVENTS {
            self.logger.log(LogEntry::new(
                &ProductionClock,
                LogLevel::Error,
                "event_bus",
                "cola llena: evento descartado (límite de 1000 pendientes, Regla #46)",
            ));
            return PublishOutcome::QueueFull;
        }

        seen.insert(event.id().to_string());
        queue.push_back(event);
        PublishOutcome::Enqueued
    }

    /// Atajo síncrono: encola y despacha inmediatamente. Es lo que usan
    /// Simulation y la mayoría de los tests.
    pub fn publish(&self, event: AppEvent) -> PublishOutcome {
        let outcome = self.enqueue(event);
        if outcome == PublishOutcome::Enqueued {
            self.dispatch_pending();
        }
        outcome
    }

    /// Despacha todo lo que haya en cola a sus suscriptores. Regla #51: un
    /// panic de un consumidor se aísla vía `catch_unwind` — no detiene a
    /// los demás consumidores ni al bus.
    pub fn dispatch_pending(&self) -> DispatchStats {
        let mut stats = DispatchStats::default();
        loop {
            let event = {
                let mut queue = self.queue.lock().expect("lock envenenado");
                queue.pop_front()
            };
            let Some(event) = event else { break };

            let event_type = event.event_type();
            let handlers: Vec<Arc<EventHandler>> = {
                let subs = self.subscribers.read().expect("lock envenenado");
                subs.get(&event_type)
                    .map(|v| v.iter().map(|s| s.handler.clone()).collect())
                    .unwrap_or_default()
            };

            for handler in handlers {
                let result = std::panic::catch_unwind(AssertUnwindSafe(|| handler(&event)));
                stats.dispatched += 1;
                if result.is_err() {
                    stats.consumer_panics += 1;
                    self.logger.log(LogEntry::new(
                        &ProductionClock,
                        LogLevel::Error,
                        "event_bus",
                        "un consumidor entró en pánico; aislado, el bus continúa (Regla #51)",
                    ));
                }
            }
        }
        stats
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::logging::InMemoryLogger;
    use std::sync::atomic::AtomicUsize;

    fn test_gift_event(id: &str, session_id: &str) -> AppEvent {
        crate::contracts::AppEvent::Gift(crate::contracts::GiftEvent {
            id: id.to_string(),
            timestamp: 0,
            session_id: session_id.to_string(),
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
                name: "Rose".to_string(),
                coins: 1,
                image_url: None,
                region: "CO".to_string(),
            },
            quantity: 1,
            total_coins: 1,
            repeat_end: true,
        })
    }

    #[test]
    fn dispara_solo_a_suscriptores_del_tipo_correcto() {
        let bus = EventBus::new(Arc::new(InMemoryLogger::new()));
        let gift_calls = Arc::new(AtomicUsize::new(0));
        let like_calls = Arc::new(AtomicUsize::new(0));

        let gift_calls_clone = gift_calls.clone();
        bus.subscribe(
            EventType::Gift,
            Arc::new(move |_e| {
                gift_calls_clone.fetch_add(1, Ordering::SeqCst);
            }),
        );
        let like_calls_clone = like_calls.clone();
        bus.subscribe(
            EventType::Like,
            Arc::new(move |_e| {
                like_calls_clone.fetch_add(1, Ordering::SeqCst);
            }),
        );

        let outcome = bus.publish(test_gift_event("evt_1", "live_1"));
        assert_eq!(outcome, PublishOutcome::Enqueued);
        assert_eq!(gift_calls.load(Ordering::SeqCst), 1);
        assert_eq!(like_calls.load(Ordering::SeqCst), 0);
    }

    #[test]
    fn eventos_duplicados_se_ignoran() {
        let bus = EventBus::new(Arc::new(InMemoryLogger::new()));
        let calls = Arc::new(AtomicUsize::new(0));
        let calls_clone = calls.clone();
        bus.subscribe(
            EventType::Gift,
            Arc::new(move |_e| {
                calls_clone.fetch_add(1, Ordering::SeqCst);
            }),
        );

        assert_eq!(
            bus.publish(test_gift_event("evt_dup", "live_1")),
            PublishOutcome::Enqueued
        );
        assert_eq!(
            bus.publish(test_gift_event("evt_dup", "live_1")),
            PublishOutcome::Duplicate
        );
        assert_eq!(calls.load(Ordering::SeqCst), 1);
    }

    #[test]
    fn evento_de_sesion_vieja_se_rechaza() {
        let bus = EventBus::new(Arc::new(InMemoryLogger::new()));
        bus.set_active_session(Some("live_actual".to_string()));

        let outcome = bus.publish(test_gift_event("evt_1", "live_vieja"));
        assert_eq!(outcome, PublishOutcome::StaleSession);
        assert_eq!(bus.pending_count(), 0);
    }

    #[test]
    fn cambiar_de_sesion_limpia_la_deduplicacion() {
        let bus = EventBus::new(Arc::new(InMemoryLogger::new()));
        bus.set_active_session(Some("live_1".to_string()));
        assert_eq!(
            bus.publish(test_gift_event("evt_1", "live_1")),
            PublishOutcome::Enqueued
        );

        // Nueva sesión: el mismo id ya no debería considerarse duplicado.
        bus.set_active_session(Some("live_2".to_string()));
        assert_eq!(
            bus.publish(test_gift_event("evt_1", "live_2")),
            PublishOutcome::Enqueued
        );
    }

    #[test]
    fn cola_llena_rechaza_eventos_nuevos() {
        let bus = EventBus::new(Arc::new(InMemoryLogger::new()));
        for i in 0..MAX_PENDING_EVENTS {
            let outcome = bus.enqueue(test_gift_event(&format!("evt_{i}"), "live_1"));
            assert_eq!(outcome, PublishOutcome::Enqueued);
        }
        assert_eq!(bus.pending_count(), MAX_PENDING_EVENTS);

        let overflow = bus.enqueue(test_gift_event("evt_overflow", "live_1"));
        assert_eq!(overflow, PublishOutcome::QueueFull);
        assert_eq!(bus.pending_count(), MAX_PENDING_EVENTS);
    }

    #[test]
    fn panic_de_un_consumidor_no_afecta_a_los_demas() {
        // NOTA: Rust imprime el mensaje de panic capturado en la salida del
        // test aunque el test pase — es esperado, no un fallo real.
        let bus = EventBus::new(Arc::new(InMemoryLogger::new()));
        let second_called = Arc::new(AtomicUsize::new(0));
        let second_called_clone = second_called.clone();

        bus.subscribe(
            EventType::Gift,
            Arc::new(|_e| panic!("consumidor roto a propósito para la prueba")),
        );
        bus.subscribe(
            EventType::Gift,
            Arc::new(move |_e| {
                second_called_clone.fetch_add(1, Ordering::SeqCst);
            }),
        );

        bus.enqueue(test_gift_event("evt_1", "live_1"));
        let stats = bus.dispatch_pending();

        assert_eq!(stats.dispatched, 2);
        assert_eq!(stats.consumer_panics, 1);
        assert_eq!(second_called.load(Ordering::SeqCst), 1);
    }

    #[test]
    fn unsubscribe_detiene_las_notificaciones_futuras() {
        let bus = EventBus::new(Arc::new(InMemoryLogger::new()));
        let calls = Arc::new(AtomicUsize::new(0));
        let calls_clone = calls.clone();
        let sub_id = bus.subscribe(
            EventType::Gift,
            Arc::new(move |_e| {
                calls_clone.fetch_add(1, Ordering::SeqCst);
            }),
        );

        bus.publish(test_gift_event("evt_1", "live_1"));
        bus.unsubscribe(sub_id);
        bus.publish(test_gift_event("evt_2", "live_1"));

        assert_eq!(calls.load(Ordering::SeqCst), 1);
    }

    #[test]
    fn sin_sesion_activa_no_filtra_por_session_id() {
        // Antes del primer LIVE_STARTED (o en tests/Simulation sin wiring
        // de Session Manager) el bus acepta cualquier sessionId.
        let bus = EventBus::new(Arc::new(InMemoryLogger::new()));
        let outcome = bus.publish(test_gift_event("evt_1", "cualquier_sesion"));
        assert_eq!(outcome, PublishOutcome::Enqueued);
    }
}
