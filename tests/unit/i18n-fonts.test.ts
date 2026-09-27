import { beforeEach, describe, expect, it } from "vitest";

import { COMMANDS } from "../../src/app/commands";
import {
  BUNDLED_FONTS,
  fontStack,
  isValidFontId,
  systemFontId,
} from "../../src/features/fonts/fonts";
import { sanitizeSettings } from "../../src/features/settings/settings";
import { commandLabel, languageDir, t } from "../../src/i18n";
import { ar, arCommands } from "../../src/i18n/ar";
import { en } from "../../src/i18n/en";
import { useSettings } from "../../src/stores/settingsStore";
import { setupApp } from "../helpers/app";

describe("translations", () => {
  beforeEach(() => {
    setupApp();
  });

  it("Arabic covers every English string and keeps placeholders", () => {
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(ar[key], key).toBeTruthy();
      const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
      expect(placeholders(ar[key]), key).toEqual(placeholders(en[key]));
    }
  });

  it("Arabic covers every menu command", () => {
    for (const command of COMMANDS) {
      expect(arCommands[command.id], command.id).toBeTruthy();
    }
  });

  it("switches language at runtime", () => {
    expect(t("unsaved.save")).toBe("Save");
    expect(commandLabel({ id: "file.new", label: "New" })).toBe("New");
    useSettings.getState().update({ language: "ar" });
    expect(t("unsaved.save")).toBe("حفظ");
    expect(commandLabel({ id: "file.new", label: "New" })).toBe("جديد");
    expect(t("find.count", { current: 1, count: 3 })).toBe("1 من 3");
  });

  it("knows each language's direction", () => {
    expect(languageDir("en")).toBe("ltr");
    expect(languageDir("ar")).toBe("rtl");
  });
});

describe("fonts", () => {
  it("accepts built-in, bundled and safe system font ids", () => {
    expect(isValidFontId("sans")).toBe(true);
    for (const font of BUNDLED_FONTS) expect(isValidFontId(font.id)).toBe(true);
    expect(isValidFontId(systemFontId("Segoe UI"))).toBe(true);
    expect(isValidFontId(systemFontId("Traditional Arabic"))).toBe(true);
  });

  it("rejects ids that could inject CSS", () => {
    expect(isValidFontId('system:Evil"; } body { display:none')).toBe(false);
    expect(isValidFontId("system:")).toBe(false);
    expect(isValidFontId("comic")).toBe(false);
    expect(isValidFontId(42)).toBe(false);
  });

  it("builds font stacks with fallbacks", () => {
    expect(fontStack("serif")).toBe("var(--font-serif)");
    expect(fontStack("cairo")).toBe('"Cairo", var(--font-sans)');
    expect(fontStack("amiri")).toBe('"Amiri", var(--font-serif)');
    expect(fontStack(systemFontId("Segoe UI"))).toBe('"Segoe UI", var(--font-sans)');
    expect(fontStack("nonsense")).toBe("var(--font-sans)");
  });

  it("settings keep valid fonts and language, and drop invalid ones", () => {
    const ok = sanitizeSettings({ language: "ar", fontFamily: "cairo", headingFont: "same" });
    expect(ok).toMatchObject({ language: "ar", fontFamily: "cairo", headingFont: "same" });
    const bad = sanitizeSettings({ language: "xx", fontFamily: "system:a;b", headingFont: 5 });
    expect(bad).toMatchObject({ language: "en", fontFamily: "sans", headingFont: "same" });
  });
});
