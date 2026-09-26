//! Tauri commands exposed to the frontend. They are thin wrappers that run
//! blocking file work off the async runtime's worker threads.

use std::path::PathBuf;

use tauri::{AppHandle, Manager, State};

use crate::errors::{AppError, AppResult};
use crate::filesystem::{self, DirEntry, FileContent};
use crate::watcher::FileWatcher;

async fn blocking<T, F>(f: F) -> AppResult<T>
where
    T: Send + 'static,
    F: FnOnce() -> AppResult<T> + Send + 'static,
{
    tauri::async_runtime::spawn_blocking(f)
        .await
        .map_err(|e| AppError::Io(e.to_string()))?
}

#[tauri::command]
pub async fn read_document(path: String) -> AppResult<FileContent> {
    blocking(move || filesystem::read_document(&path)).await
}

#[tauri::command]
pub async fn write_document(path: String, content: String, has_bom: bool) -> AppResult<u64> {
    blocking(move || filesystem::write_document(&path, &content, has_bom)).await
}

#[tauri::command]
pub async fn stat_document(path: String) -> AppResult<Option<u64>> {
    blocking(move || filesystem::stat_document(&path)).await
}

#[tauri::command]
pub async fn list_directory(path: String) -> AppResult<Vec<DirEntry>> {
    blocking(move || filesystem::list_directory(&path)).await
}

#[tauri::command]
pub fn watch_document(path: String, watcher: State<'_, FileWatcher>) -> AppResult<()> {
    filesystem::validate_document_path(&path)?;
    watcher.watch(&path)
}

#[tauri::command]
pub fn unwatch_document(path: String, watcher: State<'_, FileWatcher>) -> AppResult<()> {
    watcher.unwatch(&path)
}

/// Lets the webview load local images that sit next to an open document.
/// Only the directory of a document the user opened is ever allowed.
#[tauri::command]
pub fn allow_document_directory(app: AppHandle, path: String) -> AppResult<()> {
    let doc = filesystem::validate_document_path(&path)?;
    let dir = doc
        .parent()
        .ok_or_else(|| AppError::InvalidPath(path.clone()))?;
    app.asset_protocol_scope()
        .allow_directory(dir, true)
        .map_err(|e| AppError::Io(e.to_string()))
}

/// Document paths passed on the command line (e.g. via file association).
#[tauri::command]
pub fn startup_documents() -> Vec<String> {
    std::env::args()
        .skip(1)
        .filter(|arg| !arg.starts_with('-'))
        .filter(|arg| {
            filesystem::validate_document_path(arg).is_ok() && PathBuf::from(arg).is_file()
        })
        .collect()
}
