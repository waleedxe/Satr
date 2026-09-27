import { create } from "zustand";

import type { Heading } from "../features/outline/outline";
import type { TextStats } from "../features/outline/stats";

/** Derived information about the active editor, shown in the sidebar and status bar. */
interface EditorStatusState {
  tabId: string | null;
  headings: Heading[];
  stats: TextStats;
  activeHeading: number;
  publish(tabId: string, patch: Partial<Omit<EditorStatusState, "publish" | "tabId">>): void;
}

export const useEditorStatus = create<EditorStatusState>((set) => ({
  tabId: null,
  headings: [],
  stats: { words: 0, characters: 0, readingMinutes: 0 },
  activeHeading: -1,
  publish(tabId, patch) {
    set({ tabId, ...patch });
  },
}));
