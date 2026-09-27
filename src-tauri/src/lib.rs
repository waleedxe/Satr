mod commands;
mod errors;
mod filesystem;
mod fonts;
mod watcher;

use tauri::{Emitter, Manager};

use crate::watcher::{FileWatcher, FILE_CHANGED_EVENT};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .setup(|app| {
            let handle = app.handle().clone();
            app.manage(FileWatcher::new(move |payload| {
                let _ = handle.emit(FILE_CHANGED_EVENT, payload);
            }));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::read_document,
            commands::write_document,
            commands::stat_document,
            commands::list_directory,
            commands::watch_document,
            commands::unwatch_document,
            commands::allow_document_directory,
            commands::startup_documents,
            commands::system_fonts,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Satr");
}
