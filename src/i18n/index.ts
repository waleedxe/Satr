import { ar, arCommands } from "./ar";
import { en } from "./en";
import type { MessageKey } from "./en";
import { useSettings } from "../stores/settingsStore";

export type { MessageKey } from "./en";

export const LANGUAGES = [
  { id: "en", label: "English", dir: "ltr" },
  { id: "ar", label: "العربية", dir: "rtl" },
] as const;

export type Language = (typeof LANGUAGES)[number]["id"];

const dictionaries: Record<Language, Record<MessageKey, string>> = { en, ar };
const commandDictionaries: Partial<Record<Language, Record<string, string>>> = { ar: arCommands };

export function isLanguage(value: unknown): value is Language {
  return LANGUAGES.some((l) => l.id === value);
}

export function currentLanguage(): Language {
  return useSettings.getState().language;
}

export function languageDir(language: Language): "ltr" | "rtl" {
  return LANGUAGES.find((l) => l.id === language)?.dir ?? "ltr";
}

/** Translates a UI string for the current language, filling {placeholders}. */
export function t(key: MessageKey, vars?: Record<string, string | number>): string {
  const text = dictionaries[currentLanguage()][key] ?? en[key];
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

/** Label of a menu command in the current language. */
export function commandLabel(command: { id: string; label: string }): string {
  return commandDictionaries[currentLanguage()]?.[command.id] ?? command.label;
}

/** Subscribes a component to language changes and returns `t`. */
export function useT(): typeof t {
  useSettings((s) => s.language);
  return t;
}
