//! Migraciones versionadas (Sección 22, Regla #75). Separadas de los seeds:
//! las migraciones crean/alteran estructura; los seeds insertan datos.
//! Nunca editar retroactivamente una migración ya aplicada — agregar una
//! nueva con id siguiente.

use rusqlite::{params, Connection};
use std::collections::HashSet;

pub struct Migration {
    pub id: i64,
    pub name: &'static str,
    pub sql: &'static str,
}

pub const MIGRATIONS: &[Migration] = &[Migration {
    id: 1,
    name: "0001_initial_schema",
    sql: include_str!("sql/0001_initial_schema.sql"),
}];

/// Corre cualquier migración pendiente dentro de una transacción por
/// migración. Idempotente: si ya se aplicó, se salta.
pub fn run_migrations(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS schema_migrations (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            applied_at INTEGER NOT NULL
        );",
    )?;

    let applied: HashSet<i64> = {
        let mut stmt = conn.prepare("SELECT id FROM schema_migrations")?;
        let rows = stmt.query_map([], |row| row.get::<_, i64>(0))?;
        rows.collect::<rusqlite::Result<HashSet<_>>>()?
    };

    for migration in MIGRATIONS {
        if applied.contains(&migration.id) {
            continue;
        }
        // `unchecked_transaction` permite usar &Connection (compartido a
        // través de Mutex en `Database`) en vez de requerir &mut Connection.
        let tx = conn.unchecked_transaction()?;
        tx.execute_batch(migration.sql)?;
        tx.execute(
            "INSERT INTO schema_migrations (id, name, applied_at) VALUES (?1, ?2, ?3)",
            params![migration.id, migration.name, now_ms()],
        )?;
        tx.commit()?;
    }
    Ok(())
}

fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .expect("el reloj del sistema está antes de UNIX_EPOCH")
        .as_millis() as i64
}
