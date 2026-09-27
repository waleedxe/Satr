import { useEffect, useState } from "react";

import { ensureFontLoaded, fontStack } from "../fonts/fonts";
import type { ContentWidth, ThemePreference } from "../settings/settings";
import { languageDir } from "../../i18n";
import { bridge } from "../../native";
import { useDocuments } from "../../stores/documentsStore";
import { useSettings } from "../../stores/settingsStore";

const WIDTHS: Record<ContentWidth, string> = {
  narrow: "640px",
  medium: "780px",
  wide: "980px",
  full: "100%",
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
  const headingFont = useSettings((s) => s.headingFont);
  const language = useSettings((s) => s.language);
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
  }, [fontSize, contentWidth]);

  useEffect(() => {
    const heading = headingFont === "same" ? fontFamily : headingFont;
    const root = document.documentElement.style;
    root.setProperty("--editor-font", fontStack(fontFamily));
    root.setProperty("--heading-font", fontStack(heading));
    void Promise.all([ensureFontLoaded(fontFamily), ensureFontLoaded(heading)]).catch(
      () => undefined,
    );
  }, [fontFamily, headingFont]);

  useEffect(() => {
    const root = document.documentElement;
    root.lang = language;
    root.dir = languageDir(language);
  }, [language]);

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
