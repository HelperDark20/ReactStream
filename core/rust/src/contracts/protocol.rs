//! Protocolos de comunicación (Sección 23: Bridge↔Core; Sección 17: Overlays).

use serde::{Deserialize, Serialize};

// ============================================================
// BRIDGE ↔ CORE (Sección 23)
// ============================================================

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum BridgeMessageType {
    Event,
    Command,
    Response,
    Error,
    Ping,
    Pong,
    Status,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct BridgeMessage {
    pub protocol_version: u32,
    pub message_id: String,
    pub message_type: BridgeMessageType,
    pub timestamp: u64,
    pub payload: serde_json::Value,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum BridgeCommandName {
    Connect,
    Disconnect,
    Reconnect,
    GetStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct BridgeCommandPayload {
    pub command: BridgeCommandName,
    /// Requerido solo para "connect".
    #[serde(skip_serializing_if = "Option::is_none")]
    pub username: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct BridgeErrorPayload {
    pub request_id: String,
    pub code: String,
    pub message: String,
    pub recoverable: bool,
}

// ============================================================
// OVERLAY ENGINE (Sección 17)
// ============================================================

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum OverlayMessageType {
    OverlayState,
    OverlayUpdate,
    OverlayShow,
    OverlayHide,
    OverlayReset,
    SessionStarted,
    SessionEnded,
    TimerUpdated,
    TimerZero,
    RankingUpdated,
    GiftReceived,
    LikesReceived,
    BestGiftUpdated,
    Ping,
    Pong,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct OverlayMessage {
    pub protocol_version: u32,
    pub message_id: String,
    pub message_type: OverlayMessageType,
    pub timestamp: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub overlay_id: Option<String>,
    pub payload: serde_json::Value,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bridge_message_serializa_snake_case_en_message_type() {
        let msg = BridgeMessage {
            protocol_version: 1,
            message_id: "msg_001".to_string(),
            message_type: BridgeMessageType::Command,
            timestamp: 1788300000000,
            payload: serde_json::json!({ "command": "connect", "username": "usuario_tiktok" }),
        };
        let value = serde_json::to_value(&msg).unwrap();
        assert_eq!(value["messageType"], "command");
        assert_eq!(value["protocolVersion"], 1);
    }
}
