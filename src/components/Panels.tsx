import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import { COMMANDS } from "../app/commands";
import { formatShortcut } from "../app/shortcuts";
import { BUNDLED_FONTS, ensureFontLoaded, fontStack, systemFontId } from "../features/fonts/fonts";
import { MAX_FONT_SIZE, MIN_FONT_SIZE } from "../features/settings/settings";
import type { ContentWidth, ThemePreference, UiLanguage } from "../features/settings/settings";
import { LANGUAGES, commandLabel, useT } from "../i18n";
import { bridge } from "../native";
import { useSettings } from "../stores/settingsStore";
import { useUi } from "../stores/uiStore";

function PanelFrame({ title, children }: { title: string; children: ReactNode }) {
  const setPanel = useUi((s) => s.setPanel);
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>("button, select, input")?.focus();
  }, []);
  return (
    <div className="modal-backdrop" onMouseDown={() => setPanel(null)}>
      <div
        ref={ref}
        className="modal modal-wide"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            setPanel(null);
          }
        }}
      >
        <div className="panel-header">
          <h2 className="modal-title">{title}</h2>
          <button
            type="button"
            className="icon-button"
            aria-label={t("dialog.close")}
            onClick={() => setPanel(null)}
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Installed font families, fetched once per app session. */
let systemFontsPromise: Promise<string[]> | null = null;
function useSystemFonts(): string[] | null {
  const [fonts, setFonts] = useState<string[] | null>(null);
  useEffect(() => {
    let alive = true;
    systemFontsPromise ??= bridge()
      .systemFonts()
      .catch(() => []);
    void systemFontsPromise.then((list) => alive && setFonts(list));
    return () => {
      alive = false;
    };
  }, []);
  return fonts;
}

interface FontSelectProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  systemFonts: string[] | null;
  allowSame?: boolean;
}

function FontSelect({ id, value, onChange, systemFonts, allowSame }: FontSelectProps) {
  const t = useT();
  const selectedSystem = value.startsWith("system:") ? value.slice(7) : null;
  const installed = systemFonts ?? (selectedSystem ? [selectedSystem] : []);
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
      {allowSame && <option value="same">{t("settings.sameFont")}</option>}
      <option value="sans">{t("font.sans")}</option>
      <option value="serif">{t("font.serif")}</option>
      <option value="mono">{t("font.mono")}</option>
      <optgroup label={t("settings.fontsBuiltIn")}>
        {BUNDLED_FONTS.map((font) => (
          <option key={font.id} value={font.id}>
            {font.label}
          </option>
        ))}
      </optgroup>
      <optgroup label={systemFonts ? t("settings.fontsSystem") : t("settings.fontsLoading")}>
        {installed.map((family) => (
          <option key={family} value={systemFontId(family)}>
            {family}
          </option>
        ))}
      </optgroup>
    </select>
  );
}

