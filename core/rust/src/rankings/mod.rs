//! Ranking Engine (Sección 15) y Best Gift Engine (Sección 16).

pub mod best_gift;

use crate::contracts::{AppEvent, DonorRankingEntry, EventType, TapRankingEntry, User};
use crate::event_bus::EventBus;
use std::collections::HashMap;
use std::sync::{Arc, RwLock};

pub struct RankingEngine {
    donors: RwLock<HashMap<String, DonorRankingEntry>>,
    tappers: RwLock<HashMap<String, TapRankingEntry>>,
    donor_top_n: RwLock<usize>,
    tap_top_n: RwLock<usize>,
}

impl RankingEngine {
    pub fn new(donor_top_n: usize, tap_top_n: usize) -> Self {
        Self {
            donors: RwLock::new(HashMap::new()),
            tappers: RwLock::new(HashMap::new()),
            donor_top_n: RwLock::new(donor_top_n),
            tap_top_n: RwLock::new(tap_top_n),
        }
    }

    pub fn reset(&self) {
        self.donors.write().expect("lock envenenado").clear();
        self.tappers.write().expect("lock envenenado").clear();
    }

    /// Regla #72: Top N cambia en caliente sin perder datos acumulados.
    pub fn set_donor_top_n(&self, n: usize) {
        *self.donor_top_n.write().expect("lock envenenado") = n;
    }

    pub fn set_tap_top_n(&self, n: usize) {
        *self.tap_top_n.write().expect("lock envenenado") = n;
    }

    pub fn add_gift(&self, user: &User, total_coins: u64) {
        let mut donors = self.donors.write().expect("lock envenenado");
        let entry = donors.entry(user.id.clone()).or_insert_with(|| DonorRankingEntry {
            user: user.clone(),
            coins: 0,
        });
        entry.coins += total_coins;
    }

    pub fn add_likes(&self, user: &User, count: u64) {
        let mut tappers = self.tappers.write().expect("lock envenenado");
        let entry = tappers.entry(user.id.clone()).or_insert_with(|| TapRankingEntry {
            user: user.clone(),
            likes: 0,
        });
        entry.likes += count;
    }

    /// Devuelve el Top N de donors ordenado por coins descendente.
    pub fn top_donors(&self) -> Vec<DonorRankingEntry> {
        let n = *self.donor_top_n.read().expect("lock envenenado");
        let donors = self.donors.read().expect("lock envenenado");
        let mut sorted: Vec<DonorRankingEntry> = donors.values().cloned().collect();
        sorted.sort_by(|a, b| b.coins.cmp(&a.coins));
        sorted.truncate(n);
        sorted
    }

    /// Devuelve el Top N de tappers ordenado por likes descendente.
    pub fn top_tappers(&self) -> Vec<TapRankingEntry> {
        let n = *self.tap_top_n.read().expect("lock envenenado");
        let tappers = self.tappers.read().expect("lock envenenado");
        let mut sorted: Vec<TapRankingEntry> = tappers.values().cloned().collect();
        sorted.sort_by(|a, b| b.likes.cmp(&a.likes));
        sorted.truncate(n);
        sorted
    }
}

pub fn wire_to_event_bus(engine: Arc<RankingEngine>, bus: &EventBus) {
    let engine_gift = engine.clone();
    bus.subscribe(
        EventType::Gift,
        Arc::new(move |event: &AppEvent| {
            if let AppEvent::Gift(g) = event {
                engine_gift.add_gift(&g.user, g.total_coins);
            }
        }),
    );

    let engine_like = engine.clone();
    bus.subscribe(
        EventType::Like,
        Arc::new(move |event: &AppEvent| {
            if let AppEvent::Like(l) = event {
                engine_like.add_likes(&l.user, l.count);
            }
        }),
    );
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::contracts::{EventSource, Gift, GiftEvent, LikeEvent, User};

    fn user(id: &str) -> User {
        User {
            id: id.to_string(),
            username: id.to_string(),
            display_name: id.to_string(),
            avatar_url: None,
        }
    }

    #[test]
    fn top_donors_ordena_por_coins_descendente() {
        let engine = RankingEngine::new(10, 10);
        engine.add_gift(&user("alice"), 500);
        engine.add_gift(&user("bob"), 1000);
        engine.add_gift(&user("alice"), 200);

        let top = engine.top_donors();
        assert_eq!(top[0].user.id, "bob");
        assert_eq!(top[0].coins, 1000);
        assert_eq!(top[1].user.id, "alice");
        assert_eq!(top[1].coins, 700);
    }

    #[test]
    fn top_tappers_ordena_por_likes_descendente() {
        let engine = RankingEngine::new(10, 10);
        engine.add_likes(&user("maria"), 50);
        engine.add_likes(&user("carlos"), 200);
        engine.add_likes(&user("maria"), 100);

        let top = engine.top_tappers();
        assert_eq!(top[0].user.id, "carlos");
        assert_eq!(top[0].likes, 200);
        assert_eq!(top[1].user.id, "maria");
        assert_eq!(top[1].likes, 150);
    }

    #[test]
    fn top_n_limita_resultados_correctamente() {
        let engine = RankingEngine::new(3, 3);
        for i in 0..10u64 {
            engine.add_gift(&user(&format!("user_{i}")), i * 100);
        }
        assert_eq!(engine.top_donors().len(), 3);
    }

    #[test]
    fn set_top_n_cambia_en_caliente_sin_perder_datos() {
        let engine = RankingEngine::new(3, 3);
        for i in 0..5u64 {
            engine.add_gift(&user(&format!("u{i}")), (i + 1) * 100);
        }
        assert_eq!(engine.top_donors().len(), 3);
        engine.set_donor_top_n(5);
        assert_eq!(engine.top_donors().len(), 5);
    }

    #[test]
    fn reset_limpia_todos_los_datos() {
        let engine = RankingEngine::new(10, 10);
        engine.add_gift(&user("alice"), 500);
        engine.add_likes(&user("bob"), 100);
        engine.reset();
        assert!(engine.top_donors().is_empty());
        assert!(engine.top_tappers().is_empty());
    }

    #[test]
    fn wire_to_event_bus_acumula_donors_y_tappers() {
        use crate::event_bus::EventBus;
        use crate::logging::InMemoryLogger;

        let bus = EventBus::new(Arc::new(InMemoryLogger::new()));
        let engine = Arc::new(RankingEngine::new(10, 10));
        wire_to_event_bus(engine.clone(), &bus);

        bus.publish(AppEvent::Gift(GiftEvent {
            id: "evt_1".to_string(),
            timestamp: 0,
            session_id: "live_1".to_string(),
            source: EventSource::Simulation,
            user: user("alice"),
            metadata: None,
            gift: Gift {
                id: "5655".to_string(),
                name: "Rosa".to_string(),
                coins: 1,
                image_url: None,
                region: "CO".to_string(),
            },
            quantity: 10,
            total_coins: 10,
            repeat_end: true,
        }));

        bus.publish(AppEvent::Like(LikeEvent {
            id: "evt_2".to_string(),
            timestamp: 0,
            session_id: "live_1".to_string(),
            source: EventSource::Simulation,
            user: user("bob"),
            metadata: None,
            count: 25,
        }));

        assert_eq!(engine.top_donors()[0].coins, 10);
        assert_eq!(engine.top_tappers()[0].likes, 25);
    }
}