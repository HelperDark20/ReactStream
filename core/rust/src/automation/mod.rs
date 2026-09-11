//! Automation Engine (Sección 10). Regla #34: las automatizaciones son
//! datos, nunca código ejecutable. Regla #43: máximo 100 ejecuciones
//! simultáneas. Regla #59: nunca eval ni código desde configuraciones.

use crate::clock::Clock;
use crate::contracts::{
    Action, AppEvent, Automation, AutomationExecution, ConditionGroup, ConditionLogic,
    ConditionOperator, ConditionValue, ExecutionStatus, TriggerEventType,
};
use crate::logging::{LogEntry, LogLevel, Logger};
use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use uuid::Uuid;

/// Máximo de ejecuciones simultáneas (Regla #43).
pub const MAX_CONCURRENT_EXECUTIONS: usize = 100;

// ============================================================
// CONDITION EVALUATOR
// ============================================================

fn extract_field(event: &AppEvent, field: &str) -> Option<serde_json::Value> {
    let value = serde_json::to_value(event).ok()?;
    let parts: Vec<&str> = field.split('.').collect();
    let mut current = &value;
    for part in parts {
        current = current.get(part)?;
    }
    Some(current.clone())
}

fn evaluate_condition(
    event: &AppEvent,
    field: &str,
    operator: ConditionOperator,
    expected: &ConditionValue,
) -> bool {
    let Some(actual) = extract_field(event, field) else {
        return false;
    };

    match (operator, expected) {
        (ConditionOperator::Equals, ConditionValue::String(s)) => {
            actual.as_str().map_or(false, |v| v == s.as_str())
        }
        (ConditionOperator::Equals, ConditionValue::Number(n)) => {
            actual.as_f64().map_or(false, |v| (v - n).abs() < f64::EPSILON)
        }
        (ConditionOperator::Equals, ConditionValue::Bool(b)) => {
            actual.as_bool().map_or(false, |v| v == *b)
        }
        (ConditionOperator::NotEquals, ConditionValue::String(s)) => {
            actual.as_str().map_or(false, |v| v != s.as_str())
        }
        (ConditionOperator::NotEquals, ConditionValue::Number(n)) => {
            actual.as_f64().map_or(false, |v| (v - n).abs() >= f64::EPSILON)
        }
        (ConditionOperator::GreaterThan, ConditionValue::Number(n)) => {
            actual.as_f64().map_or(false, |v| v > *n)
        }
        (ConditionOperator::GreaterOrEqual, ConditionValue::Number(n)) => {
            actual.as_f64().map_or(false, |v| v >= *n)
        }
        (ConditionOperator::LessThan, ConditionValue::Number(n)) => {
            actual.as_f64().map_or(false, |v| v < *n)
        }
        (ConditionOperator::LessOrEqual, ConditionValue::Number(n)) => {
            actual.as_f64().map_or(false, |v| v <= *n)
        }
        (ConditionOperator::Contains, ConditionValue::String(s)) => {
            actual.as_str().map_or(false, |v| v.contains(s.as_str()))
        }
        (ConditionOperator::StartsWith, ConditionValue::String(s)) => {
            actual.as_str().map_or(false, |v| v.starts_with(s.as_str()))
        }
        _ => false,
    }
}

fn evaluate_group(event: &AppEvent, group: &ConditionGroup) -> bool {
    let condition_results: Vec<bool> = group
        .conditions
        .iter()
        .map(|c| evaluate_condition(event, &c.field, c.operator, &c.value))
        .collect();

    let base = match group.logic {
        ConditionLogic::And => condition_results.iter().all(|&r| r),
        ConditionLogic::Or => condition_results.iter().any(|&r| r),
    };

    // Subgrupos siempre se combinan con AND entre sí y con el resultado base.
    let subgroup_result = group
        .groups
        .as_ref()
        .map(|groups| groups.iter().all(|g| evaluate_group(event, g)))
        .unwrap_or(true);

    base && subgroup_result
}

pub fn evaluate_conditions(event: &AppEvent, groups: &[ConditionGroup]) -> bool {
    if groups.is_empty() {
        return true;
    }
    groups.iter().all(|g| evaluate_group(event, g))
}

// ============================================================
// TRIGGER MATCHING
// ============================================================

pub fn matches_trigger(event: &AppEvent, trigger_type: TriggerEventType) -> bool {
    matches!(
        (event, trigger_type),
        (AppEvent::Gift(_), TriggerEventType::Gift)
            | (AppEvent::Like(_), TriggerEventType::Like)
            | (AppEvent::Follow(_), TriggerEventType::Follow)
            | (AppEvent::Comment(_), TriggerEventType::Comment)
            | (AppEvent::Share(_), TriggerEventType::Share)
            | (AppEvent::Member(_), TriggerEventType::Member)
            | (AppEvent::TimerZero(_), TriggerEventType::TimerZero)
    )
}

