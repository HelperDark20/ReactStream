//! Conexión SQLite (Sección 22). Regla #62: la base vive en AppData.
//! Regla #61: siempre prepared statements (rusqlite los usa por defecto en
//! los parámetros bindeados — nunca interpolar SQL a mano en este proyecto).

use crate::error::{CoreError, CoreResult};
use rusqlite::Connection;
use std::path::Path;
use std::sync::Mutex;

pub struct Database {
    conn: Mutex<Connection>,
}

impl Database {
    /// Abre (o crea) la base de datos en `path`, aplica PRAGMA y corre las
    /// migraciones pendientes. En producción `path` es
    /// `%APPDATA%\ReactStream\database\app.db`.
    pub fn open(path: &Path) -> CoreResult<Self> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let conn = Connection::open(path)?;
        conn.pragma_update(None, "foreign_keys", "ON")?;
        conn.pragma_update(None, "journal_mode", "WAL")?;
        let db = Self {
            conn: Mutex::new(conn),
        };
        db.with_connection(super::migrations::run_migrations)?;
        Ok(db)
    }

    /// Solo para tests y Simulation Engine — sin persistencia real a disco.
    /// WAL no aplica a bases en memoria, así que se omite ese PRAGMA aquí.
    pub fn open_in_memory() -> CoreResult<Self> {
        let conn = Connection::open_in_memory()?;
        conn.pragma_update(None, "foreign_keys", "ON")?;
        let db = Self {
            conn: Mutex::new(conn),
        };
        db.with_connection(super::migrations::run_migrations)?;
        Ok(db)
    }

    /// Único punto de acceso a la conexión. Regla #22: si esto falla
    /// durante un LIVE, quien lo llama debe conservar el estado en RAM y
    /// reintentar después — jamás detener el LIVE por un error aquí.
    pub fn with_connection<T>(
        &self,
        f: impl FnOnce(&Connection) -> rusqlite::Result<T>,
    ) -> CoreResult<T> {
        let conn = self.conn.lock().expect("lock de conexión envenenado");
        f(&conn).map_err(CoreError::from)
    }
}
