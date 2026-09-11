//! Action Engine (Sección 11). Dispatcher de acciones. Regla #35: Wait es
//! no bloqueante globalmente. Regla #36: no existe una cola global única.
//! Regla #50: un error de una acción no detiene las siguientes.

use crate::clock::Clock;
use crate::contracts::{Action, AudioRequest, AutomationExecution, KeyStrokeRequest};
use crate::logging::{LogEntry, LogLevel, Logger};
use std::sync::Arc;
use uuid::Uuid;

pub enum ActionDispatch {
    KeyStroke(KeyStrokeRequest),
    Audio(AudioRequest),
    AddTimer { seconds: u64 },
    ShowOverlay { overlay_id: String },
    HideOverlay { overlay_id: String },
    Wait { duration_ms: u64 },
}

pub struct ActionEngine {
    logger: Arc<dyn Logger>,
}

impl ActionEngine {
    pub fn new(logger: Arc<dyn Logger>) -> Self {
        Self { logger }
    }

    /// Convierte una lista de `Action` (datos) en `ActionDispatch` listos
    /// para ser ejecutados por los motores específicos. Regla #34: las
    /// acciones son datos, nunca código ejecutable — aquí solo se
    /// interpretan y se despachan, no se ejecutan directamente.
    pub fn dispatch(
        &self,
        execution: &AutomationExecution,
        actions: &[Action],
        clock: &dyn Clock,
    ) -> Vec<ActionDispatch> {
        let mut dispatches = Vec::new();

        for action in actions {
            match action {
                Action::Keystroke {
                    id,
                    sort_order: _,
                    repeat_count,
                    repeat_interval_ms,
                    config,
                } => {
                    dispatches.push(ActionDispatch::KeyStroke(KeyStrokeRequest {
                        request_id: Uuid::new_v4().to_string(),
                        execution_id: execution.id.clone(),
                        automation_id: execution.automation_id.clone(),
                        event_id: execution.event_id.clone(),
                        session_id: execution.session_id.clone(),
                        priority: 10,
                        sequence: config.sequence.clone(),
                        repeat_count: *repeat_count,
                        repeat_interval_ms: *repeat_interval_ms,
                    }));
                    self.logger.log(LogEntry::new(
                        clock,
                        LogLevel::Debug,
                        "action_engine",
                        format!("despachando KeyStroke action_id={id}"),
                    ));
                }
                Action::PlaySound {
                    id,
                    sort_order: _,
                    repeat_count,
                    repeat_interval_ms,
                    config,
                } => {
                    dispatches.push(ActionDispatch::Audio(AudioRequest {
                        request_id: Uuid::new_v4().to_string(),
                        execution_id: execution.id.clone(),
                        automation_id: execution.automation_id.clone(),
                        event_id: execution.event_id.clone(),
                        session_id: execution.session_id.clone(),
                        priority: 10,
                        sound_id: config.sound_id.clone(),
                        volume: config.volume,
                        repeat_count: *repeat_count,
                        repeat_interval_ms: *repeat_interval_ms,
                    }));
                    self.logger.log(LogEntry::new(
                        clock,
                        LogLevel::Debug,
                        "action_engine",
                        format!("despachando PlaySound action_id={id}"),
                    ));
                }
                Action::AddTimer { id, config, .. } => {
                    dispatches.push(ActionDispatch::AddTimer {
                        seconds: config.seconds,
                    });
                    self.logger.log(LogEntry::new(
                        clock,
                        LogLevel::Debug,
                        "action_engine",
                        format!("despachando AddTimer action_id={id} seconds={}", config.seconds),
                    ));
                }
                Action::ShowOverlay { id, config, .. } => {
                    dispatches.push(ActionDispatch::ShowOverlay {
                        overlay_id: config.overlay_id.clone(),
                    });
                    self.logger.log(LogEntry::new(
                        clock,
                        LogLevel::Debug,
                        "action_engine",
                        format!("despachando ShowOverlay action_id={id}"),
                    ));
                }
                Action::HideOverlay { id, config, .. } => {
                    dispatches.push(ActionDispatch::HideOverlay {
                        overlay_id: config.overlay_id.clone(),
                    });
                    self.logger.log(LogEntry::new(
                        clock,
                        LogLevel::Debug,
                        "action_engine",
                        format!("despachando HideOverlay action_id={id}"),
                    ));
                }
                Action::Wait { id, config, .. } => {
                    dispatches.push(ActionDispatch::Wait {
                        duration_ms: config.duration_ms,
                    });
                    self.logger.log(LogEntry::new(
                        clock,
                        LogLevel::Debug,
                        "action_engine",
                        format!("despachando Wait action_id={id} ms={}", config.duration_ms),
                    ));
                }
            }
        }

        dispatches
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::clock::SimulationClock;
    use crate::contracts::{
        AddTimerActionConfig, ExecutionStatus, KeyStrokeActionConfig, KeyStrokeStep,
        OverlayActionConfig, PlaySoundConfig, WaitActionConfig,
    };
    use crate::logging::InMemoryLogger;

    fn test_execution() -> AutomationExecution {
        AutomationExecution {
            id: "exec_1".to_string(),
            automation_id: "auto_1".to_string(),
            event_id: "evt_1".to_string(),
            session_id: "live_1".to_string(),
            status: ExecutionStatus::Running,
            started_at: 0,
            finished_at: None,
        }
    }

    #[test]
    fn despacha_keystroke_correctamente() {
        let engine = ActionEngine::new(Arc::new(InMemoryLogger::new()));
        let clock = SimulationClock::new(0);
        let actions = vec![Action::Keystroke {
            id: "act_1".to_string(),
            sort_order: 0,
            repeat_count: 1,
            repeat_interval_ms: 0,
            config: KeyStrokeActionConfig {
                sequence: vec![KeyStrokeStep {
                    keys: vec!["space".to_string()],
                    duration_ms: Some(100),
                    interval_ms: None,
                }],
            },
        }];
        let dispatches = engine.dispatch(&test_execution(), &actions, &clock);
        assert_eq!(dispatches.len(), 1);
        assert!(matches!(dispatches[0], ActionDispatch::KeyStroke(_)));
    }

    #[test]
    fn despacha_play_sound_correctamente() {
        let engine = ActionEngine::new(Arc::new(InMemoryLogger::new()));
        let clock = SimulationClock::new(0);
        let actions = vec![Action::PlaySound {
            id: "act_1".to_string(),
            sort_order: 0,
            repeat_count: 1,
            repeat_interval_ms: 0,
            config: PlaySoundConfig {
                sound_id: "snd_001".to_string(),
                volume: Some(80),
            },
        }];
        let dispatches = engine.dispatch(&test_execution(), &actions, &clock);
        assert!(matches!(dispatches[0], ActionDispatch::Audio(_)));
    }

    #[test]
    fn despacha_add_timer_correctamente() {
        let engine = ActionEngine::new(Arc::new(InMemoryLogger::new()));
        let clock = SimulationClock::new(0);
        let actions = vec![Action::AddTimer {
            id: "act_1".to_string(),
            sort_order: 0,
            repeat_count: 1,
            repeat_interval_ms: 0,
            config: AddTimerActionConfig { seconds: 30 },
        }];
        let dispatches = engine.dispatch(&test_execution(), &actions, &clock);
        assert!(matches!(dispatches[0], ActionDispatch::AddTimer { seconds: 30 }));
    }

    #[test]
    fn despacha_show_y_hide_overlay() {
        let engine = ActionEngine::new(Arc::new(InMemoryLogger::new()));
        let clock = SimulationClock::new(0);
        let actions = vec![
            Action::ShowOverlay {
                id: "act_1".to_string(),
                sort_order: 0,
                repeat_count: 1,
                repeat_interval_ms: 0,
                config: OverlayActionConfig {
                    overlay_id: "overlay_jar".to_string(),
                },
            },
            Action::HideOverlay {
                id: "act_2".to_string(),
                sort_order: 1,
                repeat_count: 1,
                repeat_interval_ms: 0,
                config: OverlayActionConfig {
                    overlay_id: "overlay_jar".to_string(),
                },
            },
        ];
        let dispatches = engine.dispatch(&test_execution(), &actions, &clock);
        assert_eq!(dispatches.len(), 2);
        assert!(matches!(dispatches[0], ActionDispatch::ShowOverlay { .. }));
        assert!(matches!(dispatches[1], ActionDispatch::HideOverlay { .. }));
    }

    #[test]
    fn despacha_wait_correctamente() {
        let engine = ActionEngine::new(Arc::new(InMemoryLogger::new()));
        let clock = SimulationClock::new(0);
        let actions = vec![Action::Wait {
            id: "act_1".to_string(),
            sort_order: 0,
            repeat_count: 1,
            repeat_interval_ms: 0,
            config: WaitActionConfig { duration_ms: 2000 },
        }];
        let dispatches = engine.dispatch(&test_execution(), &actions, &clock);
        assert!(matches!(dispatches[0], ActionDispatch::Wait { duration_ms: 2000 }));
    }

    #[test]
    fn lista_vacia_de_acciones_devuelve_lista_vacia() {
        let engine = ActionEngine::new(Arc::new(InMemoryLogger::new()));
        let clock = SimulationClock::new(0);
        let dispatches = engine.dispatch(&test_execution(), &[], &clock);
        assert!(dispatches.is_empty());
    }
}