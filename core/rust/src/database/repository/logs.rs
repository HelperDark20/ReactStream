//! Repositorio de logs (tabla `logs`, Sección 22) y un `Logger` (Etapa 2)
//! que persiste ahí. Regla #22/#51: si la DB falla, el logging NUNCA debe
//! interrumpir el flujo — se cae a `tracing` como respaldo.

use crate::database::Database;
use crate::error::CoreResult;
use crate::logging::{LogEntry, Logger, TracingLogger};

pub struct LogsRepository<'a> {
    db: &'a Database,
}

impl<'a> LogsRepository<'a> {
    pub fn new(db: &'a Database) -> Self {
        Self { db }
    }

    pub fn insert(&self, entry: &LogEntry) -> CoreResult<()> {
        let context_json = entry.context.as_ref().map(|v| v.to_string());
        // La tabla `logs` no tiene columna separada para el código de error;
        // se antepone al mensaje con el mismo patrón "[CODE] mensaje" que
        // usa CoreError::Domain (Display), para mantener un solo formato.
        let message = match entry.code {
            Some(code) => format!("[{code}] {}", entry.message),
            None => entry.message.clone(),
        };

        self.db.with_connection(|conn| {
            conn.execute(
                "INSERT INTO logs (timestamp, level, module, message, context_json)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                rusqlite::params![
                    entry.timestamp as i64,
                    entry.level.to_string(),
                    entry.module,
                    message,
                    context_json,
                ],
            )?;
            Ok(())
        })
    }

    pub fn recent(&self, limit: u32) -> CoreResult<Vec<(i64, String, String, String)>> {
        self.db.with_connection(|conn| {
            let mut stmt = conn.prepare(
                "SELECT timestamp, level, module, message FROM logs ORDER BY timestamp DESC LIMIT ?1",
            )?;
            let rows = stmt.query_map(rusqlite::params![limit], |row| {
                Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?))
            })?;
            rows.collect::<rusqlite::Result<Vec<_>>>()
        })
    }
}

/// Logger de producción: persiste en SQLite y jamás interrumpe el flujo si
/// la DB falla (Regla #22, #51) — cae a `TracingLogger` como respaldo.
pub struct SqliteLogger<'a> {
    repo: LogsRepository<'a>,
    fallback: TracingLogger,
}

impl<'a> SqliteLogger<'a> {
    pub fn new(db: &'a Database) -> Self {
        Self {
            repo: LogsRepository::new(db),
            fallback: TracingLogger,
        }
    }
}

impl<'a> Logger for SqliteLogger<'a> {
    fn log(&self, entry: LogEntry) {
        if self.repo.insert(&entry).is_err() {
            self.fallback.log(entry);
        }
    }
}
