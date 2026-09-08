//! Capa de persistencia SQLite (Sección 22). Regla #61: prepared statements
//! siempre. Regla #62: la base vive en AppData. Regla #63: los MP3 no se
//! almacenan como BLOB (solo su ruta). Regla #22: un fallo de SQLite
//! durante un LIVE no debe detener el LIVE — conservar RAM y reintentar.

mod connection;
pub mod migrations;
pub mod repository;
pub mod seeds;

pub use connection::Database;

#[cfg(test)]
mod tests {
    use super::*;
    use crate::clock::SimulationClock;
    use crate::logging::{ErrorCode, LogEntry, LogLevel, Logger};
    use crate::state::settings::AppSettings;
    use repository::logs::{LogsRepository, SqliteLogger};
    use repository::settings::SettingsRepository;

    #[test]
    fn abrir_en_memoria_corre_migraciones_automaticamente() {
        let db = Database::open_in_memory().expect("abrir DB en memoria");
        // Si las migraciones no hubieran corrido, esta tabla no existiría
        // y la consulta fallaría.
        let count: i64 = db
            .with_connection(|conn| conn.query_row("SELECT COUNT(*) FROM app_settings", [], |r| r.get(0)))
            .unwrap();
        assert_eq!(count, 0);
    }

    #[test]
    fn migraciones_son_idempotentes() {
        let db = Database::open_in_memory().unwrap();
        db.with_connection(migrations::run_migrations).unwrap();
        let applied: i64 = db
            .with_connection(|conn| {
                conn.query_row("SELECT COUNT(*) FROM schema_migrations", [], |r| r.get(0))
            })
            .unwrap();
        assert_eq!(applied, 1); // solo la 0001, no duplicada al re-correr
    }

    #[test]
    fn settings_repository_guarda_y_recupera_valores() {
        let db = Database::open_in_memory().unwrap();
        let repo = SettingsRepository::new(&db);

        let mut settings = AppSettings::default();
        settings.timer_initial = 600;
        settings.tiktok_username = Some("mi_usuario".to_string());
        repo.save(&settings, 1_000).unwrap();

        let loaded = repo.load().unwrap();
        assert_eq!(loaded.timer_initial, 600);
        assert_eq!(loaded.tiktok_username, Some("mi_usuario".to_string()));
        assert_eq!(loaded.donor_top_count, 10); // default sin tocar
    }

    #[test]
    fn settings_repository_limpia_tiktok_username_al_guardar_none() {
        let db = Database::open_in_memory().unwrap();
        let repo = SettingsRepository::new(&db);

        let mut settings = AppSettings::default();
        settings.tiktok_username = Some("temp".to_string());
        repo.save(&settings, 1_000).unwrap();
        assert_eq!(repo.load().unwrap().tiktok_username, Some("temp".to_string()));

        settings.tiktok_username = None;
        repo.save(&settings, 2_000).unwrap();
        assert_eq!(repo.load().unwrap().tiktok_username, None);
    }

    #[test]
    fn seeds_solo_insertan_defaults_si_la_tabla_esta_vacia() {
        let db = Database::open_in_memory().unwrap();
        seeds::run_seeds(&db, 1_000).unwrap();

        let repo = SettingsRepository::new(&db);
        assert_eq!(repo.load().unwrap().timer_initial, 300);

        // Cambiar un valor y volver a correr seeds NO debe pisarlo.
        let mut modified = repo.load().unwrap();
        modified.timer_initial = 999;
        repo.save(&modified, 2_000).unwrap();
        seeds::run_seeds(&db, 3_000).unwrap();
        assert_eq!(repo.load().unwrap().timer_initial, 999);
    }

    #[test]
    fn logs_repository_inserta_y_consulta_recientes() {
        let db = Database::open_in_memory().unwrap();
        let clock = SimulationClock::new(5_000);
        let logs_repo = LogsRepository::new(&db);

        logs_repo
            .insert(&LogEntry::new(&clock, LogLevel::Info, "database", "conexión abierta"))
            .unwrap();
        logs_repo
            .insert(
                &LogEntry::new(&clock, LogLevel::Error, "audio", "archivo no encontrado")
                    .with_code(ErrorCode::Audio001),
            )
            .unwrap();

        let recent = logs_repo.recent(10).unwrap();
        assert_eq!(recent.len(), 2);
    }

    #[test]
    fn sqlite_logger_persiste_correctamente_en_la_ruta_feliz() {
        let db = Database::open_in_memory().unwrap();
        let clock = SimulationClock::new(0);
        let logger = SqliteLogger::new(&db);

        logger.log(LogEntry::new(&clock, LogLevel::Warn, "session", "reintentando"));

        let recent = LogsRepository::new(&db).recent(10).unwrap();
        assert_eq!(recent.len(), 1);
    }
}
