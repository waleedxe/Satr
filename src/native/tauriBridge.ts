import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { open, save } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import { load, type Store } from "@tauri-apps/plugin-store";

import { NativeError } from "./bridge";
import type { DirEntry, FileContent, NativeBridge } from "./bridge";

async function call<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(command, args);
  } catch (error) {
    throw NativeError.from(error);
  }
}

let storePromise: Promise<Store> | null = null;
function store(): Promise<Store> {
  storePromise ??= load("settings.json", { autoSave: 300, defaults: {} });
  return storePromise;
}

export const tauriBridge: NativeBridge = {
  isDesktop: true,

  readDocument: (path) => call<FileContent>("read_document", { path }),
  writeDocument: (path, content, hasBom) =>
    call<number>("write_document", { path, content, hasBom }),
  statDocument: (path) => call<number | null>("stat_document", { path }),
  listDirectory: (path) => call<DirEntry[]>("list_directory", { path }),

  watchDocument: (path) => call<void>("watch_document", { path }),
  unwatchDocument: (path) => call<void>("unwatch_document", { path }),
  async onDocumentChanged(handler) {
    return listen<{ path: string }>("file-changed", (event) => handler(event.payload.path));
  },

  allowDocumentDirectory: (path) => call<void>("allow_document_directory", { path }),
  toAssetUrl: (path) => convertFileSrc(path),
  startupDocuments: () => call<string[]>("startup_documents"),

  async showOpenDialog(options) {
    const result = await open({
      title: options.title,
      multiple: options.multiple ?? false,
      directory: options.directory ?? false,
      filters: options.filters,
      defaultPath: options.defaultPath,
    });
    if (result === null) return null;
    return Array.isArray(result) ? result : [result];
  },
  async showSaveDialog(options) {
    return save({
      title: options.title,
      defaultPath: options.defaultPath,
      filters: options.filters,
    });
  },

  async openExternal(url) {
    await openUrl(url);
  },
  async setWindowTitle(title) {
    await getCurrentWindow().setTitle(title);
  },
  async onCloseRequested(handler) {
    return getCurrentWindow().onCloseRequested(async (event) => {
      event.preventDefault();
      if (await handler()) await getCurrentWindow().destroy();
    });
  },
  async closeWindow() {
    await getCurrentWindow().close();
  },
  async onFileDrop(handler) {
    return getCurrentWebview().onDragDropEvent((event) => {
      if (event.payload.type === "drop") handler(event.payload.paths);
    });
  },
  async onWindowFocus(handler) {
    return getCurrentWindow().onFocusChanged(({ payload: focused }) => {
      if (focused) handler();
    });
  },

  async loadStore(key) {
    return (await store()).get(key);
  },
  async saveStore(key, value) {
    await (await store()).set(key, value);
  },
};
