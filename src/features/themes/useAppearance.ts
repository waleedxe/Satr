import { useEffect, useState } from "react";

import type { ContentWidth, FontFamily, ThemePreference } from "../settings/settings";
import { bridge } from "../../native";
import { useDocuments } from "../../stores/documentsStore";
import { useSettings } from "../../stores/settingsStore";

const WIDTHS: Record<ContentWidth, string> = {
  narrow: "640px",
  medium: "780px",
  wide: "980px",
  full: "100%",
};

const FONTS: Record<FontFamily, string> = {
  sans: "var(--font-sans)",
  serif: "var(--font-serif)",
  mono: "var(--font-mono)",
};

export function resolveTheme(preference: ThemePreference, systemDark: boolean): "light" | "dark" {
  if (preference === "system") return systemDark ? "dark" : "light";
  return preference;
}

function useSystemDark(): boolean {
  const query = "(prefers-color-scheme: dark)";
  const [dark, setDark] = useState(() => window.matchMedia?.(query).matches ?? false);
  useEffect(() => {
    const media = window.matchMedia?.(query);
    if (!media) return;
    const onChange = (e: MediaQueryListEvent) => setDark(e.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);
  return dark;
}

/** Applies theme, typography and writing-mode settings to the document root. */
export function useAppearance(): void {
  const theme = useSettings((s) => s.theme);
  const fontSize = useSettings((s) => s.fontSize);
  const contentWidth = useSettings((s) => s.contentWidth);
  const fontFamily = useSettings((s) => s.fontFamily);
  const focusMode = useSettings((s) => s.focusMode);
  const systemDark = useSystemDark();

  useEffect(() => {
    const root = document.documentElement;
    const resolved = resolveTheme(theme, systemDark);
    root.dataset.theme = resolved;
    root.style.colorScheme = resolved;
  }, [theme, systemDark]);

  useEffect(() => {
    const root = document.documentElement.style;
    root.setProperty("--editor-font-size", `${fontSize}px`);
    root.setProperty("--content-width", WIDTHS[contentWidth]);
    root.setProperty("--editor-font", FONTS[fontFamily]);
  }, [fontSize, contentWidth, fontFamily]);

  useEffect(() => {
    document.documentElement.classList.toggle("focus-mode", focusMode);
  }, [focusMode]);
}

/** Keeps the window title in sync with the active document. */
export function useWindowTitle(): void {
  const title = useDocuments((s) => s.tabs.find((t) => t.id === s.activeId)?.title);
  const dirty = useDocuments((s) => s.tabs.find((t) => t.id === s.activeId)?.dirty ?? false);
  useEffect(() => {
    const text = title ? `${dirty ? "● " : ""}${title} — Satr` : "Satr";
    document.title = text;
    void bridge()
      .setWindowTitle(text)
      .catch(() => undefined);
  }, [title, dirty]);
}
