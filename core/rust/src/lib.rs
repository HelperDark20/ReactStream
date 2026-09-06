//! ReactStream Core
//!
//! Este crate es la autoridad de negocio de la aplicación (Regla inmutable #1).
//! React, el Bridge de Node y los Overlays NUNCA contienen lógica de negocio;
//! todo pasa por aquí. Ver `docs/architecture` para el diagrama de flujo completo.

pub mod actions;
pub mod audio;
pub mod automation;
pub mod database;
pub mod event_bus;
pub mod keystroke;
pub mod license;
pub mod logging;
pub mod overlays;
pub mod rankings;
pub mod session;
pub mod simulation;
pub mod state;
pub mod timer;
