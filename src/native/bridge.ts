// The typed boundary between the UI and the operating system. React code
// never calls Tauri directly; it goes through a NativeBridge so the whole
// app can run (and be tested) against an in-memory implementation.

export interface FileContent {
  content: string;
  modifiedMs: number;
  hasBom: boolean;
}

export interface DirEntry {
  name: string;
  path: string;
  isDir: boolean;
}

export type NativeErrorKind =
  | "notFound"
  | "permissionDenied"
  | "invalidPath"
  | "unsupportedType"
  | "tooLarge"
  | "invalidEncoding"
  | "io"
  | "watcher"
  | "unknown";

export class NativeError extends Error {
  constructor(
    public kind: NativeErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "NativeError";
  }

  static from(error: unknown): NativeError {
    if (error instanceof NativeError) return error;
    if (error && typeof error === "object" && "kind" in error && "message" in error) {
      const e = error as { kind: string; message: string };
      return new NativeError(e.kind as NativeErrorKind, e.message);
    }
    return new NativeError("unknown", error instanceof Error ? error.message : String(error));
  }
}

export interface OpenDialogOptions {
  title?: string;
  multiple?: boolean;
  directory?: boolean;
  filters?: { name: string; extensions: string[] }[];
  defaultPath?: string;
}

export interface SaveDialogOptions {
  title?: string;
  defaultPath?: string;
  filters?: { name: string; extensions: string[] }[];
}

export type Unlisten = () => void;

export interface NativeBridge {
  readonly isDesktop: boolean;

  readDocument(path: string): Promise<FileContent>;
  /** Returns the new modification time. */
  writeDocument(path: string, content: string, hasBom: boolean): Promise<number>;
  /** Modification time, or null if the file does not exist. */
  statDocument(path: string): Promise<number | null>;
  listDirectory(path: string): Promise<DirEntry[]>;

  watchDocument(path: string): Promise<void>;
  unwatchDocument(path: string): Promise<void>;
  onDocumentChanged(handler: (path: string) => void): Promise<Unlisten>;

  /** Allows the webview to show images next to this document. */
  allowDocumentDirectory(path: string): Promise<void>;
  toAssetUrl(path: string): string;
  startupDocuments(): Promise<string[]>;
  /** Font family names installed on the computer. */
  systemFonts(): Promise<string[]>;

  showOpenDialog(options: OpenDialogOptions): Promise<string[] | null>;
  showSaveDialog(options: SaveDialogOptions): Promise<string | null>;

  openExternal(url: string): Promise<void>;
  setWindowTitle(title: string): Promise<void>;
  /** Called when the user tries to close the window. Return false to keep it open. */
  onCloseRequested(handler: () => Promise<boolean>): Promise<Unlisten>;
  closeWindow(): Promise<void>;
  onFileDrop(handler: (paths: string[]) => void): Promise<Unlisten>;
  onWindowFocus(handler: () => void): Promise<Unlisten>;

  loadStore(key: string): Promise<unknown>;
  saveStore(key: string, value: unknown): Promise<void>;
}
