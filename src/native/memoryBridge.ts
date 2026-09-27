import { NativeError } from "./bridge";
import type { DirEntry, NativeBridge, Unlisten } from "./bridge";
import { isMarkdownPath, samePath } from "../utils/path";

interface MemoryFile {
  content: string;
  mtime: number;
  hasBom: boolean;
}

/**
 * In-memory NativeBridge used by tests and when the UI runs in a plain
 * browser (`npm run dev` without Tauri). Dialog results are scripted.
 */
export class MemoryBridge implements NativeBridge {
  readonly isDesktop = false;
  files = new Map<string, MemoryFile>();
  store = new Map<string, unknown>();
  watched = new Set<string>();
  openDialogResults: (string[] | null)[] = [];
  saveDialogResults: (string | null)[] = [];
  openedUrls: string[] = [];
  title = "";
  startup: string[] = [];
  private clock = 1_000;
  private changeHandlers = new Set<(path: string) => void>();
  private dropHandlers = new Set<(paths: string[]) => void>();
  private focusHandlers = new Set<() => void>();
  private closeHandler: (() => Promise<boolean>) | null = null;
  closed = false;

  private key(path: string): string {
    for (const existing of this.files.keys()) if (samePath(existing, path)) return existing;
    return path;
  }

  /** Simulates another program writing the file. */
  externalWrite(path: string, content: string): void {
    this.files.set(this.key(path), { content, mtime: ++this.clock, hasBom: false });
    this.emitChange(path);
  }

  externalDelete(path: string): void {
    this.files.delete(this.key(path));
    this.emitChange(path);
  }

  emitChange(path: string): void {
    for (const handler of this.changeHandlers) handler(path);
  }

  emitDrop(paths: string[]): void {
    for (const handler of this.dropHandlers) handler(paths);
  }

  emitFocus(): void {
    for (const handler of this.focusHandlers) handler();
  }

  async requestClose(): Promise<boolean> {
    const ok = this.closeHandler ? await this.closeHandler() : true;
    if (ok) this.closed = true;
    return ok;
  }

  async readDocument(path: string) {
    if (!isMarkdownPath(path))
      throw new NativeError("unsupportedType", `Unsupported file type: ${path}`);
    const file = this.files.get(this.key(path));
    if (!file) throw new NativeError("notFound", `File not found: ${path}`);
    return { content: file.content, modifiedMs: file.mtime, hasBom: file.hasBom };
  }

  async writeDocument(path: string, content: string, hasBom: boolean) {
    const mtime = ++this.clock;
    this.files.set(this.key(path), { content, mtime, hasBom });
    return mtime;
  }

  async statDocument(path: string) {
    return this.files.get(this.key(path))?.mtime ?? null;
  }

  async listDirectory(path: string): Promise<DirEntry[]> {
    const entries = new Map<string, DirEntry>();
    for (const file of this.files.keys()) {
      if (!file.startsWith(path)) continue;
      const rest = file.slice(path.length).replace(/^[\\/]/, "");
      const [first, ...more] = rest.split(/[\\/]/);
      if (!first) continue;
      const sep = path.includes("\\") ? "\\" : "/";
      const full = `${path.replace(/[\\/]$/, "")}${sep}${first}`;
      entries.set(first, { name: first, path: full, isDir: more.length > 0 });
    }
    return [...entries.values()].sort(
      (a, b) => Number(b.isDir) - Number(a.isDir) || a.name.localeCompare(b.name),
    );
  }

  async watchDocument(path: string) {
    this.watched.add(path);
  }
  async unwatchDocument(path: string) {
    this.watched.delete(path);
  }
  async onDocumentChanged(handler: (path: string) => void): Promise<Unlisten> {
    this.changeHandlers.add(handler);
    return () => this.changeHandlers.delete(handler);
  }

  async allowDocumentDirectory() {}
  toAssetUrl(path: string) {
    return `memory://${path}`;
  }
  async startupDocuments() {
    return this.startup;
  }
  async systemFonts() {
    return ["Arial", "Segoe UI", "Times New Roman"];
  }

  async showOpenDialog() {
    return this.openDialogResults.shift() ?? null;
  }
  async showSaveDialog() {
    return this.saveDialogResults.shift() ?? null;
  }

  async openExternal(url: string) {
    this.openedUrls.push(url);
  }
  async setWindowTitle(title: string) {
    this.title = title;
    if (typeof document !== "undefined") document.title = title;
  }
  async onCloseRequested(handler: () => Promise<boolean>): Promise<Unlisten> {
    this.closeHandler = handler;
    return () => {
      this.closeHandler = null;
    };
  }
  async closeWindow() {
    await this.requestClose();
  }
  async onFileDrop(handler: (paths: string[]) => void): Promise<Unlisten> {
    this.dropHandlers.add(handler);
    return () => this.dropHandlers.delete(handler);
  }
  async onWindowFocus(handler: () => void): Promise<Unlisten> {
    this.focusHandlers.add(handler);
    return () => this.focusHandlers.delete(handler);
  }

  async loadStore(key: string) {
    return this.store.get(key);
  }
  async saveStore(key: string, value: unknown) {
    this.store.set(key, structuredClone(value));
  }
}

/** A browser-dev bridge preloaded with a sample document. */
export function createDemoBridge(): MemoryBridge {
  const bridge = new MemoryBridge();
  bridge.files.set("/demo/Welcome.md", {
    content: "# Welcome to Satr\n\nThis is a browser preview running without the desktop shell.\n",
    mtime: 1,
    hasBom: false,
  });
  return bridge;
}
