//! Contratos de eventos (Sección 5 y 6). Equivalente Rust de
//! `@reactstream/events`. Serialización JSON en camelCase para mantener
//! compatibilidad exacta de wire format con TypeScript (Regla #14).
//!
//! DECISIÓN DE DISEÑO (idéntica a la tomada en TS): sin campo `payload`
//! genérico — cada evento aplana sus propios campos sobre el envelope.
//!
//! Nota de simplicidad (Regla #90): cada variante de evento repite los
//! campos base (id, timestamp, sessionId, source) en vez de usar
//! `#[serde(flatten)]` sobre un struct compartido, porque `user` cambia de
//! opcional a requerido según el tipo de evento y eso choca con flatten
//! (produciría una clave "user" duplicada). Repetir los campos es más
//! simple y explícito que resolver ese choque con genéricos.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct User {
    pub id: String,
    pub username: String,
    pub display_name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub avatar_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Gift {
    pub id: String,
    pub name: String,
    /// Valor de UNA unidad del regalo (Regla #28). NUNCA totalCoins.
    pub coins: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub image_url: Option<String>,
    pub region: String,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum EventSource {
    Tiktok,
    Simulation,
    System,
}

/// Discriminador liviano de tipo de evento — el Event Bus lo usa para
/// indexar suscripciones sin necesitar el AppEvent completo (Sección 9).
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum EventType {
    LiveStarted,
    LiveEnded,
    Gift,
    Like,
    Follow,
    Comment,
    Share,
    Member,
    ViewerCount,
    TimerZero,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct GiftEvent {
    pub id: String,
    pub timestamp: u64,
    pub session_id: String,
    pub source: EventSource,
    pub user: User,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<HashMap<String, serde_json::Value>>,
    pub gift: Gift,
    pub quantity: u64,
    /// = gift.coins * quantity (Regla #29). Rankings usan este campo (Regla #30).
    pub total_coins: u64,
    pub repeat_end: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LikeEvent {
    pub id: String,
    pub timestamp: u64,
    pub session_id: String,
    pub source: EventSource,
    pub user: User,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<HashMap<String, serde_json::Value>>,
    /// TikTok puede agrupar likes: NO asumir 1 evento = 1 like.
    pub count: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CommentEvent {
    pub id: String,
    pub timestamp: u64,
    pub session_id: String,
    pub source: EventSource,
    pub user: User,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<HashMap<String, serde_json::Value>>,
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct FollowEvent {
    pub id: String,
    pub timestamp: u64,
    pub session_id: String,
    pub source: EventSource,
    pub user: User,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ShareEvent {
    pub id: String,
    pub timestamp: u64,
    pub session_id: String,
    pub source: EventSource,
    pub user: User,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MemberEvent {
    pub id: String,
    pub timestamp: u64,
    pub session_id: String,
    pub source: EventSource,
    pub user: User,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LiveStartedEvent {
    pub id: String,
    pub timestamp: u64,
    pub session_id: String,
    pub source: EventSource,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user: Option<User>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LiveEndedEvent {
    pub id: String,
    pub timestamp: u64,
    pub session_id: String,
    pub source: EventSource,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user: Option<User>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TimerZeroEvent {
    pub id: String,
    pub timestamp: u64,
    pub session_id: String,
    pub source: EventSource,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user: Option<User>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ViewerCountEvent {
    pub id: String,
    pub timestamp: u64,
    pub session_id: String,
    pub source: EventSource,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user: Option<User>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<HashMap<String, serde_json::Value>>,
    pub count: u64,
}

/// Unión discriminada por `type` — Event Bus y Automation Engine trabajan sobre esto.
/// `#[serde(tag = "type")]` produce el mismo wire format que la unión
/// discriminada de TypeScript (un único objeto plano con la clave "type").
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum AppEvent {
    Gift(GiftEvent),
    Like(LikeEvent),
    Comment(CommentEvent),
    Follow(FollowEvent),
    Share(ShareEvent),
    Member(MemberEvent),
    LiveStarted(LiveStartedEvent),
    LiveEnded(LiveEndedEvent),
    TimerZero(TimerZeroEvent),
    ViewerCount(ViewerCountEvent),
}

impl AppEvent {
    /// Discriminador liviano de tipo — usado por el Event Bus para indexar
    /// suscripciones (Sección 9) sin necesitar un match completo del enum.
    pub fn event_type(&self) -> EventType {
        match self {
            AppEvent::Gift(_) => EventType::Gift,
            AppEvent::Like(_) => EventType::Like,
            AppEvent::Comment(_) => EventType::Comment,
            AppEvent::Follow(_) => EventType::Follow,
            AppEvent::Share(_) => EventType::Share,
            AppEvent::Member(_) => EventType::Member,
            AppEvent::LiveStarted(_) => EventType::LiveStarted,
            AppEvent::LiveEnded(_) => EventType::LiveEnded,
            AppEvent::TimerZero(_) => EventType::TimerZero,
            AppEvent::ViewerCount(_) => EventType::ViewerCount,
        }
    }

    /// Campos comunes del envelope, accesibles sin hacer match manual
    /// (Event Bus los necesita para validación/deduplicación, Sección 9).
    pub fn id(&self) -> &str {
        match self {
            AppEvent::Gift(e) => &e.id,
            AppEvent::Like(e) => &e.id,
            AppEvent::Comment(e) => &e.id,
            AppEvent::Follow(e) => &e.id,
            AppEvent::Share(e) => &e.id,
            AppEvent::Member(e) => &e.id,
            AppEvent::LiveStarted(e) => &e.id,
            AppEvent::LiveEnded(e) => &e.id,
            AppEvent::TimerZero(e) => &e.id,
            AppEvent::ViewerCount(e) => &e.id,
        }
    }

    pub fn session_id(&self) -> &str {
        match self {
            AppEvent::Gift(e) => &e.session_id,
            AppEvent::Like(e) => &e.session_id,
            AppEvent::Comment(e) => &e.session_id,
            AppEvent::Follow(e) => &e.session_id,
            AppEvent::Share(e) => &e.session_id,
            AppEvent::Member(e) => &e.session_id,
            AppEvent::LiveStarted(e) => &e.session_id,
            AppEvent::LiveEnded(e) => &e.session_id,
            AppEvent::TimerZero(e) => &e.session_id,
            AppEvent::ViewerCount(e) => &e.session_id,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Etapa 1 — Contract tests: los mismos fixtures JSON que consume
    /// packages/events/src/index.test.ts deben deserializar correctamente
    /// aquí, confirmando que TS y Rust comparten wire format (Regla #14).
    fn fixtures_dir() -> std::path::PathBuf {
        std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../../tests/fixtures/events")
    }

    fn load_fixture(name: &str) -> String {
        std::fs::read_to_string(fixtures_dir().join(name))
            .unwrap_or_else(|e| panic!("no se pudo leer fixture {name}: {e}"))
    }

    #[test]
    fn gift_fixture_deserializa_correctamente() {
        let json = load_fixture("gift.json");
        let event: AppEvent = serde_json::from_str(&json).expect("deserializar gift.json");
        match event {
            AppEvent::Gift(g) => {
                assert_eq!(g.session_id, "live_test_session_001");
                assert_eq!(g.gift.coins, 1); // Regla #28
                assert_eq!(g.quantity, 10);
                assert_eq!(g.total_coins, g.gift.coins * g.quantity); // Regla #29
                assert_eq!(g.user.id, "123456789");
            }
            other => panic!("se esperaba AppEvent::Gift, llegó {other:?}"),
        }
    }

    #[test]
    fn like_fixture_deserializa_correctamente() {
        let json = load_fixture("like.json");
        let event: AppEvent = serde_json::from_str(&json).expect("deserializar like.json");
        match event {
            AppEvent::Like(l) => {
                assert!(l.count > 1); // agrupado, no 1 evento = 1 like
                assert_eq!(l.user.username, "maria");
            }
            other => panic!("se esperaba AppEvent::Like, llegó {other:?}"),
        }
    }

    #[test]
    fn live_started_fixture_deserializa_correctamente() {
        let json = load_fixture("live_started.json");
        let event: AppEvent =
            serde_json::from_str(&json).expect("deserializar live_started.json");
        match event {
            AppEvent::LiveStarted(e) => {
                assert_eq!(e.session_id, "live_test_session_001");
                assert!(e.user.is_none());
            }
            other => panic!("se esperaba AppEvent::LiveStarted, llegó {other:?}"),
        }
    }

    #[test]
    fn gift_event_round_trip_serializa_camel_case() {
        let json = load_fixture("gift.json");
        let event: AppEvent = serde_json::from_str(&json).unwrap();
        let value: serde_json::Value = serde_json::to_value(&event).unwrap();
        // Confirma que la serialización usa las mismas claves camelCase que TS.
        assert!(value.get("sessionId").is_some());
        assert!(value.get("totalCoins").is_some());
        assert!(value.get("repeatEnd").is_some());
        assert_eq!(value.get("type").and_then(|v| v.as_str()), Some("gift"));
    }

    #[test]
    fn event_type_discrimina_correctamente_cada_variante() {
        let gift = load_fixture("gift.json");
        let gift_event: AppEvent = serde_json::from_str(&gift).unwrap();
        assert_eq!(gift_event.event_type(), EventType::Gift);

        let like = load_fixture("like.json");
        let like_event: AppEvent = serde_json::from_str(&like).unwrap();
        assert_eq!(like_event.event_type(), EventType::Like);

        let live_started = load_fixture("live_started.json");
        let live_started_event: AppEvent = serde_json::from_str(&live_started).unwrap();
        assert_eq!(live_started_event.event_type(), EventType::LiveStarted);
    }
}
