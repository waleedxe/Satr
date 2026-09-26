//! Watches open documents for changes made by other programs.
//!
//! Each document's parent directory is watched non-recursively (so atomic
//! "write temp + rename" saves by other editors are seen too). Events for
//! watched files are forwarded to the frontend as `file-changed`; the
//! frontend then stats the file and decides whether it actually changed.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;

use crate::errors::{AppError, AppResult};

pub const FILE_CHANGED_EVENT: &str = "file-changed";

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct FileChangedPayload {
    pub path: String,
}

/// Normalized key used to compare paths (case-insensitive on Windows).
fn path_key(path: &Path) -> String {
    let s = path.to_string_lossy().replace('/', "\\");
    if cfg!(windows) {
        s.to_lowercase()
    } else {
        s
    }
}

#[derive(Default)]
struct WatchState {
    /// normalized file key -> original path string given by the frontend
    files: HashMap<String, String>,
    /// watched directory -> number of watched files inside it
    dirs: HashMap<PathBuf, usize>,
}

pub struct FileWatcher {
    watcher: Mutex<Option<RecommendedWatcher>>,
    state: Arc<Mutex<WatchState>>,
}

impl FileWatcher {
    /// `emit` is called with the frontend path of each changed file.
    pub fn new<F>(emit: F) -> Self
    where
        F: Fn(FileChangedPayload) + Send + 'static,
    {
        let state: Arc<Mutex<WatchState>> = Arc::default();
        let handler_state = Arc::clone(&state);
        let watcher = notify::recommended_watcher(move |res: notify::Result<Event>| {
            let Ok(event) = res else { return };
            if matches!(event.kind, EventKind::Access(_)) {
                return;
            }
            let Ok(state) = handler_state.lock() else {
                return;
            };
            for path in &event.paths {
                if let Some(original) = state.files.get(&path_key(path)) {
                    emit(FileChangedPayload {
                        path: original.clone(),
                    });
                }
            }
        })
        .ok();
        Self {
            watcher: Mutex::new(watcher),
            state,
        }
    }

    pub fn watch(&self, raw: &str) -> AppResult<()> {
        let path = PathBuf::from(raw);
        let dir = path
            .parent()
            .ok_or_else(|| AppError::InvalidPath(raw.to_string()))?
            .to_path_buf();
        let key = path_key(&path);
        let mut state = self.state.lock().map_err(|_| poisoned())?;
        if state.files.contains_key(&key) {
            return Ok(());
        }
        let count = state.dirs.entry(dir.clone()).or_insert(0);
        if *count == 0 {
            let mut guard = self.watcher.lock().map_err(|_| poisoned())?;
            if let Some(watcher) = guard.as_mut() {
                watcher
                    .watch(&dir, RecursiveMode::NonRecursive)
                    .map_err(|e| AppError::Watcher(e.to_string()))?;
            }
        }
        *count += 1;
        state.files.insert(key, raw.to_string());
        Ok(())
    }

    pub fn unwatch(&self, raw: &str) -> AppResult<()> {
        let path = PathBuf::from(raw);
        let key = path_key(&path);
        let mut state = self.state.lock().map_err(|_| poisoned())?;
        if state.files.remove(&key).is_none() {
            return Ok(());
        }
        let Some(dir) = path.parent().map(Path::to_path_buf) else {
            return Ok(());
        };
        let remove_dir = match state.dirs.get_mut(&dir) {
            Some(count) => {
                *count = count.saturating_sub(1);
                *count == 0
            }
            None => false,
        };
        if remove_dir {
            state.dirs.remove(&dir);
            let mut guard = self.watcher.lock().map_err(|_| poisoned())?;
            if let Some(watcher) = guard.as_mut() {
                let _ = watcher.unwatch(&dir);
            }
        }
        Ok(())
    }

    #[cfg(test)]
    fn watched_count(&self) -> (usize, usize) {
        let state = self.state.lock().unwrap();
        (state.files.len(), state.dirs.len())
    }
}

fn poisoned() -> AppError {
    AppError::Watcher("internal lock poisoned".into())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::mpsc;
    use std::time::Duration;

    #[test]
    fn reference_counts_directories() {
        let dir = tempfile::tempdir().unwrap();
        let a = dir.path().join("a.md").to_string_lossy().to_string();
        let b = dir.path().join("b.md").to_string_lossy().to_string();
        let watcher = FileWatcher::new(|_| {});
        watcher.watch(&a).unwrap();
        watcher.watch(&b).unwrap();
        watcher.watch(&a).unwrap();
        assert_eq!(watcher.watched_count(), (2, 1));
        watcher.unwatch(&a).unwrap();
        assert_eq!(watcher.watched_count(), (1, 1));
        watcher.unwatch(&b).unwrap();
        assert_eq!(watcher.watched_count(), (0, 0));
    }

    #[test]
    fn reports_external_modification() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("watched.md");
        std::fs::write(&file, "one").unwrap();
        let raw = file.to_string_lossy().to_string();

        let (tx, rx) = mpsc::channel();
        let watcher = FileWatcher::new(move |payload| {
            let _ = tx.send(payload);
        });
        watcher.watch(&raw).unwrap();
        std::fs::write(dir.path().join("other.md"), "ignored").unwrap();
        std::thread::sleep(Duration::from_millis(100));
        std::fs::write(&file, "two").unwrap();

        let payload = rx
            .recv_timeout(Duration::from_secs(5))
            .expect("expected a change event");
        assert_eq!(payload.path, raw);
    }
}
