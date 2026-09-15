//! License Manager (Sección 26, Etapa 36).
//! Regla #21: expiración de licencia NO interrumpe un LIVE activo.
//! Regla #64: la llave privada jamás está en el cliente.
//! Regla #65: licencias usan payload firmado con RSA-SHA256.
//! Regla #66: feature flags centralizados — todo el código consulta aquí.

use crate::contracts::{LicensePayload, LicensePlan, LicenseStatus};
use crate::error::{CoreError, CoreResult};
use crate::logging::{ErrorCode, LogEntry, LogLevel, Logger};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, RwLock};

/// Public key del servidor embebida en el binario (Regla #64).
/// La private key NUNCA sale del servidor de licencias.
pub const SERVER_PUBLIC_KEY: &str = "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEApB5TpGOKtMYZy8U0NwEo\ncNs+YLqInlX5U45r1nkoy9d3ffbuMfloM1PzghCi7x7PqHipCxZkn/KM7TGLcGgK\n5AYBVssc3eDcwEpCo6lfoRm5KIjwHuFcwsa+Kb1G8HStbtGSEcm2kOo3wTrvB/Rz\n+sigfMTKMD759y7YLZK4wQ+brS6LEVVRT9dn7TUAPZ1NsNEvvj6gC6U3eKBkHGR3\nWTj+pEvOGL8KrbFkL5cC928Ec10IoGFYf9a1IZHBRF54Wp/9sMVNmQzIJdlGXl79\n1xfrPQ8fLeMyMiwTwWN45288Pm91WTJ/EUD76OW6sAPEV9Scdb/hbFJeDw4nL4Aw\nMQIDAQAB\n-----END PUBLIC KEY-----";

/// Período de gracia offline: 7 días sin validar con el servidor.
pub const OFFLINE_GRACE_PERIOD_MS: u64 = 7 * 24 * 60 * 60 * 1000;

/// Umbral para considerar la licencia "expirando pronto": 3 días.
pub const EXPIRING_SOON_THRESHOLD_MS: u64 = 3 * 24 * 60 * 60 * 1000;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LicenseState {
    pub payload: LicensePayload,
    pub status: LicenseStatus,
    pub last_validation_ms: u64,
    /// Indica si la licencia fue cargada desde caché offline (SQLite).
    pub from_cache: bool,
}

pub struct LicenseManager {
    state: RwLock<Option<LicenseState>>,
    logger: Arc<dyn Logger>,
}

impl LicenseManager {
    pub fn new(logger: Arc<dyn Logger>) -> Self {
        Self {
            state: RwLock::new(None),
            logger,
        }
    }

    /// Carga un payload firmado recibido del servidor de licencias.
    /// En pruebas privadas: acepta el payload sin verificar la firma RSA.
    /// En producción: verificar con la public key embebida antes de `load`.
    pub fn load(&self, payload: LicensePayload, now_ms: u64) -> CoreResult<()> {
        let status = self.compute_status(&payload, now_ms);

        self.logger.log(LogEntry::new(
            &crate::clock::ProductionClock,
            LogLevel::Info,
            "license",
            format!(
                "licencia cargada: plan={:?} status={:?} device={}",
                payload.plan, status, payload.device_id
            ),
        ));

        *self.state.write().expect("lock envenenado") = Some(LicenseState {
            payload,
            status,
            last_validation_ms: now_ms,
            from_cache: false,
        });

        Ok(())
    }

    /// Carga desde caché de SQLite (modo offline).
    pub fn load_from_cache(&self, payload: LicensePayload, last_validation_ms: u64, now_ms: u64) {
        let mut status = self.compute_status(&payload, now_ms);

        // Verificar período de gracia offline
        if matches!(status, LicenseStatus::Active | LicenseStatus::ExpiringSoon) {
            let offline_ms = now_ms.saturating_sub(last_validation_ms);
            if offline_ms > OFFLINE_GRACE_PERIOD_MS {
                status = LicenseStatus::OfflineGrace;
                self.logger.log(
                    LogEntry::new(
                        &crate::clock::ProductionClock,
                        LogLevel::Warn,
                        "license",
                        format!(
                            "período de gracia offline excedido ({}h sin validar)",
                            offline_ms / 3_600_000
                        ),
                    )
                    .with_code(ErrorCode::License001),
                );
            }
        }

        *self.state.write().expect("lock envenenado") = Some(LicenseState {
            payload,
            status,
            last_validation_ms,
            from_cache: true,
        });
    }

    /// Consulta si una feature específica está habilitada para el plan actual.
    /// Regla #66: todo el código consulta aquí, nunca hard-codea el plan.
    pub fn is_feature_enabled(&self, feature: &str) -> bool {
        let guard = self.state.read().expect("lock envenenado");
        let Some(state) = guard.as_ref() else {
            return false;
        };

        // Regla #21: si hay un LIVE activo, no interrumpir por licencia.
        // El llamador es responsable de verificar si hay LIVE activo primero.
        if !matches!(
            state.status,
            LicenseStatus::Active | LicenseStatus::ExpiringSoon | LicenseStatus::OfflineGrace
        ) {
            return false;
        }

        state.payload.features.get(feature).copied().unwrap_or(false)
    }

    pub fn status(&self) -> LicenseStatus {
        self.state
            .read()
            .expect("lock envenenado")
            .as_ref()
            .map(|s| s.status)
            .unwrap_or(LicenseStatus::NotActivated)
    }

    pub fn plan(&self) -> Option<LicensePlan> {
        self.state
            .read()
            .expect("lock envenenado")
            .as_ref()
            .map(|s| s.payload.plan)
    }

