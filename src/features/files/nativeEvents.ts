import { bridge } from "../../native";
import type { Unlisten } from "../../native";
import {
  checkOpenDocuments,
  closeAllDocuments,
  handleDroppedPaths,
  handleExternalChange,
} from "./fileActions";

/**
 * Connects OS-level events (file changes, drops, focus, window close) to
 * the document workflow. Returns a function that removes all listeners.
 */
export async function installNativeListeners(): Promise<Unlisten> {
  const native = bridge();
  const unlisten = await Promise.all([
    native.onDocumentChanged((path) => void handleExternalChange(path)),
    native.onFileDrop((paths) => void handleDroppedPaths(paths)),
    // Watchers can miss events (network drives, sleep); re-check on focus.
    native.onWindowFocus(() => void checkOpenDocuments()),
    native.onCloseRequested(() => closeAllDocuments()),
  ]);
  return () => unlisten.forEach((fn) => fn());
}
