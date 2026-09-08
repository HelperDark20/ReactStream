//! Settings Manager (Sección 21). Regla #70: la configuración persistente
//! es diferente del estado LIVE. Regla #71: la configuración que compromete
//! la consistencia de la sesión se congela durante LIVE.
//!
//! Nota de alcance (Etapa 2): esto vive en RAM. La persistencia real a la
//! tabla `app_settings` de SQLite llega en la Etapa 3 (Database) — por ahora
//! se expone la API completa (incluida la regla de congelamiento) para que
//! Timer/Ranking/Automation Engine puedan empezar a consumirla sin esperar
//! a la capa de persistencia.

use serde::{Deserialize, Serialize};
use std::sync::RwLock;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub language: String,
    /// "system" | "light" | "dark". String simple por ahora; la Etapa 33
    /// (Settings UI) puede tipar esto más fuerte si hace falta.
    pub theme: String,
    pub tiktok_username: Option<String>,
    pub timer_initial: u64,
    pub timer_coins_per_second: u64,
    /// Decisión adicional post-documento: ¿el timer se reactiva
    /// automáticamente tras TIMER_ZERO si llega un regalo? Default: true.
    pub timer_reactivate_on_zero: bool,
    pub donor_top_count: u8,
    pub tap_top_count: u8,
    pub volume: u8,
}

impl Default for AppSettings {
    fn default() -> Self {
        // Defaults iniciales exactos de la Sección 21.
        Self {
            language: "es".to_string(),
            theme: "system".to_string(),
            tiktok_username: None,
            timer_initial: 300,
            timer_coins_per_second: 10,
            timer_reactivate_on_zero: true,
            donor_top_count: 10,
            tap_top_count: 10,
            volume: 100,
        }
    }
}

/// Claves que se CONGELAN mientras hay un LIVE activo (Regla #71 + decisión
/// adicional sobre `timer_reactivate_on_zero`). `donor_top_count` y
/// `tap_top_count` NO están aquí a propósito: la Regla #72 permite
/// cambiarlos durante LIVE sin perder datos.
pub const FROZEN_DURING_LIVE: &[&str] =
    &["timer_initial", "timer_coins_per_second", "timer_reactivate_on_zero"];

pub fn is_frozen_during_live(key: &str) -> bool {
    FROZEN_DURING_LIVE.contains(&key)
}

pub struct SettingsManager {
    settings: RwLock<AppSettings>,
}

impl SettingsManager {
    pub fn new(initial: AppSettings) -> Self {
        Self {
            settings: RwLock::new(initial),
        }
    }

    pub fn snapshot(&self) -> AppSettings {
        self.settings.read().expect("lock envenenado").clone()
    }

    /// Regla #71: rechaza cambios a claves congeladas mientras `live_active`.
    /// Regla #72: `donor_top_count`/`tap_top_count` siempre pasan, incluso
    /// con `live_active = true`.
    pub fn try_update<F>(&self, key: &str, live_active: bool, mutate: F) -> Result<(), String>
    where
        F: FnOnce(&mut AppSettings),
    {
        if live_active && is_frozen_during_live(key) {
            return Err(format!(
                "'{key}' está congelado durante un LIVE activo (Regla #71)"
            ));
        }
        let mut guard = self.settings.write().expect("lock envenenado");
        mutate(&mut guard);
        Ok(())
    }
}

impl Default for SettingsManager {
    fn default() -> Self {
        Self::new(AppSettings::default())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_coinciden_exactamente_con_la_seccion_21() {
        let defaults = AppSettings::default();
        assert_eq!(defaults.timer_initial, 300);
        assert_eq!(defaults.timer_coins_per_second, 10);
        assert_eq!(defaults.donor_top_count, 10);
        assert_eq!(defaults.tap_top_count, 10);
        assert_eq!(defaults.volume, 100);
        assert_eq!(defaults.theme, "system");
        assert_eq!(defaults.language, "es");
        assert!(defaults.timer_reactivate_on_zero);
    }

    #[test]
    fn rechaza_cambiar_timer_initial_durante_live() {
        let manager = SettingsManager::default();
        let result = manager.try_update("timer_initial", true, |s| s.timer_initial = 600);
        assert!(result.is_err());
        assert_eq!(manager.snapshot().timer_initial, 300); // sin cambios
    }

    #[test]
    fn permite_cambiar_timer_initial_fuera_de_live() {
        let manager = SettingsManager::default();
        let result = manager.try_update("timer_initial", false, |s| s.timer_initial = 600);
        assert!(result.is_ok());
        assert_eq!(manager.snapshot().timer_initial, 600);
    }

    #[test]
    fn donor_top_count_es_editable_incluso_durante_live() {
        // Regla #72: Top N puede cambiar durante LIVE sin perder datos.
        let manager = SettingsManager::default();
        let result = manager.try_update("donor_top_count", true, |s| s.donor_top_count = 20);
        assert!(result.is_ok());
        assert_eq!(manager.snapshot().donor_top_count, 20);
    }
}
