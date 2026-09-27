import { vi } from "vitest";

import { editorRegistry } from "../../src/features/files/editorRegistry";
import type { EditorHandle } from "../../src/features/files/editorRegistry";
import { DEFAULT_SETTINGS } from "../../src/features/settings/settings";
import { setBridge } from "../../src/native";
import { MemoryBridge } from "../../src/native/memoryBridge";
import { useDocuments } from "../../src/stores/documentsStore";
import { useSettings } from "../../src/stores/settingsStore";
import { useUi } from "../../src/stores/uiStore";

export function setupApp(): MemoryBridge {
  const bridge = new MemoryBridge();
  setBridge(bridge);
  useDocuments.getState().reset();
  useSettings.setState({ ...DEFAULT_SETTINGS, loaded: true });
  useUi.setState({ dialog: null, toasts: [], findOpen: false, panel: null });
  return bridge;
}

/** Waits for pending promise callbacks (dialogs, async actions). */
export async function flush(): Promise<void> {
  for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
}

/** Answers the currently shown dialog. */
export async function answerDialog(button: string): Promise<void> {
  await flush();
  const dialog = useUi.getState().dialog;
  if (!dialog) throw new Error("Expected a dialog to be open");
  useUi.getState().resolveDialog({ button, values: {} });
}

/** A stand-in for a mounted editor that holds plain Markdown. */
export function mountFakeEditor(tabId: string) {
  const tab = useDocuments.getState().tabs.find((t) => t.id === tabId)!;
  let markdown = tab.content;
  let saved = markdown;
  const handle: EditorHandle = {
    getMarkdown: () => markdown,
    markSaved: (m) => {
      saved = m;
    },
    focus: () => undefined,
    scrollToHeading: () => undefined,
    search: {
      setQuery: () => ({ count: 0, current: -1 }),
      next: () => ({ count: 0, current: -1 }),
      previous: () => ({ count: 0, current: -1 }),
      replace: () => ({ count: 0, current: -1 }),
      replaceAll: () => 0,
      clear: () => undefined,
    },
    editor: null,
    sourceView: null,
    setDocumentDir: vi.fn(),
  };
  editorRegistry.register(tabId, handle);
  return {
    handle,
    type(next: string) {
      markdown = next;
      useDocuments.getState().updateTab(tabId, { dirty: markdown !== saved });
    },
  };
}
