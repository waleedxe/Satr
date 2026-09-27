import { installGlobalShortcuts } from "./shortcuts";
import { openPath } from "../features/files/fileActions";
import { installNativeListeners } from "../features/files/nativeEvents";
import { initBridge } from "../native";
import { useSettings } from "../stores/settingsStore";

let started: Promise<void> | null = null;

/** One-time app start-up. Safe to call repeatedly (e.g. under StrictMode). */
export function bootstrap(): Promise<void> {
  started ??= (async () => {
    const native = await initBridge();
    await useSettings.getState().load();
    await installNativeListeners();
    installGlobalShortcuts();

    // The default context menu offers "Reload" and similar browser items;
    // keep it only where it is useful (text editing, for spellcheck and paste).
    window.addEventListener("contextmenu", (event) => {
      const target = event.target as HTMLElement | null;
      const editable = target?.closest("input, textarea, [contenteditable='true'], .cm-content");
      if (!editable) event.preventDefault();
    });

    const startup = await native.startupDocuments().catch(() => [] as string[]);
    for (const path of startup) await openPath(path);
  })();
  return started;
}
