//! Repositorio de configuración persistente (tabla `app_settings`,
//! Sección 22). Conecta el `AppSettings` de la Etapa 2 con SQLite.

use crate::database::Database;
use crate::error::CoreResult;
use crate::state::settings::AppSettings;
use std::collections::HashMap;

pub struct SettingsRepository<'a> {
    db: &'a Database,
}

impl<'a> SettingsRepository<'a> {
    pub fn new(db: &'a Database) -> Self {
        Self { db }
    }

    pub fn load(&self) -> CoreResult<AppSettings> {
        let rows: HashMap<String, String> = self.db.with_connection(|conn| {
            let mut stmt = conn.prepare("SELECT key, value FROM app_settings")?;
            let rows = stmt.query_map([], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })?;
            rows.collect::<rusqlite::Result<HashMap<_, _>>>()
        })?;

        let defaults = AppSettings::default();
        Ok(AppSettings {
            language: rows.get("language").cloned().unwrap_or(defaults.language),
            theme: rows.get("theme").cloned().unwrap_or(defaults.theme),
            tiktok_username: rows.get("tiktok_username").cloned(),
            timer_initial: rows
                .get("timer_initial")
                .and_then(|v| v.parse().ok())
                .unwrap_or(defaults.timer_initial),
            timer_coins_per_second: rows
                .get("timer_coins_per_second")
                .and_then(|v| v.parse().ok())
                .unwrap_or(defaults.timer_coins_per_second),
            timer_reactivate_on_zero: rows
                .get("timer_reactivate_on_zero")
                .and_then(|v| v.parse().ok())
                .unwrap_or(defaults.timer_reactivate_on_zero),
            donor_top_count: rows
                .get("donor_top_count")
                .and_then(|v| v.parse().ok())
                .unwrap_or(defaults.donor_top_count),
            tap_top_count: rows
                .get("tap_top_count")
                .and_then(|v| v.parse().ok())
                .unwrap_or(defaults.tap_top_count),
            volume: rows
                .get("volume")
                .and_then(|v| v.parse().ok())
                .unwrap_or(defaults.volume),
        })
    }

    pub fn save(&self, settings: &AppSettings, now_ms: u64) -> CoreResult<()> {
        let pairs: Vec<(&str, String)> = vec![
            ("language", settings.language.clone()),
            ("theme", settings.theme.clone()),
            ("timer_initial", settings.timer_initial.to_string()),
            (
                "timer_coins_per_second",
                settings.timer_coins_per_second.to_string(),
            ),
            (
                "timer_reactivate_on_zero",
                settings.timer_reactivate_on_zero.to_string(),
            ),
            ("donor_top_count", settings.donor_top_count.to_string()),
            ("tap_top_count", settings.tap_top_count.to_string()),
            ("volume", settings.volume.to_string()),
        ];
        let tiktok_username = settings.tiktok_username.clone();

        self.db.with_connection(|conn| {
            for (key, value) in &pairs {
                conn.execute(
                    "INSERT INTO app_settings (key, value, updated_at) VALUES (?1, ?2, ?3)
                     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
                    rusqlite::params![key, value, now_ms as i64],
                )?;
            }
            match &tiktok_username {
                Some(username) => {
                    conn.execute(
                        "INSERT INTO app_settings (key, value, updated_at) VALUES ('tiktok_username', ?1, ?2)
                         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
                        rusqlite::params![username, now_ms as i64],
                    )?;
                }
                None => {
                    conn.execute("DELETE FROM app_settings WHERE key = 'tiktok_username'", [])?;
                }
            }
            Ok(())
        })
    }
}
