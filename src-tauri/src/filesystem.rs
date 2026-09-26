//! Document file access. Every path coming from the frontend is validated
//! here before it touches the disk.

use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

use serde::Serialize;

use crate::errors::{AppError, AppResult};

/// Extensions the editor is allowed to read and write.
pub const DOCUMENT_EXTENSIONS: &[&str] = &["md", "markdown", "mdown", "mkd", "mkdn", "mdwn", "txt"];

/// Hard upper bound for opening a file. The editor targets 1–5 MB documents;
/// anything far beyond that is almost certainly not a hand-written document.
pub const MAX_FILE_BYTES: u64 = 64 * 1024 * 1024;

const UTF8_BOM: &[u8] = &[0xEF, 0xBB, 0xBF];

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FileContent {
    pub content: String,
    pub modified_ms: u64,
    pub has_bom: bool,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DirEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
}

fn has_document_extension(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| {
            DOCUMENT_EXTENSIONS
                .iter()
                .any(|allowed| allowed.eq_ignore_ascii_case(ext))
        })
        .unwrap_or(false)
}

/// Accepts only absolute paths without NUL bytes.
pub fn validate_absolute_path(raw: &str) -> AppResult<PathBuf> {
    if raw.trim().is_empty() || raw.contains('\0') {
        return Err(AppError::InvalidPath(raw.to_string()));
    }
    let path = PathBuf::from(raw);
    if !path.is_absolute() {
        return Err(AppError::InvalidPath(raw.to_string()));
    }
    Ok(path)
}

/// Accepts only absolute paths with a Markdown/text extension.
pub fn validate_document_path(raw: &str) -> AppResult<PathBuf> {
    let path = validate_absolute_path(raw)?;
    if !has_document_extension(&path) {
        return Err(AppError::UnsupportedType(raw.to_string()));
    }
    Ok(path)
}

fn modified_ms(meta: &fs::Metadata) -> u64 {
    meta.modified()
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|dur| dur.as_millis() as u64)
        .unwrap_or(0)
}

pub fn read_document(raw: &str) -> AppResult<FileContent> {
    let path = validate_document_path(raw)?;
    let meta = fs::metadata(&path).map_err(|e| AppError::from_io(e, raw))?;
    if meta.is_dir() {
        return Err(AppError::InvalidPath(raw.to_string()));
    }
    if meta.len() > MAX_FILE_BYTES {
        return Err(AppError::TooLarge(meta.len()));
    }
    let bytes = fs::read(&path).map_err(|e| AppError::from_io(e, raw))?;
    let has_bom = bytes.starts_with(UTF8_BOM);
    let body = if has_bom { &bytes[3..] } else { &bytes[..] };
    let content = String::from_utf8(body.to_vec()).map_err(|_| AppError::InvalidEncoding)?;
    Ok(FileContent {
        content,
        modified_ms: modified_ms(&meta),
        has_bom,
    })
}

/// Writes atomically: the content goes to a temp file in the same directory,
/// which is then renamed over the target, so a crash never leaves a
/// half-written document behind.
pub fn write_document(raw: &str, content: &str, has_bom: bool) -> AppResult<u64> {
    let path = validate_document_path(raw)?;
    let dir = path
        .parent()
        .ok_or_else(|| AppError::InvalidPath(raw.to_string()))?;
    if !dir.is_dir() {
        return Err(AppError::NotFound(dir.display().to_string()));
    }
    let file_name = path
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or_else(|| AppError::InvalidPath(raw.to_string()))?;
    let tmp_path = dir.join(format!(".{file_name}.{}.tmp", std::process::id()));

    let write_tmp = || -> std::io::Result<()> {
        let mut file = fs::File::create(&tmp_path)?;
        if has_bom {
            file.write_all(UTF8_BOM)?;
        }
        file.write_all(content.as_bytes())?;
        file.sync_all()
    };

    if let Err(err) = write_tmp() {
        let _ = fs::remove_file(&tmp_path);
        return Err(AppError::from_io(err, raw));
    }

    if let Err(rename_err) = fs::rename(&tmp_path, &path) {
        // Some Windows setups (e.g. files held open by other programs)
        // refuse the rename; fall back to a direct write.
        let _ = fs::remove_file(&tmp_path);
        let mut bytes = Vec::with_capacity(content.len() + 3);
        if has_bom {
            bytes.extend_from_slice(UTF8_BOM);
        }
        bytes.extend_from_slice(content.as_bytes());
        fs::write(&path, bytes).map_err(|_| AppError::from_io(rename_err, raw))?;
    }

    let meta = fs::metadata(&path).map_err(|e| AppError::from_io(e, raw))?;
    Ok(modified_ms(&meta))
}

/// Returns the modification time, or `None` if the file no longer exists.
pub fn stat_document(raw: &str) -> AppResult<Option<u64>> {
    let path = validate_absolute_path(raw)?;
    match fs::metadata(&path) {
        Ok(meta) if meta.is_file() => Ok(Some(modified_ms(&meta))),
        Ok(_) => Ok(None),
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(err) => Err(AppError::from_io(err, raw)),
    }
}