function SettingsPanel() {
  const s = useSettings();
  const t = useT();
  const systemFonts = useSystemFonts();
  const headingId = s.headingFont === "same" ? s.fontFamily : s.headingFont;

  useEffect(() => {
    void ensureFontLoaded(s.fontFamily);
    void ensureFontLoaded(headingId);
  }, [s.fontFamily, headingId]);

  return (
    <PanelFrame title={t("settings.title")}>
      <div className="settings-grid">
        <label className="setting" htmlFor="setting-language">
          <span>{t("settings.language")}</span>
          <select
            id="setting-language"
            value={s.language}
            onChange={(e) => s.update({ language: e.target.value as UiLanguage })}
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.id} value={lang.id}>
                {lang.label}
              </option>
            ))}
          </select>
        </label>
        <label className="setting" htmlFor="setting-theme">
          <span>{t("settings.theme")}</span>
          <select
            id="setting-theme"
            value={s.theme}
            onChange={(e) => s.update({ theme: e.target.value as ThemePreference })}
          >
            <option value="system">{t("settings.themeSystem")}</option>
            <option value="light">{t("settings.themeLight")}</option>
            <option value="dark">{t("settings.themeDark")}</option>
          </select>
        </label>
        <label className="setting" htmlFor="setting-font">
          <span>{t("settings.font")}</span>
          <FontSelect
            id="setting-font"
            value={s.fontFamily}
            systemFonts={systemFonts}
            onChange={(fontFamily) => s.update({ fontFamily })}
          />
        </label>
        <label className="setting" htmlFor="setting-heading-font">
          <span>{t("settings.headingFont")}</span>
          <FontSelect
            id="setting-heading-font"
            value={s.headingFont}
            systemFonts={systemFonts}
            allowSame
            onChange={(headingFont) => s.update({ headingFont })}
          />
        </label>
        <div className="font-preview" aria-label={t("settings.preview")}>
          <p
            className="font-preview-heading"
            dir="auto"
            style={{ fontFamily: fontStack(headingId) }}
          >
            {t("settings.preview")}
          </p>
          <p dir="auto" style={{ margin: 0, fontFamily: fontStack(s.fontFamily) }}>
            {t("settings.previewText")}
          </p>
        </div>
        <label className="setting" htmlFor="setting-font-size">
          <span>
            {t("settings.fontSize")} <output>{s.fontSize}px</output>
          </span>
          <input
            id="setting-font-size"
            type="range"
            min={MIN_FONT_SIZE}
            max={MAX_FONT_SIZE}
            value={s.fontSize}
            onChange={(e) => s.update({ fontSize: Number(e.target.value) })}
          />
        </label>
        <label className="setting" htmlFor="setting-width">
          <span>{t("settings.contentWidth")}</span>
          <select
            id="setting-width"
            value={s.contentWidth}
            onChange={(e) => s.update({ contentWidth: e.target.value as ContentWidth })}
          >
            <option value="narrow">{t("settings.widthNarrow")}</option>
            <option value="medium">{t("settings.widthMedium")}</option>
            <option value="wide">{t("settings.widthWide")}</option>
            <option value="full">{t("settings.widthFull")}</option>
          </select>
        </label>
        <label className="setting setting-check" htmlFor="setting-autosave">
          <input
            id="setting-autosave"
            type="checkbox"
            checked={s.autosave}
            onChange={(e) => s.update({ autosave: e.target.checked })}
          />
          <span>{t("settings.autosave")}</span>
        </label>
        <label className="setting setting-check" htmlFor="setting-focus">
          <input
            id="setting-focus"
            type="checkbox"
            checked={s.focusMode}
            onChange={(e) => s.update({ focusMode: e.target.checked })}
          />
          <span>{t("settings.focusMode")}</span>
        </label>
        <label className="setting setting-check" htmlFor="setting-typewriter">
          <input
            id="setting-typewriter"
            type="checkbox"
            checked={s.typewriterMode}
            onChange={(e) => s.update({ typewriterMode: e.target.checked })}
          />
          <span>{t("settings.typewriter")}</span>
        </label>
        <label className="setting setting-check" htmlFor="setting-spellcheck">
          <input
            id="setting-spellcheck"
            type="checkbox"
            checked={s.spellcheck}
            onChange={(e) => s.update({ spellcheck: e.target.checked })}
          />
          <span>{t("settings.spellcheck")}</span>
        </label>
      </div>
    </PanelFrame>
  );
}

function ShortcutsPanel() {
  const t = useT();
  const extra: [string, string][] = [
    [t("shortcuts.openLink"), "Ctrl+Click"],
    [t("shortcuts.nextMatch"), "Enter / Shift+Enter"],
    [t("shortcuts.leaveCode"), t("shortcuts.leaveCodeKeys")],
  ];
  const typing: [string, string][] = [
    [t("shortcuts.headings"), "# … ######"],
    [t("shortcuts.lists"), "-  1."],
    [t("shortcuts.tasks"), "[ ]"],
    [t("shortcuts.quote"), ">"],
    [t("shortcuts.code"), "```"],
    [t("shortcuts.rule"), "---"],
    [t("shortcuts.math"), "$x$  $$"],
    [t("shortcuts.inline"), "**b** *i* ~~s~~ `c`"],
  ];
  return (
    <PanelFrame title={t("shortcuts.title")}>
      <table className="shortcuts">
        <tbody>
          {COMMANDS.filter((c) => c.shortcut).map((c) => (
            <tr key={c.id}>
              <td>{commandLabel(c).replace("…", "")}</td>
              <td>
                <kbd dir="ltr">{formatShortcut(c.shortcut!)}</kbd>
              </td>
            </tr>
          ))}
          {extra.map(([label, keys]) => (
            <tr key={label}>
              <td>{label}</td>
              <td>
                <kbd dir="auto">{keys}</kbd>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3 className="shortcuts-subtitle">{t("shortcuts.typingTitle")}</h3>
      <table className="shortcuts">
        <tbody>
          {typing.map(([label, keys]) => (
            <tr key={label}>
              <td>{label}</td>
              <td>
                <kbd dir="ltr">{keys}</kbd>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </PanelFrame>
  );
}

function AboutPanel() {
  const t = useT();
  return (
    <PanelFrame title={t("about.title")}>
      <p className="panel-text">
        <strong>Satr سطر</strong> <span dir="ltr">{__APP_VERSION__}</span>
      </p>
      <p className="panel-text">{t("about.tagline")}</p>
      <p className="panel-text">{t("about.privacy")}</p>
    </PanelFrame>
  );
}

export function Panels() {
  const panel = useUi((s) => s.panel);
  if (panel === "settings") return <SettingsPanel />;
  if (panel === "shortcuts") return <ShortcutsPanel />;
  if (panel === "about") return <AboutPanel />;
  return null;
}