    pub fn snapshot(&self) -> Option<LicenseState> {
        self.state.read().expect("lock envenenado").clone()
    }

    fn compute_status(&self, payload: &LicensePayload, now_ms: u64) -> LicenseStatus {
        if payload.expires_at > 0 {
            if now_ms > payload.expires_at {
                return LicenseStatus::Expired;
            }
            if payload.expires_at - now_ms < EXPIRING_SOON_THRESHOLD_MS {
                return LicenseStatus::ExpiringSoon;
            }
        }
        LicenseStatus::Active
    }

    /// Genera los feature flags por defecto para un plan dado.
    /// Espejo de PLAN_FEATURES en el servidor.
    pub fn default_features_for_plan(plan: LicensePlan) -> HashMap<String, bool> {
        match plan {
            LicensePlan::Free => [
                ("max_automations_3", true),
                ("overlays", true),
                ("sounds", true),
                ("simulation", false),
                ("history", false),
                ("priority_support", false),
            ]
            .iter()
            .map(|(k, v)| (k.to_string(), *v))
            .collect(),
            LicensePlan::Pro => [
                ("max_automations_3", false),
                ("overlays", true),
                ("sounds", true),
                ("simulation", true),
                ("history", true),
                ("priority_support", false),
            ]
            .iter()
            .map(|(k, v)| (k.to_string(), *v))
            .collect(),
            LicensePlan::Studio => [
                ("max_automations_3", false),
                ("overlays", true),
                ("sounds", true),
                ("simulation", true),
                ("history", true),
                ("priority_support", true),
            ]
            .iter()
            .map(|(k, v)| (k.to_string(), *v))
            .collect(),
        }
    }
}

/// Construye un LicensePayload de prueba (plan PRO, sin expiración)
/// para usar durante las pruebas privadas sin servidor real.
pub fn dev_license_payload(device_id: impl Into<String>) -> LicensePayload {
    LicensePayload {
        license_id: "dev-license-001".to_string(),
        device_id: device_id.into(),
        plan: LicensePlan::Pro,
        features: LicenseManager::default_features_for_plan(LicensePlan::Pro),
        issued_at: 0,
        expires_at: 0, // 0 = sin expiración
    }
}

/// Valida el `device_id` del payload contra el device_id real del sistema.
/// Regla #65: el payload firmado incluye el device_id para evitar transferencia.
pub fn validate_device_binding(payload: &LicensePayload, device_id: &str) -> CoreResult<()> {
    if payload.device_id != device_id {
        return Err(CoreError::domain(
            ErrorCode::License001,
            format!(
                "device_id no coincide: payload={} local={}",
                payload.device_id, device_id
            ),
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::logging::InMemoryLogger;
    use std::sync::Arc;

    fn manager() -> LicenseManager {
        LicenseManager::new(Arc::new(InMemoryLogger::new()))
    }

    fn payload(plan: LicensePlan, expires_at: u64) -> LicensePayload {
        LicensePayload {
            license_id: "test-lic".to_string(),
            device_id: "device-001".to_string(),
            plan,
            features: LicenseManager::default_features_for_plan(plan),
            issued_at: 0,
            expires_at,
        }
    }

    #[test]
    fn sin_licencia_cargada_status_es_not_activated() {
        let m = manager();
        assert_eq!(m.status(), LicenseStatus::NotActivated);
    }

    #[test]
    fn licencia_pro_activa_habilita_simulation() {
        let m = manager();
        m.load(payload(LicensePlan::Pro, 0), 0).unwrap();
        assert_eq!(m.status(), LicenseStatus::Active);
        assert!(m.is_feature_enabled("simulation"));
        assert!(m.is_feature_enabled("history"));
    }

    #[test]
    fn licencia_free_no_habilita_simulation() {
        let m = manager();
        m.load(payload(LicensePlan::Free, 0), 0).unwrap();
        assert!(!m.is_feature_enabled("simulation"));
        assert!(m.is_feature_enabled("overlays"));
    }

    #[test]
    fn licencia_expirada_deshabilita_features() {
        let m = manager();
        let now = 1_000_000u64;
        m.load(payload(LicensePlan::Pro, now - 1), now).unwrap();
        assert_eq!(m.status(), LicenseStatus::Expired);
        assert!(!m.is_feature_enabled("simulation"));
    }

    #[test]
    fn expiring_soon_si_expira_en_menos_de_3_dias() {
        let m = manager();
        let now = 1_000_000u64;
        let expires = now + EXPIRING_SOON_THRESHOLD_MS - 1;
        m.load(payload(LicensePlan::Pro, expires), now).unwrap();
        assert_eq!(m.status(), LicenseStatus::ExpiringSoon);
        // Aún funciona mientras no esté LIVE activo
        assert!(m.is_feature_enabled("simulation"));
    }

    #[test]
    fn grace_period_offline_excedido_cambia_status() {
        let m = manager();
        let last_validation = 0u64;
        let now = OFFLINE_GRACE_PERIOD_MS + 1;
        m.load_from_cache(payload(LicensePlan::Pro, 0), last_validation, now);
        assert_eq!(m.status(), LicenseStatus::OfflineGrace);
    }

    #[test]
    fn validate_device_binding_falla_si_device_id_no_coincide() {
        let p = payload(LicensePlan::Pro, 0);
        let result = validate_device_binding(&p, "otro-device");
        assert!(result.is_err());
    }

    #[test]
    fn dev_license_es_plan_pro_sin_expiracion() {
        let p = dev_license_payload("test-device");
        assert_eq!(p.plan, LicensePlan::Pro);
        assert_eq!(p.expires_at, 0);
    }
}