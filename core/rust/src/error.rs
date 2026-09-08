//! Sistema de errores central del Core (Etapa 2). Regla #51: un error de un
//! módulo no debe tumbar la aplicación — `CoreError` se propaga con
//! `Result`, nunca con panics en código de negocio.

use crate::logging::ErrorCode;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum CoreError {
    /// Error de negocio con código estable de la Sección 29.
    #[error("[{code}] {message}")]
    Domain { code: ErrorCode, message: String },

    #[error("error de I/O: {0}")]
    Io(#[from] std::io::Error),

    #[error("error de serialización JSON: {0}")]
    Json(#[from] serde_json::Error),

    #[error("error de base de datos: {0}")]
    Database(#[from] rusqlite::Error),
}

impl CoreError {
    pub fn domain(code: ErrorCode, message: impl Into<String>) -> Self {
        CoreError::Domain {
            code,
            message: message.into(),
        }
    }

    /// `None` para errores de infraestructura (I/O, JSON, DB) que no tienen
    /// un código de negocio propio de la Sección 29.
    pub fn code(&self) -> Option<ErrorCode> {
        match self {
            CoreError::Domain { code, .. } => Some(*code),
            _ => None,
        }
    }
}

pub type CoreResult<T> = Result<T, CoreError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn core_error_domain_expone_su_codigo() {
        let err = CoreError::domain(ErrorCode::Audio001, "archivo no encontrado");
        assert_eq!(err.code(), Some(ErrorCode::Audio001));
        assert!(err.to_string().contains("AUDIO_001"));
    }

    #[test]
    fn core_error_convierte_io_error_automaticamente() {
        let io_err = std::io::Error::new(std::io::ErrorKind::NotFound, "no existe");
        let core_err: CoreError = io_err.into();
        assert!(matches!(core_err, CoreError::Io(_)));
        assert_eq!(core_err.code(), None);
    }
}
