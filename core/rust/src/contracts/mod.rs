//! Contratos compartidos (Etapa 1). La fuente de verdad TypeScript vive en
//! `packages/events` y `packages/types`; este módulo es el equivalente Rust
//! con serialización JSON idéntica (camelCase) para mantener compatibilidad
//! de wire format con TS/Bridge/Overlays (Regla #14: los eventos
//! normalizados son contratos estables).
//!
//! Cambios aquí requieren la Regla #75: actualizar contratos formalmente,
//! acompañados de pruebas, en ambos lados (TS y Rust) a la vez.

pub mod automation;
pub mod events;
pub mod license;
pub mod protocol;
pub mod session;

pub use automation::*;
pub use events::*;
pub use license::*;
pub use protocol::*;
pub use session::*;
