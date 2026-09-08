//! Sistema de logging estructurado (Sección 29). Regla #88: todo componente
//! debe registrar errores relevantes. Regla #51: un error de un módulo no
//! debe tumbar la aplicación — por eso `Logger::log` nunca hace panic ni
//! retorna Result, solo registra y el flujo continúa.
//!
//! Los códigos de `ErrorCode` son estables: nunca renombrar uno existente
//! (romperlo invalida cualquier documentación/soporte que ya lo referencie).

use crate::clock::Clock;
use serde::{Deserialize, Serialize};
use std::fmt;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "UPPERCASE")]
pub enum LogLevel {
    Debug,
    Info,
    Warn,
    Error,
}

impl fmt::Display for LogLevel {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let s = match self {
            LogLevel::Debug => "DEBUG",
            LogLevel::Info => "INFO",
            LogLevel::Warn => "WARN",
            LogLevel::Error => "ERROR",
        };
        write!(f, "{s}")
    }
}

/// Códigos de error de la Sección 29.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum ErrorCode {
    #[serde(rename = "TIKTOK_001")]
    Tiktok001,
    #[serde(rename = "BRIDGE_001")]
    Bridge001,
    #[serde(rename = "AUDIO_001")]
    Audio001,
    #[serde(rename = "KEYSTROKE_001")]
    Keystroke001,
    #[serde(rename = "DATABASE_001")]
    Database001,
    #[serde(rename = "LICENSE_001")]
    License001,
    #[serde(rename = "OVERLAY_001")]
    Overlay001,
    #[serde(rename = "AUTOMATION_001")]
    Automation001,
}

impl ErrorCode {
    pub fn as_str(&self) -> &'static str {
        match self {
            ErrorCode::Tiktok001 => "TIKTOK_001",
            ErrorCode::Bridge001 => "BRIDGE_001",
            ErrorCode::Audio001 => "AUDIO_001",
            ErrorCode::Keystroke001 => "KEYSTROKE_001",
            ErrorCode::Database001 => "DATABASE_001",
            ErrorCode::License001 => "LICENSE_001",
            ErrorCode::Overlay001 => "OVERLAY_001",
            ErrorCode::Automation001 => "AUTOMATION_001",
        }
    }
}

impl fmt::Display for ErrorCode {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEntry {
    pub timestamp: u64,
    pub level: LogLevel,
    pub module: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub code: Option<ErrorCode>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub context: Option<serde_json::Value>,
}

impl LogEntry {
    pub fn new(
        clock: &dyn Clock,
        level: LogLevel,
        module: impl Into<String>,
        message: impl Into<String>,
    ) -> Self {
        Self {
            timestamp: clock.now_ms(),
            level,
            module: module.into(),
            message: message.into(),
            code: None,
            context: None,
        }
    }

    pub fn with_code(mut self, code: ErrorCode) -> Self {
        self.code = Some(code);
        self
    }

    pub fn with_context(mut self, context: serde_json::Value) -> Self {
        self.context = Some(context);
        self
    }
}

/// Regla #88: todo componente debe registrar errores relevantes.
pub trait Logger: Send + Sync {
    fn log(&self, entry: LogEntry);
}

/// Implementación de producción — delega en `tracing` (ya configurado con
/// `tracing-subscriber` en el binario principal).
#[derive(Debug, Default, Clone, Copy)]
pub struct TracingLogger;

impl Logger for TracingLogger {
    fn log(&self, entry: LogEntry) {
        match entry.level {
            LogLevel::Debug => {
                tracing::debug!(module = %entry.module, code = ?entry.code, "{}", entry.message)
            }
            LogLevel::Info => {
                tracing::info!(module = %entry.module, code = ?entry.code, "{}", entry.message)
            }
            LogLevel::Warn => {
                tracing::warn!(module = %entry.module, code = ?entry.code, "{}", entry.message)
            }
            LogLevel::Error => {
                tracing::error!(module = %entry.module, code = ?entry.code, "{}", entry.message)
            }
        }
    }
}

/// Logger en memoria — útil para pruebas (Simulation, Automation Engine,
/// etc.) donde queremos aserciones sobre qué se registró sin depender de
/// un subscriber de `tracing` real.
#[derive(Default)]
pub struct InMemoryLogger {
    entries: std::sync::Mutex<Vec<LogEntry>>,
}

impl InMemoryLogger {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn entries(&self) -> Vec<LogEntry> {
        self.entries.lock().expect("lock envenenado").clone()
    }
}

impl Logger for InMemoryLogger {
    fn log(&self, entry: LogEntry) {
        self.entries.lock().expect("lock envenenado").push(entry);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::clock::SimulationClock;

    #[test]
    fn error_code_serializa_igual_que_as_str() {
        // Prueba de regresión: el mismo bug de casing que ya encontramos en
        // contracts::Action (Regla #76) podría repetirse aquí si alguien
        // quita el #[serde(rename = ...)] de algún variante.
        for code in [
            ErrorCode::Tiktok001,
            ErrorCode::Audio001,
            ErrorCode::Database001,
        ] {
            let json = serde_json::to_value(code).unwrap();
            assert_eq!(json.as_str().unwrap(), code.as_str());
        }
    }

    #[test]
    fn log_entry_builder_agrega_code_y_context() {
        let clock = SimulationClock::new(12345);
        let entry = LogEntry::new(&clock, LogLevel::Error, "audio", "archivo no encontrado")
            .with_code(ErrorCode::Audio001)
            .with_context(serde_json::json!({ "soundId": "snd_001" }));

        assert_eq!(entry.timestamp, 12345);
        assert_eq!(entry.level, LogLevel::Error);
        assert_eq!(entry.code, Some(ErrorCode::Audio001));
        assert!(entry.context.is_some());
    }

    #[test]
    fn in_memory_logger_acumula_entradas_sin_interrumpir_el_flujo() {
        let logger = InMemoryLogger::new();
        let clock = SimulationClock::new(0);
        logger.log(LogEntry::new(
            &clock,
            LogLevel::Warn,
            "database",
            "reintentando conexión",
        ));
        logger.log(
            LogEntry::new(&clock, LogLevel::Error, "audio", "archivo no encontrado")
                .with_code(ErrorCode::Audio001),
        );

        let entries = logger.entries();
        assert_eq!(entries.len(), 2);
        assert_eq!(entries[1].code, Some(ErrorCode::Audio001));
    }
}
