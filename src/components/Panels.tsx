import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

import { COMMANDS } from "../app/commands";
import { formatShortcut } from "../app/shortcuts";
import { MAX_FONT_SIZE, MIN_FONT_SIZE } from "../features/settings/settings";
import type { ContentWidth, FontFamily, ThemePreference } from "../features/settings/settings";
import { useSettings } from "../stores/settingsStore";
import { useUi } from "../stores/uiStore";

function PanelFrame({ title, children }: { title: string; children: ReactNode }) {
  const setPanel = useUi((s) => s.setPanel);
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
            aria-label="Close"
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

function SettingsPanel() {
  const s = useSettings();
  return (
    <PanelFrame title="Settings">
      <div className="settings-grid">
        <label className="setting">
          <span>Theme</span>
          <select
            value={s.theme}
            onChange={(e) => s.update({ theme: e.target.value as ThemePreference })}
          >
            <option value="system">Match system</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
        <label className="setting">
          <span>Font</span>
          <select
            value={s.fontFamily}
            onChange={(e) => s.update({ fontFamily: e.target.value as FontFamily })}
          >
            <option value="sans">Sans-serif</option>
            <option value="serif">Serif</option>
            <option value="mono">Monospace</option>
          </select>
        </label>
        <label className="setting">
          <span>
            Font size <output>{s.fontSize}px</output>
          </span>
          <input
            type="range"
            min={MIN_FONT_SIZE}
            max={MAX_FONT_SIZE}
            value={s.fontSize}
            onChange={(e) => s.update({ fontSize: Number(e.target.value) })}
          />
        </label>
        <label className="setting">
          <span>Content width</span>
          <select
            value={s.contentWidth}
            onChange={(e) => s.update({ contentWidth: e.target.value as ContentWidth })}
          >
            <option value="narrow">Narrow</option>
            <option value="medium">Medium</option>
            <option value="wide">Wide</option>
            <option value="full">Full width</option>
          </select>
        </label>
        <label className="setting setting-check">
          <input
            type="checkbox"
            checked={s.autosave}
            onChange={(e) => s.update({ autosave: e.target.checked })}
          />
          <span>Autosave saved documents after a short pause</span>
        </label>
        <label className="setting setting-check">
          <input
            type="checkbox"
            checked={s.focusMode}
            onChange={(e) => s.update({ focusMode: e.target.checked })}
          />
          <span>Focus mode (dim everything but the current paragraph)</span>
        </label>
        <label className="setting setting-check">
          <input
            type="checkbox"
            checked={s.typewriterMode}
            onChange={(e) => s.update({ typewriterMode: e.target.checked })}
          />
          <span>Typewriter mode (keep the cursor centered)</span>
        </label>
        <label className="setting setting-check">
          <input
            type="checkbox"
            checked={s.spellcheck}
            onChange={(e) => s.update({ spellcheck: e.target.checked })}
          />
          <span>Check spelling</span>
        </label>
      </div>
    </PanelFrame>
  );
}

function ShortcutsPanel() {
  const extra: [string, string][] = [
    ["Open link", "Ctrl+Click"],
    ["Next / previous match", "Enter / Shift+Enter"],
    ["Leave a code block", "Enter three times or ↓ at the end"],
  ];
  return (
    <PanelFrame title="Keyboard Shortcuts">
      <table className="shortcuts">
        <tbody>
          {COMMANDS.filter((c) => c.shortcut).map((c) => (
            <tr key={c.id}>
              <td>{c.label.replace("…", "")}</td>
              <td>
                <kbd>{formatShortcut(c.shortcut!)}</kbd>
              </td>
            </tr>
          ))}
          {extra.map(([label, keys]) => (
            <tr key={label}>
              <td>{label}</td>
              <td>
                <kbd>{keys}</kbd>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3 className="shortcuts-subtitle">Markdown typing shortcuts</h3>
      <p className="panel-text">
        Type <code># </code> to <code>###### </code> for headings, <code>- </code> or{" "}
        <code>1. </code> for lists, <code>[ ] </code> for tasks, <code>&gt; </code> for quotes,{" "}
        <code>```</code> for code, <code>---</code> for a rule, <code>$$ </code> for a math block,{" "}
        <code>$x$</code> for inline math, and <code>**bold**</code>, <code>*italic*</code>,{" "}
        <code>~~strike~~</code>, <code>`code`</code> inline.
      </p>
    </PanelFrame>
  );
}

function AboutPanel() {
  return (
    <PanelFrame title="About Satr">
      <p className="panel-text">
        <strong>Satr</strong> {__APP_VERSION__}
      </p>
      <p className="panel-text">A fast, local-first Markdown editor.</p>
      <p className="panel-text">
        Privacy: your documents never leave your computer. There is no account, no cloud sync and no
        telemetry. The app only reads and writes the files you open.
      </p>
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
