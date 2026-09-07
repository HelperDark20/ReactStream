//! Contratos de Automation/Action Engine (Sección 10-13). Equivalente Rust
//! de los tipos de `@reactstream/types` relacionados a automatizaciones.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ConditionOperator {
    Equals,
    NotEquals,
    GreaterThan,
    GreaterOrEqual,
    LessThan,
    LessOrEqual,
    Contains,
    StartsWith,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(untagged)]
pub enum ConditionValue {
    String(String),
    Number(f64),
    Bool(bool),
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Condition {
    pub id: String,
    pub field: String,
    pub operator: ConditionOperator,
    pub value: ConditionValue,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum ConditionLogic {
    #[serde(rename = "AND")]
    And,
    #[serde(rename = "OR")]
    Or,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ConditionGroup {
    pub id: String,
    pub logic: ConditionLogic,
    pub conditions: Vec<Condition>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub groups: Option<Vec<ConditionGroup>>,
}

/// Triggers soportados (Sección 10) — todos los EventType menos viewer_count.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TriggerEventType {
    Gift,
    Like,
    Follow,
    Comment,
    Share,
    Member,
    TimerZero,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Trigger {
    #[serde(rename = "type")]
    pub event_type: TriggerEventType,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CooldownConfig {
    pub global_ms: u64,
    pub per_user_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct KeyStrokeStep {
    pub keys: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration_ms: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub interval_ms: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PlaySoundConfig {
    pub sound_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub volume: Option<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct KeyStrokeActionConfig {
    pub sequence: Vec<KeyStrokeStep>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct OverlayActionConfig {
    pub overlay_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct WaitActionConfig {
    pub duration_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AddTimerActionConfig {
    pub seconds: u64,
}

/// Acciones ejecutables (Sección 11). Regla #34: son datos, nunca código
/// ejecutable — por eso este enum solo transporta configuración, jamás closures.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Action {
    #[serde(rename_all = "camelCase")]
    PlaySound {
        id: String,
        sort_order: u32,
        repeat_count: u32,
        repeat_interval_ms: u64,
        config: PlaySoundConfig,
    },
    #[serde(rename_all = "camelCase")]
    Keystroke {
        id: String,
        sort_order: u32,
        repeat_count: u32,
        repeat_interval_ms: u64,
        config: KeyStrokeActionConfig,
    },
    #[serde(rename_all = "camelCase")]
    ShowOverlay {
        id: String,
        sort_order: u32,
        repeat_count: u32,
        repeat_interval_ms: u64,
        config: OverlayActionConfig,
    },
    #[serde(rename_all = "camelCase")]
    HideOverlay {
        id: String,
        sort_order: u32,
        repeat_count: u32,
        repeat_interval_ms: u64,
        config: OverlayActionConfig,
    },
    #[serde(rename_all = "camelCase")]
    Wait {
        id: String,
        sort_order: u32,
        repeat_count: u32,
        repeat_interval_ms: u64,
        config: WaitActionConfig,
    },
    #[serde(rename_all = "camelCase")]
    AddTimer {
        id: String,
        sort_order: u32,
        repeat_count: u32,
        repeat_interval_ms: u64,
        config: AddTimerActionConfig,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Automation {
    pub id: String,
    pub name: String,
    pub enabled: bool,
    pub trigger: Trigger,
    pub conditions: Vec<ConditionGroup>,
    pub actions: Vec<Action>,
    pub cooldown: CooldownConfig,
    /// 1 = más alta, 10 = normal, 100 = baja.
    pub priority: u32,
    pub created_at: u64,
    pub updated_at: u64,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ExecutionStatus {
    Queued,
    Running,
    Waiting,
    Completed,
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AutomationExecution {
    pub id: String,
    pub automation_id: String,
    pub event_id: String,
    pub session_id: String,
    pub status: ExecutionStatus,
    pub started_at: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub finished_at: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct KeyStrokeRequest {
    pub request_id: String,
    pub execution_id: String,
    pub automation_id: String,
    pub event_id: String,
    pub session_id: String,
    pub priority: u32,
    pub sequence: Vec<KeyStrokeStep>,
    pub repeat_count: u32,
    pub repeat_interval_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AudioRequest {
    pub request_id: String,
    pub execution_id: String,
    pub automation_id: String,
    pub event_id: String,
    pub session_id: String,
    pub priority: u32,
    pub sound_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub volume: Option<u8>,
    pub repeat_count: u32,
    pub repeat_interval_ms: u64,
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Prueba de regresión (Regla #76): el rename_all a nivel de enum
    /// SOLO afecta el valor del tag "type", no los campos internos de cada
    /// variante. Sin el rename_all por variante, sortOrder/repeatCount/etc.
    /// se serializarían como snake_case y romperían el wire format con TS.
    #[test]
    fn action_serializa_campos_internos_en_camel_case() {
        let action = Action::PlaySound {
            id: "act_001".to_string(),
            sort_order: 0,
            repeat_count: 1,
            repeat_interval_ms: 0,
            config: PlaySoundConfig {
                sound_id: "snd_001".to_string(),
                volume: Some(80),
            },
        };
        let value = serde_json::to_value(&action).unwrap();
        assert_eq!(value["type"], "play_sound");
        assert!(value.get("sortOrder").is_some(), "falta sortOrder (camelCase)");
        assert!(value.get("repeatCount").is_some(), "falta repeatCount (camelCase)");
        assert!(
            value.get("repeatIntervalMs").is_some(),
            "falta repeatIntervalMs (camelCase)"
        );
        assert!(value.get("sort_order").is_none(), "no debe quedar snake_case");
    }

    #[test]
    fn condition_operator_serializa_snake_case() {
        assert_eq!(
            serde_json::to_value(ConditionOperator::GreaterOrEqual).unwrap(),
            "greater_or_equal"
        );
    }

    /// Contract test (Etapa 1): fixture compartido con posibles pruebas TS
    /// futuras del editor de automatizaciones. Verifica que una automatización
    /// completa con condiciones anidadas y dos acciones deserializa sin perder
    /// datos y que el round-trip conserva exactamente las mismas claves.
    #[test]
    fn gift_combo_fixture_deserializa_automation_completa() {
        let fixtures_dir =
            std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../../tests/fixtures/automations");
        let json = std::fs::read_to_string(fixtures_dir.join("gift_combo.json"))
            .expect("no se pudo leer gift_combo.json");

        let automation: Automation =
            serde_json::from_str(&json).expect("deserializar gift_combo.json");

        assert_eq!(automation.id, "auto_001");
        assert!(automation.enabled);
        assert_eq!(automation.trigger.event_type, TriggerEventType::Gift);
        assert_eq!(automation.conditions.len(), 1);
        assert_eq!(automation.conditions[0].conditions.len(), 2);
        assert_eq!(automation.actions.len(), 2);
        assert_eq!(automation.priority, 10);
        assert_eq!(automation.cooldown.global_ms, 5000);

        match &automation.actions[0] {
            Action::PlaySound { config, .. } => assert_eq!(config.sound_id, "snd_rose"),
            other => panic!("se esperaba PlaySound, llegó {other:?}"),
        }
        match &automation.actions[1] {
            Action::Keystroke { config, .. } => {
                assert_eq!(config.sequence[0].keys, vec!["space".to_string()]);
            }
            other => panic!("se esperaba Keystroke, llegó {other:?}"),
        }

        // Round-trip: re-serializar debe seguir usando camelCase.
        let value = serde_json::to_value(&automation).unwrap();
        assert!(value.get("createdAt").is_some());
        assert!(value["actions"][0].get("sortOrder").is_some());
    }
}