// ============================================================
// COOLDOWN TRACKER
// ============================================================

struct CooldownTracker {
    last_global: Option<u64>,
    last_per_user: HashMap<String, u64>,
}

impl CooldownTracker {
    fn new() -> Self {
        Self {
            last_global: None,
            last_per_user: HashMap::new(),
        }
    }

    fn is_ready(&self, now_ms: u64, global_ms: u64, per_user_ms: u64, user_id: Option<&str>) -> bool {
        if let Some(last) = self.last_global {
            if now_ms.saturating_sub(last) < global_ms {
                return false;
            }
        }
        if per_user_ms > 0 {
            if let Some(uid) = user_id {
                if let Some(&last) = self.last_per_user.get(uid) {
                    if now_ms.saturating_sub(last) < per_user_ms {
                        return false;
                    }
                }
            }
        }
        true
    }

    fn record(&mut self, now_ms: u64, user_id: Option<&str>) {
        self.last_global = Some(now_ms);
        if let Some(uid) = user_id {
            self.last_per_user.insert(uid.to_string(), now_ms);
        }
    }
}

// ============================================================
// AUTOMATION ENGINE
// ============================================================

pub struct AutomationEngine {
    automations: RwLock<Vec<Automation>>,
    cooldowns: RwLock<HashMap<String, CooldownTracker>>,
    active_executions: RwLock<Vec<AutomationExecution>>,
    logger: Arc<dyn Logger>,
}

impl AutomationEngine {
    pub fn new(logger: Arc<dyn Logger>) -> Self {
        Self {
            automations: RwLock::new(Vec::new()),
            cooldowns: RwLock::new(HashMap::new()),
            active_executions: RwLock::new(Vec::new()),
            logger,
        }
    }

    pub fn load(&self, automations: Vec<Automation>) {
        *self.automations.write().expect("lock envenenado") = automations;
        self.cooldowns.write().expect("lock envenenado").clear();
    }

    pub fn active_execution_count(&self) -> usize {
        self.active_executions.read().expect("lock envenenado").len()
    }

    /// Evalúa el evento contra todas las automatizaciones habilitadas y
    /// devuelve las acciones a ejecutar, ordenadas por prioridad.
    /// Regla #43: si ya hay 100 ejecuciones activas, descarta el evento.
    pub fn process_event(
        &self,
        event: &AppEvent,
        clock: &dyn Clock,
    ) -> Vec<(AutomationExecution, Vec<Action>)> {
        if self.active_execution_count() >= MAX_CONCURRENT_EXECUTIONS {
            self.logger.log(LogEntry::new(
                clock,
                LogLevel::Warn,
                "automation",
                "límite de 100 ejecuciones simultáneas alcanzado, evento descartado (Regla #43)",
            ));
            return vec![];
        }

        let automations = self.automations.read().expect("lock envenenado").clone();
        let now_ms = clock.now_ms();

        let user_id: Option<String> = match event {
            AppEvent::Gift(g) => Some(g.user.id.clone()),
            AppEvent::Like(l) => Some(l.user.id.clone()),
            AppEvent::Follow(f) => Some(f.user.id.clone()),
            AppEvent::Comment(c) => Some(c.user.id.clone()),
            AppEvent::Share(s) => Some(s.user.id.clone()),
            AppEvent::Member(m) => Some(m.user.id.clone()),
            _ => None,
        };

        // Ordenar por prioridad (menor número = mayor prioridad)
        let mut eligible: Vec<&Automation> = automations
            .iter()
            .filter(|a| {
                a.enabled
                    && matches_trigger(event, a.trigger.event_type)
                    && evaluate_conditions(event, &a.conditions)
            })
            .collect();
        eligible.sort_by_key(|a| a.priority);

        let mut results = vec![];
        let mut cooldowns = self.cooldowns.write().expect("lock envenenado");

        for automation in eligible {
            let tracker = cooldowns
                .entry(automation.id.clone())
                .or_insert_with(CooldownTracker::new);

            if !tracker.is_ready(
                now_ms,
                automation.cooldown.global_ms,
                automation.cooldown.per_user_ms,
                user_id.as_deref(),
            ) {
                continue;
            }

            tracker.record(now_ms, user_id.as_deref());

            let execution = AutomationExecution {
                id: Uuid::new_v4().to_string(),
                automation_id: automation.id.clone(),
                event_id: event.id().to_string(),
                session_id: event.session_id().to_string(),
                status: ExecutionStatus::Queued,
                started_at: now_ms,
                finished_at: None,
            };

            self.active_executions
                .write()
                .expect("lock envenenado")
                .push(execution.clone());

            results.push((execution, automation.actions.clone()));
        }

        results
    }