/// Lists sub-directories and document files of one directory (non-recursive).
/// Hidden entries are skipped. Directories come first, then files, each
/// sorted case-insensitively.
pub fn list_directory(raw: &str) -> AppResult<Vec<DirEntry>> {
    let path = validate_absolute_path(raw)?;
    let mut entries: Vec<DirEntry> = fs::read_dir(&path)
        .map_err(|e| AppError::from_io(e, raw))?
        .filter_map(Result::ok)
        .filter_map(|entry| {
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with('.') {
                return None;
            }
            let file_type = entry.file_type().ok()?;
            let entry_path = entry.path();
            let is_dir = file_type.is_dir();
            if !is_dir && !has_document_extension(&entry_path) {
                return None;
            }
            Some(DirEntry {
                name,
                path: entry_path.to_string_lossy().to_string(),
                is_dir,
            })
        })
        .collect();
    entries.sort_by(|a, b| {
        b.is_dir
            .cmp(&a.is_dir)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });
    Ok(entries)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn path_str(p: &Path) -> String {
        p.to_string_lossy().to_string()
    }

    #[test]
    fn rejects_relative_and_empty_paths() {
        assert!(matches!(
            validate_document_path("notes.md"),
            Err(AppError::InvalidPath(_))
        ));
        assert!(matches!(
            validate_document_path(""),
            Err(AppError::InvalidPath(_))
        ));
        assert!(matches!(
            validate_document_path("a\0b.md"),
            Err(AppError::InvalidPath(_))
        ));
    }

    #[test]
    fn rejects_non_document_extensions() {
        let dir = tempfile::tempdir().unwrap();
        let exe = dir.path().join("evil.exe");
        assert!(matches!(
            validate_document_path(&path_str(&exe)),
            Err(AppError::UnsupportedType(_))
        ));
        let md = dir.path().join("Notes.MD");
        assert!(validate_document_path(&path_str(&md)).is_ok());
    }

    #[test]
    fn write_then_read_roundtrip_preserves_unicode() {
        let dir = tempfile::tempdir().unwrap();
        let file = path_str(&dir.path().join("doc.md"));
        let text = "# مرحبا Hello\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n😀\n";
        let mtime = write_document(&file, text, false).unwrap();
        assert!(mtime > 0);
        let read = read_document(&file).unwrap();
        assert_eq!(read.content, text);
        assert!(!read.has_bom);
        assert_eq!(read.modified_ms, mtime);
    }

    #[test]
    fn preserves_bom() {
        let dir = tempfile::tempdir().unwrap();
        let file = path_str(&dir.path().join("bom.md"));
        write_document(&file, "hi\n", true).unwrap();
        let bytes = fs::read(&file).unwrap();
        assert!(bytes.starts_with(UTF8_BOM));
        let read = read_document(&file).unwrap();
        assert_eq!(read.content, "hi\n");
        assert!(read.has_bom);
    }

    #[test]
    fn overwrite_leaves_no_temp_files() {
        let dir = tempfile::tempdir().unwrap();
        let file = path_str(&dir.path().join("doc.md"));
        write_document(&file, "one", false).unwrap();
        write_document(&file, "two", false).unwrap();
        assert_eq!(read_document(&file).unwrap().content, "two");
        let names: Vec<_> = fs::read_dir(dir.path())
            .unwrap()
            .map(|e| e.unwrap().file_name())
            .collect();
        assert_eq!(names.len(), 1);
    }

    #[test]
    fn reading_missing_file_is_not_found() {
        let dir = tempfile::tempdir().unwrap();
        let file = path_str(&dir.path().join("missing.md"));
        assert!(matches!(read_document(&file), Err(AppError::NotFound(_))));
        assert_eq!(stat_document(&file).unwrap(), None);
    }

    #[test]
    fn rejects_invalid_utf8() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("bin.md");
        fs::write(&file, [0xff, 0xfe, 0x00, 0xc3]).unwrap();
        assert!(matches!(
            read_document(&path_str(&file)),
            Err(AppError::InvalidEncoding)
        ));
    }

    #[test]
    fn stat_reports_mtime_for_existing_file() {
        let dir = tempfile::tempdir().unwrap();
        let file = path_str(&dir.path().join("a.md"));
        let mtime = write_document(&file, "x", false).unwrap();
        assert_eq!(stat_document(&file).unwrap(), Some(mtime));
    }

    #[test]
    fn lists_directories_and_documents_only() {
        let dir = tempfile::tempdir().unwrap();
        fs::create_dir(dir.path().join("sub")).unwrap();
        fs::create_dir(dir.path().join(".git")).unwrap();
        fs::write(dir.path().join("b.md"), "").unwrap();
        fs::write(dir.path().join("A.markdown"), "").unwrap();
        fs::write(dir.path().join("image.png"), "").unwrap();
        fs::write(dir.path().join(".hidden.md"), "").unwrap();
        let entries = list_directory(&path_str(dir.path())).unwrap();
        let names: Vec<_> = entries.iter().map(|e| e.name.as_str()).collect();
        assert_eq!(names, vec!["sub", "A.markdown", "b.md"]);
        assert!(entries[0].is_dir);
    }

    #[test]
    fn write_to_missing_directory_fails() {
        let dir = tempfile::tempdir().unwrap();
        let file = path_str(&dir.path().join("nope").join("a.md"));
        assert!(matches!(
            write_document(&file, "x", false),
            Err(AppError::NotFound(_))
        ));
    }
}
