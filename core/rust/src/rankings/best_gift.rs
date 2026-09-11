//! Best Gift Engine (Sección 16). Motor independiente del Session Manager
//! para que el Overlay Engine (Etapa 14) pueda consultar el mejor regalo
//! directamente. Regla #31: compara gift.coins (valor UNITARIO), NUNCA
//! totalCoins del evento.

use crate::contracts::{AppEvent, BestGift, EventType, Gift, User};
use crate::event_bus::EventBus;
use std::sync::{Arc, RwLock};

pub struct BestGiftEngine {
    current: RwLock<Option<BestGift>>,
}

impl BestGiftEngine {
    pub fn new() -> Self {
        Self {
            current: RwLock::new(None),
        }
    }

    pub fn reset(&self) {
        *self.current.write().expect("lock envenenado") = None;
    }

    pub fn process_gift(&self, gift: &Gift, sender: &User) {
        let mut guard = self.current.write().expect("lock envenenado");
        let is_better = match guard.as_ref() {
            None => true,
            // Regla #31: comparar gift.coins (unitario), no totalCoins
            Some(current) => gift.coins > current.coins,
        };
        if is_better {
            *guard = Some(BestGift {
                gift: gift.clone(),
                sender: sender.clone(),
                coins: gift.coins,
            });
        }
    }

    pub fn current(&self) -> Option<BestGift> {
        self.current.read().expect("lock envenenado").clone()
    }
}

impl Default for BestGiftEngine {
    fn default() -> Self {
        Self::new()
    }
}

pub fn wire_to_event_bus(engine: Arc<BestGiftEngine>, bus: &EventBus) {
    bus.subscribe(
        EventType::Gift,
        Arc::new(move |event: &AppEvent| {
            if let AppEvent::Gift(g) = event {
                engine.process_gift(&g.gift, &g.user);
            }
        }),
    );
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::contracts::{EventSource, GiftEvent, LikeEvent, User};

    fn user(id: &str) -> User {
        User {
            id: id.to_string(),
            username: id.to_string(),
            display_name: id.to_string(),
            avatar_url: None,
        }
    }

    fn gift(id: &str, coins: u64) -> Gift {
        Gift {
            id: id.to_string(),
            name: id.to_string(),
            coins,
            image_url: None,
            region: "CO".to_string(),
        }
    }

    #[test]
    fn sin_regalos_current_es_none() {
        let engine = BestGiftEngine::new();
        assert!(engine.current().is_none());
    }

    #[test]
    fn primer_regalo_siempre_se_convierte_en_best() {
        let engine = BestGiftEngine::new();
        engine.process_gift(&gift("rosa", 1), &user("alice"));
        assert_eq!(engine.current().unwrap().gift.id, "rosa");
    }

    #[test]
    fn regla_31_compara_valor_unitario_no_total_coins() {
        // Rose x100 (coins=1, totalCoins=100) pierde contra Lion x1
        // (coins=500) porque se compara gift.coins, no totalCoins.
        let engine = BestGiftEngine::new();
        engine.process_gift(&gift("rose", 1), &user("alice")); // unitario=1
        engine.process_gift(&gift("lion", 500), &user("bob")); // unitario=500
        assert_eq!(engine.current().unwrap().gift.id, "lion");
        assert_eq!(engine.current().unwrap().coins, 500);
    }

    #[test]
    fn regalo_menor_no_desplaza_al_best() {
        let engine = BestGiftEngine::new();
        engine.process_gift(&gift("lion", 500), &user("alice"));
        engine.process_gift(&gift("rose", 1), &user("bob"));
        assert_eq!(engine.current().unwrap().gift.id, "lion");
    }

    #[test]
    fn reset_limpia_el_best_gift() {
        let engine = BestGiftEngine::new();
        engine.process_gift(&gift("lion", 500), &user("alice"));
        engine.reset();
        assert!(engine.current().is_none());
    }

    #[test]
    fn wire_to_event_bus_procesa_gift_events() {
        use crate::event_bus::EventBus;
        use crate::logging::InMemoryLogger;

        let bus = EventBus::new(Arc::new(InMemoryLogger::new()));
        let engine = Arc::new(BestGiftEngine::new());
        wire_to_event_bus(engine.clone(), &bus);

        bus.publish(AppEvent::Gift(GiftEvent {
            id: "evt_1".to_string(),
            timestamp: 0,
            session_id: "live_1".to_string(),
            source: EventSource::Simulation,
            user: user("sender"),
            metadata: None,
            gift: gift("lion", 500),
            quantity: 1,
            total_coins: 500,
            repeat_end: true,
        }));

        let best = engine.current().unwrap();
        assert_eq!(best.gift.id, "lion");
        assert_eq!(best.coins, 500);
    }

    #[test]
    fn like_events_no_afectan_el_best_gift() {
        use crate::event_bus::EventBus;
        use crate::logging::InMemoryLogger;

        let bus = EventBus::new(Arc::new(InMemoryLogger::new()));
        let engine = Arc::new(BestGiftEngine::new());
        wire_to_event_bus(engine.clone(), &bus);

        bus.publish(AppEvent::Like(LikeEvent {
            id: "evt_like".to_string(),
            timestamp: 0,
            session_id: "live_1".to_string(),
            source: EventSource::Simulation,
            user: user("u1"),
            metadata: None,
            count: 100,
        }));

        assert!(engine.current().is_none());
    }
}