import { create } from "zustand";

import type { LineEnding } from "../editor/markdown";

export type EditorMode = "wysiwyg" | "source";
export type ExternalState = null | "modified" | "deleted";

export interface DocumentTab {
  id: string;
  /** Absolute path, or null for a document that was never saved. */
  path: string | null;
  title: string;
  dirty: boolean;
  mode: EditorMode;
  eol: LineEnding;
  hasBom: boolean;
  /** Modification time of the file as of the last load or save. */
  savedMtime: number | null;
  external: ExternalState;
  /** Markdown the editor is mounted with (LF line endings). */
  content: string;
  /** Bumped whenever `content` is replaced so the editor remounts. */
  revision: number;
}

interface DocumentsState {
  tabs: DocumentTab[];
  activeId: string | null;
  untitledCounter: number;
  addTab(tab: DocumentTab, activate?: boolean): void;
  updateTab(id: string, patch: Partial<DocumentTab>): void;
  removeTab(id: string): void;
  setActive(id: string | null): void;
  nextUntitledTitle(): string;
  reset(): void;
}

let idCounter = 0;
export function createTabId(): string {
  idCounter += 1;
  return `doc-${Date.now().toString(36)}-${idCounter}`;
}

export const useDocuments = create<DocumentsState>((set, get) => ({
  tabs: [],
  activeId: null,
  untitledCounter: 0,

  addTab(tab, activate = true) {
    set((state) => ({
      tabs: [...state.tabs, tab],
      activeId: activate ? tab.id : state.activeId,
    }));
  },

  updateTab(id, patch) {
    set((state) => {
      const index = state.tabs.findIndex((t) => t.id === id);
      if (index < 0) return state;
      const current = state.tabs[index]!;
      const changed = Object.entries(patch).some(
        ([key, value]) => current[key as keyof DocumentTab] !== value,
      );
      if (!changed) return state;
      const tabs = [...state.tabs];
      tabs[index] = { ...current, ...patch };
      return { tabs };
    });
  },

  removeTab(id) {
    set((state) => {
      const index = state.tabs.findIndex((t) => t.id === id);
      if (index < 0) return state;
      const tabs = state.tabs.filter((t) => t.id !== id);
      let activeId = state.activeId;
      if (activeId === id) {
        activeId = (tabs[index] ?? tabs[index - 1])?.id ?? null;
      }
      return { tabs, activeId };
    });
  },

  setActive(id) {
    set({ activeId: id });
  },

  nextUntitledTitle() {
    const n = get().untitledCounter + 1;
    set({ untitledCounter: n });
    return n === 1 ? "Untitled" : `Untitled ${n}`;
  },

  reset() {
    set({ tabs: [], activeId: null, untitledCounter: 0 });
  },
}));

export function getTab(id: string): DocumentTab | undefined {
  return useDocuments.getState().tabs.find((t) => t.id === id);
}

export function getActiveTab(): DocumentTab | undefined {
  const { tabs, activeId } = useDocuments.getState();
  return tabs.find((t) => t.id === activeId);
}
