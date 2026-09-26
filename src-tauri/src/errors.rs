use serde::ser::SerializeStruct;
use serde::{Serialize, Serializer};

/// Errors returned to the frontend. Serialized as `{ kind, message }` so the
/// UI can branch on `kind` without parsing message strings.
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("File not found: {0}")]
    NotFound(String),
    #[error("Permission denied: {0}")]
    PermissionDenied(String),
    #[error("Invalid path: {0}")]
    InvalidPath(String),
    #[error("Unsupported file type: {0}")]
    UnsupportedType(String),
    #[error("File is too large to open ({0} bytes)")]
    TooLarge(u64),
    #[error("File is not valid UTF-8 text")]
    InvalidEncoding,
    #[error("I/O error: {0}")]
    Io(String),
    #[error("File watcher error: {0}")]
    Watcher(String),
}

impl AppError {
    pub fn kind(&self) -> &'static str {
        match self {
            AppError::NotFound(_) => "notFound",
            AppError::PermissionDenied(_) => "permissionDenied",
            AppError::InvalidPath(_) => "invalidPath",
            AppError::UnsupportedType(_) => "unsupportedType",
            AppError::TooLarge(_) => "tooLarge",
            AppError::InvalidEncoding => "invalidEncoding",
            AppError::Io(_) => "io",
            AppError::Watcher(_) => "watcher",
        }
    }

    pub fn from_io(err: std::io::Error, path: &str) -> Self {
        match err.kind() {
            std::io::ErrorKind::NotFound => AppError::NotFound(path.to_string()),
            std::io::ErrorKind::PermissionDenied => AppError::PermissionDenied(path.to_string()),
            _ => AppError::Io(format!("{path}: {err}")),
        }
    }
}

impl Serialize for AppError {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let mut state = serializer.serialize_struct("AppError", 2)?;
        state.serialize_field("kind", self.kind())?;
        state.serialize_field("message", &self.to_string())?;
        state.end()
    }
}

pub type AppResult<T> = Result<T, AppError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serializes_kind_and_message() {
        let json = serde_json::to_value(AppError::NotFound("a.md".into())).unwrap();
        assert_eq!(json["kind"], "notFound");
        assert_eq!(json["message"], "File not found: a.md");
    }

    #[test]
    fn maps_io_error_kinds() {
        let err = std::io::Error::from(std::io::ErrorKind::NotFound);
        assert!(matches!(AppError::from_io(err, "x"), AppError::NotFound(_)));
        let err = std::io::Error::from(std::io::ErrorKind::PermissionDenied);
        assert!(matches!(
            AppError::from_io(err, "x"),
            AppError::PermissionDenied(_)
        ));
    }
}
