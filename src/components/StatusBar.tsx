import { formatShortcut } from "../app/shortcuts";
import { switchMode } from "../features/files/fileActions";
import { useT } from "../i18n";
import { useDocuments } from "../stores/documentsStore";
import { useEditorStatus } from "../stores/editorStatusStore";
import { useSettings } from "../stores/settingsStore";

export function StatusBar() {
  const tab = useDocuments((s) => s.tabs.find((tab) => tab.id === s.activeId));
  const stats = useEditorStatus((s) => s.stats);
  const statsTab = useEditorStatus((s) => s.tabId);
  const autosave = useSettings((s) => s.autosave);
  const t = useT();

  if (!tab) return <footer className="statusbar" />;
  const showStats = statsTab === tab.id;
  return (
    <footer className="statusbar" aria-label={t("status.label")}>
      <div className="status-left">
        {showStats && (
          <>
            <span>{t("status.words", { n: stats.words.toLocaleString() })}</span>
            <span>{t("status.characters", { n: stats.characters.toLocaleString() })}</span>
            <span>{t("status.readingTime", { n: stats.readingMinutes })}</span>
          </>
        )}
      </div>
      <div className="status-right">
        {tab.dirty && <span className="status-unsaved">{t("status.unsaved")}</span>}
        {autosave && tab.path && <span title={t("status.autosaveOn")}>{t("status.autosave")}</span>}
        <span>{tab.eol === "\r\n" ? "CRLF" : "LF"}</span>
        <span>{tab.hasBom ? "UTF-8 BOM" : "UTF-8"}</span>
        <button
          type="button"
          className="status-button"
          title={t("status.toggleMode", { key: formatShortcut("Mod+/") })}
          onClick={() => switchMode(tab.id)}
        >
          {tab.mode === "source" ? t("status.source") : t("status.visual")}
        </button>
      </div>
    </footer>
  );
}