    /// Marca una ejecución como completada y la retira de las activas.
    pub fn complete_execution(&self, execution_id: &str, status: ExecutionStatus) {
        let mut execs = self.active_executions.write().expect("lock envenenado");
        execs.retain(|e| e.id != execution_id);
        drop(execs);
        self.logger.log(LogEntry::new(
            &crate::clock::ProductionClock,
            LogLevel::Debug,
            "automation",
            format!("ejecución {execution_id} finalizada con estado {status:?}"),
        ));
    }

    /// Cancela todas las ejecuciones activas de la sesión (paso de LIVE_END,
    /// Regla #47-49).
    pub fn cancel_session_executions(&self, session_id: &str) {
        let mut execs = self.active_executions.write().expect("lock envenenado");
        execs.retain(|e| e.session_id != session_id);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::clock::SimulationClock;
    use crate::contracts::{
        CooldownConfig, EventSource, Gift, GiftEvent, LikeEvent, Trigger, User,
    };
    use crate::logging::InMemoryLogger;
    use std::sync::Arc;

    fn user(id: &str) -> User {
        User {
            id: id.to_string(),
            username: id.to_string(),
            display_name: id.to_string(),
            avatar_url: None,
        }
    }

    fn gift_event(id: &str, gift_id: &str, coins: u64, qty: u64) -> AppEvent {
        AppEvent::Gift(GiftEvent {
            id: id.to_string(),
            timestamp: 0,
            session_id: "live_1".to_string(),
            source: EventSource::Simulation,
            user: user("sender"),
            metadata: None,
            gift: Gift {
                id: gift_id.to_string(),
                name: gift_id.to_string(),
                coins,
                image_url: None,
                region: "CO".to_string(),
            },
            quantity: qty,
            total_coins: coins * qty,
            repeat_end: true,
        })
    }

    fn like_event(id: &str, user_id: &str) -> AppEvent {
        AppEvent::Like(LikeEvent {
            id: id.to_string(),
            timestamp: 0,
            session_id: "live_1".to_string(),
            source: EventSource::Simulation,
            user: user(user_id),
            metadata: None,
            count: 1,
        })
    }

    fn simple_automation(id: &str, trigger: TriggerEventType) -> Automation {
        Automation {
            id: id.to_string(),
            name: id.to_string(),
            enabled: true,
            trigger: Trigger { event_type: trigger },
            conditions: vec![],
            actions: vec![],
            cooldown: CooldownConfig {
                global_ms: 0,
                per_user_ms: 0,
            },
            priority: 10,
            created_at: 0,
            updated_at: 0,
        }
    }

    #[test]
    fn dispara_automatizacion_sin_condiciones() {
        let engine = AutomationEngine::new(Arc::new(InMemoryLogger::new()));
        engine.load(vec![simple_automation("auto_1", TriggerEventType::Gift)]);
        let clock = SimulationClock::new(0);
        let results = engine.process_event(&gift_event("evt_1", "5655", 1, 1), &clock);
        assert_eq!(results.len(), 1);
    }

    #[test]
    fn no_dispara_si_el_trigger_no_coincide() {
        let engine = AutomationEngine::new(Arc::new(InMemoryLogger::new()));
        engine.load(vec![simple_automation("auto_1", TriggerEventType::Like)]);
        let clock = SimulationClock::new(0);
        let results = engine.process_event(&gift_event("evt_1", "5655", 1, 1), &clock);
        assert!(results.is_empty());
    }

    #[test]
    fn no_dispara_si_la_automatizacion_esta_deshabilitada() {
        let mut auto1 = simple_automation("auto_1", TriggerEventType::Gift);
        auto1.enabled = false;
        let engine = AutomationEngine::new(Arc::new(InMemoryLogger::new()));
        engine.load(vec![auto1]);
        let clock = SimulationClock::new(0);
        let results = engine.process_event(&gift_event("evt_1", "5655", 1, 1), &clock);
        assert!(results.is_empty());
    }

    #[test]
    fn condicion_equals_string_filtra_correctamente() {
        use crate::contracts::{Condition, ConditionGroup, ConditionLogic};
        let mut auto1 = simple_automation("auto_1", TriggerEventType::Gift);
        auto1.conditions = vec![ConditionGroup {
            id: "grp_1".to_string(),
            logic: ConditionLogic::And,
            conditions: vec![Condition {
                id: "c1".to_string(),
                field: "gift.id".to_string(),
                operator: ConditionOperator::Equals,
                value: ConditionValue::String("5655".to_string()),
            }],
            groups: None,
        }];
        let engine = AutomationEngine::new(Arc::new(InMemoryLogger::new()));
        engine.load(vec![auto1]);
        let clock = SimulationClock::new(0);

        let match_result = engine.process_event(&gift_event("evt_1", "5655", 1, 1), &clock);
        assert_eq!(match_result.len(), 1);

        let no_match = engine.process_event(&gift_event("evt_2", "9999", 1, 1), &clock);
        assert!(no_match.is_empty());
    }

    #[test]
    fn condicion_greater_or_equal_numero_funciona() {
        use crate::contracts::{Condition, ConditionGroup, ConditionLogic};
        let mut auto1 = simple_automation("auto_1", TriggerEventType::Gift);
        auto1.conditions = vec![ConditionGroup {
            id: "grp_1".to_string(),
            logic: ConditionLogic::And,
            conditions: vec![Condition {
                id: "c1".to_string(),
                field: "totalCoins".to_string(),
                operator: ConditionOperator::GreaterOrEqual,
                value: ConditionValue::Number(10.0),
            }],
            groups: None,
        }];
        let engine = AutomationEngine::new(Arc::new(InMemoryLogger::new()));
        engine.load(vec![auto1]);
        let clock = SimulationClock::new(0);

        assert_eq!(
            engine.process_event(&gift_event("evt_1", "5655", 1, 10), &clock).len(),
            1
        );
        assert!(engine
            .process_event(&gift_event("evt_2", "5655", 1, 5), &clock)
            .is_empty());
    }

    #[test]
    fn cooldown_global_impide_disparo_repetido() {
        let mut auto1 = simple_automation("auto_1", TriggerEventType::Like);
        auto1.cooldown = CooldownConfig {
            global_ms: 5_000,
            per_user_ms: 0,
        };
        let engine = AutomationEngine::new(Arc::new(InMemoryLogger::new()));
        engine.load(vec![auto1]);
        let clock = SimulationClock::new(0);

        assert_eq!(engine.process_event(&like_event("evt_1", "u1"), &clock).len(), 1);
        assert!(engine.process_event(&like_event("evt_2", "u2"), &clock).is_empty());

        clock.advance_ms(5_001);
        assert_eq!(engine.process_event(&like_event("evt_3", "u3"), &clock).len(), 1);
    }

    #[test]
    fn cooldown_per_user_bloquea_al_mismo_usuario_pero_permite_otros() {
        let mut auto1 = simple_automation("auto_1", TriggerEventType::Like);
        auto1.cooldown = CooldownConfig {
            global_ms: 0,
            per_user_ms: 5_000,
        };
        let engine = AutomationEngine::new(Arc::new(InMemoryLogger::new()));
        engine.load(vec![auto1]);
        let clock = SimulationClock::new(0);

        assert_eq!(engine.process_event(&like_event("evt_1", "alice"), &clock).len(), 1);
        assert!(engine.process_event(&like_event("evt_2", "alice"), &clock).is_empty());
        assert_eq!(engine.process_event(&like_event("evt_3", "bob"), &clock).len(), 1);
    }

    #[test]
    fn prioridad_ordena_las_ejecuciones_correctamente() {
        let mut low = simple_automation("low", TriggerEventType::Gift);
        low.priority = 100;
        let mut high = simple_automation("high", TriggerEventType::Gift);
        high.priority = 1;
        let engine = AutomationEngine::new(Arc::new(InMemoryLogger::new()));
        engine.load(vec![low, high]);
        let clock = SimulationClock::new(0);
        let results = engine.process_event(&gift_event("evt_1", "5655", 1, 1), &clock);
        assert_eq!(results[0].0.automation_id, "high");
        assert_eq!(results[1].0.automation_id, "low");
    }

    #[test]
    fn cancel_session_executions_limpia_ejecuciones_de_la_sesion() {
        let engine = AutomationEngine::new(Arc::new(InMemoryLogger::new()));
        engine.load(vec![simple_automation("auto_1", TriggerEventType::Gift)]);
        let clock = SimulationClock::new(0);
        engine.process_event(&gift_event("evt_1", "5655", 1, 1), &clock);
        assert_eq!(engine.active_execution_count(), 1);
        engine.cancel_session_executions("live_1");
        assert_eq!(engine.active_execution_count(), 0);
    }
}