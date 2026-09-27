import { samePath } from "../../utils/path";
import { isValidFontId } from "../fonts/fonts";

export type ThemePreference = "system" | "light" | "dark";
export type ContentWidth = "narrow" | "medium" | "wide" | "full";
export type UiLanguage = "en" | "ar";
export type SidebarPanel = "outline" | "files";

export interface Settings {
  language: UiLanguage;
  theme: ThemePreference;
  fontSize: number;
  contentWidth: ContentWidth;
  /** Font id: "sans" | "serif" | "mono", a bundled font id, or "system:<family>". */
  fontFamily: string;
  /** Font id for headings, or "same" to use the text font. */
  headingFont: string;
  autosave: boolean;
  focusMode: boolean;
  typewriterMode: boolean;
  spellcheck: boolean;
  sidebarVisible: boolean;
  sidebarPanel: SidebarPanel;
  workspaceFolder: string | null;
  recentFiles: string[];
}

export const MIN_FONT_SIZE = 12;
export const MAX_FONT_SIZE = 28;
export const MAX_RECENT_FILES = 12;

export const DEFAULT_SETTINGS: Settings = {
  language: "en",
  theme: "system",
  fontSize: 16,
  contentWidth: "medium",
  fontFamily: "sans",
  headingFont: "same",
  autosave: false,
  focusMode: false,
  typewriterMode: false,
  spellcheck: true,
  sidebarVisible: true,
  sidebarPanel: "outline",
  workspaceFolder: null,
  recentFiles: [],
};

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export function clampFontSize(size: number): number {
  if (!Number.isFinite(size)) return DEFAULT_SETTINGS.fontSize;
  return Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, Math.round(size)));
}

/** Validates settings read from disk; anything invalid falls back to defaults. */
export function sanitizeSettings(raw: unknown): Settings {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const d = DEFAULT_SETTINGS;
  return {
    language: oneOf(r.language, ["en", "ar"], d.language),
    theme: oneOf(r.theme, ["system", "light", "dark"], d.theme),
    fontSize: typeof r.fontSize === "number" ? clampFontSize(r.fontSize) : d.fontSize,
    contentWidth: oneOf(r.contentWidth, ["narrow", "medium", "wide", "full"], d.contentWidth),
    fontFamily: isValidFontId(r.fontFamily) ? r.fontFamily : d.fontFamily,
    headingFont:
      r.headingFont === "same" || isValidFontId(r.headingFont)
        ? (r.headingFont as string)
        : d.headingFont,
    autosave: bool(r.autosave, d.autosave),
    focusMode: bool(r.focusMode, d.focusMode),
    typewriterMode: bool(r.typewriterMode, d.typewriterMode),
    spellcheck: bool(r.spellcheck, d.spellcheck),
    sidebarVisible: bool(r.sidebarVisible, d.sidebarVisible),
    sidebarPanel: oneOf(r.sidebarPanel, ["outline", "files"], d.sidebarPanel),
    workspaceFolder: typeof r.workspaceFolder === "string" ? r.workspaceFolder : null,
    recentFiles: Array.isArray(r.recentFiles)
      ? r.recentFiles.filter((p): p is string => typeof p === "string").slice(0, MAX_RECENT_FILES)
      : [],
  };
}

/** Moves `path` to the front of the recent list (deduplicated, capped). */
export function addRecentFile(list: string[], path: string): string[] {
  return [path, ...list.filter((p) => !samePath(p, path))].slice(0, MAX_RECENT_FILES);
}

export function removeRecentFile(list: string[], path: string): string[] {
  return list.filter((p) => !samePath(p, path));
}
