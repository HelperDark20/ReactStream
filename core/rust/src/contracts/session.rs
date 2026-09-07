//! Contratos de Live Session Manager, Ranking Engine, Best Gift y Timer
//! (Secciones 8, 14, 15, 16). Equivalente Rust de los tipos correspondientes
//! en `@reactstream/types`.

use super::events::{Gift, User};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum SessionStatus {
    NoSession,
    Active,
    Ending,
    Completed,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct BestGift {
    pub gift: Gift,
    pub sender: User,
    /// Valor unitario del regalo (gift.coins), NUNCA totalCoins del evento (Regla #31).
    pub coins: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LiveSession {
    pub id: String,
    pub tiktok_user_id: String,
    pub tiktok_username: String,
    pub started_at: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ended_at: Option<u64>,
    pub duration_seconds: u64,
    pub status: SessionStatus,
    pub max_viewers: u64,
    pub total_likes: u64,
    pub total_coins: u64,
    pub total_gifts: u64,
    pub total_follows: u64,
    pub total_shares: u64,
    pub total_comments: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub best_gift: Option<BestGift>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DonorRankingEntry {
    pub user: User,
    pub coins: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TapRankingEntry {
    pub user: User,
    pub likes: u64,
}

/// 2, 3, 5, 10, 20 son los únicos valores válidos de Top N (Sección 10/20).
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(try_from = "u8", into = "u8")]
pub enum RankingTopN {
    Two,
    Three,
    Five,
    Ten,
    Twenty,
}

impl TryFrom<u8> for RankingTopN {
    type Error = String;
    fn try_from(value: u8) -> Result<Self, Self::Error> {
        match value {
            2 => Ok(RankingTopN::Two),
            3 => Ok(RankingTopN::Three),
            5 => Ok(RankingTopN::Five),
            10 => Ok(RankingTopN::Ten),
            20 => Ok(RankingTopN::Twenty),
            other => Err(format!("Top N inválido: {other} (válidos: 2, 3, 5, 10, 20)")),
        }
    }
}

impl From<RankingTopN> for u8 {
    fn from(value: RankingTopN) -> Self {
        match value {
            RankingTopN::Two => 2,
            RankingTopN::Three => 3,
            RankingTopN::Five => 5,
            RankingTopN::Ten => 10,
            RankingTopN::Twenty => 20,
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TimerState {
    pub remaining_seconds: u64,
    pub initial_seconds: u64,
    pub coins_per_second: u64,
    pub running: bool,
}

/// Configuración persistente del timer (Sección 21 + decisión adicional).
/// Los 3 campos se CONGELAN durante LIVE (Regla #71).
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TimerSettings {
    pub initial_seconds: u64,
    pub coins_per_second: u64,
    /// Decisión adicional: si un regalo llega tras TIMER_ZERO, ¿se reactiva
    /// automáticamente (running=true)? Default: true.
    pub reactivate_on_zero: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct OverlayState {
    pub overlay_id: String,
    pub visible: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_id: Option<String>,
    pub data: serde_json::Value,
}

// ============================================================
// ESTADOS DEL SISTEMA (Sección 28)
// ============================================================

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ApplicationState {
    Starting,
    Ready,
    Connecting,
    Connected,
    Live,
    Reconnecting,
    LiveEnded,
    Degraded,
    Error,
    ShuttingDown,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum TikTokConnectionState {
    Disconnected,
    Connecting,
    Connected,
    Reconnecting,
    Error,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum BridgeState {
    Stopped,
    Starting,
    Running,
    Disconnected,
    Reconnecting,
    Error,
    Stopping,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum KeyStrokeStatus {
    Idle,
    Queued,
    Running,
    Waiting,
    Completed,
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum AudioStatus {
    Queued,
    Playing,
    Completed,
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum TimerStatus {
    Stopped,
    Running,
    Zero,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum OverlayConnectionState {
    Disconnected,
    Connecting,
    Connected,
    Reconnecting,
    Error,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum DatabaseState {
    Uninitialized,
    Initializing,
    Ready,
    Degraded,
    Error,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum HealthState {
    Healthy,
    Degraded,
    Error,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ranking_top_n_solo_acepta_valores_validos() {
        assert!(RankingTopN::try_from(10).is_ok());
        assert!(RankingTopN::try_from(7).is_err());
    }

    #[test]
    fn timer_settings_serializa_camel_case() {
        let settings = TimerSettings {
            initial_seconds: 300,
            coins_per_second: 10,
            reactivate_on_zero: true,
        };
        let value = serde_json::to_value(settings).unwrap();
        assert_eq!(value["initialSeconds"], 300);
        assert_eq!(value["coinsPerSecond"], 10);
        assert_eq!(value["reactivateOnZero"], true);
    }

    #[test]
    fn session_status_serializa_screaming_snake_case() {
        let value = serde_json::to_value(SessionStatus::NoSession).unwrap();
        assert_eq!(value, "NO_SESSION");
    }
}
