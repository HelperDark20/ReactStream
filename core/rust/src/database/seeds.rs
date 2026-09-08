//! Seeds (Regla #75: separados formalmente de las migraciones). Las
//! migraciones crean estructura; los seeds insertan datos iniciales de
//! forma idempotente (correr dos veces no debe duplicar ni pisar cambios
//! del usuario).
//!
//! Nota de alcance (Etapa 3): aquí solo sembramos los defaults de
//! `app_settings` en primer arranque. El seed del Gift Catalog para
//! Colombia (Regla #74: catálogo local, no depende de sitio externo en
//! runtime) llega completo en la Etapa 6.

use super::repository::settings::SettingsRepository;
use super::Database;
use crate::error::CoreResult;
use crate::state::settings::AppSettings;

pub fn run_seeds(db: &Database, now_ms: u64) -> CoreResult<()> {
    let repo = SettingsRepository::new(db);
    let count: i64 =
        db.with_connection(|conn| conn.query_row("SELECT COUNT(*) FROM app_settings", [], |r| r.get(0)))?;

    if count == 0 {
        repo.save(&AppSettings::default(), now_ms)?;
    }
    Ok(())
}
