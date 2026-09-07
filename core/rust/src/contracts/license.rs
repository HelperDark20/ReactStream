//! Contratos de licenciamiento (Sección 26). El payload firmado nunca
//! contiene la llave privada (Regla #64) — esta vive solo en el servidor.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "UPPERCASE")]
pub enum LicensePlan {
    Free,
    Pro,
    Studio,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum LicenseStatus {
    NotActivated,
    Active,
    ExpiringSoon,
    Expired,
    Revoked,
    DeviceLimit,
    OfflineGrace,
    Invalid,
}

/// Payload firmado por el servidor; el cliente solo contiene la public key
/// (Regla #64-65).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LicensePayload {
    pub license_id: String,
    pub device_id: String,
    pub plan: LicensePlan,
    pub features: HashMap<String, bool>,
    pub issued_at: u64,
    pub expires_at: u64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn license_plan_serializa_uppercase() {
        assert_eq!(serde_json::to_value(LicensePlan::Pro).unwrap(), "PRO");
    }

    #[test]
    fn license_status_serializa_screaming_snake_case() {
        assert_eq!(
            serde_json::to_value(LicenseStatus::OfflineGrace).unwrap(),
            "OFFLINE_GRACE"
        );
    }
}
