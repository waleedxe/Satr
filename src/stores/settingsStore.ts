import { create } from "zustand";

import {
  DEFAULT_SETTINGS,
  addRecentFile,
  clampFontSize,
  removeRecentFile,
  sanitizeSettings,
} from "../features/settings/settings";
import type { Settings } from "../features/settings/settings";
import { bridge } from "../native";

const STORE_KEY = "settings";

interface SettingsState extends Settings {
  loaded: boolean;
  load(): Promise<void>;
  update(patch: Partial<Settings>): void;
  addRecent(path: string): void;
  removeRecent(path: string): void;
  clearRecent(): void;
  zoom(delta: number): void;
}

function pickSettings(state: SettingsState): Settings {
  const out = {} as Record<string, unknown>;
  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    out[key] = state[key as keyof Settings];
  }
  return out as unknown as Settings;
}

let persistTimer: ReturnType<typeof setTimeout> | undefined;

export const useSettings = create<SettingsState>((set, get) => {
  const persist = () => {
    clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      void bridge()
        .saveStore(STORE_KEY, pickSettings(get()))
        .catch((error: unknown) => console.error("Could not save settings", error));
    }, 150);
  };

  return {
    ...DEFAULT_SETTINGS,
    loaded: false,

    async load() {
      try {
        const raw = await bridge().loadStore(STORE_KEY);
        set({ ...sanitizeSettings(raw), loaded: true });
      } catch (error) {
        console.error("Could not load settings", error);
        set({ loaded: true });
      }
    },

    update(patch) {
      set(patch);
      persist();
    },

    addRecent(path) {
      set({ recentFiles: addRecentFile(get().recentFiles, path) });
      persist();
    },

    removeRecent(path) {
      set({ recentFiles: removeRecentFile(get().recentFiles, path) });
      persist();
    },

    clearRecent() {
      set({ recentFiles: [] });
      persist();
    },

    zoom(delta) {
      const fontSize =
        delta === 0 ? DEFAULT_SETTINGS.fontSize : clampFontSize(get().fontSize + delta);
      set({ fontSize });
      persist();
    },
  };
});

/** Resolves once pending settings writes have been flushed (used by tests). */
export async function flushSettings(): Promise<void> {
  clearTimeout(persistTimer);
  await bridge().saveStore(STORE_KEY, pickSettings(useSettings.getState()));
}
