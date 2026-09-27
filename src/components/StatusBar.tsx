import { switchMode } from "../features/files/fileActions";
import { useDocuments } from "../stores/documentsStore";
import { useEditorStatus } from "../stores/editorStatusStore";
import { useSettings } from "../stores/settingsStore";

export function StatusBar() {
  const tab = useDocuments((s) => s.tabs.find((t) => t.id === s.activeId));
  const stats = useEditorStatus((s) => s.stats);
  const statsTab = useEditorStatus((s) => s.tabId);
  const autosave = useSettings((s) => s.autosave);

  if (!tab) return <footer className="statusbar" />;
  const showStats = statsTab === tab.id;
  return (
    <footer className="statusbar" aria-label="Document status">
      <div className="status-left">
        {showStats && (
          <>
            <span>{stats.words.toLocaleString()} words</span>
            <span>{stats.characters.toLocaleString()} characters</span>
            <span>{stats.readingMinutes} min read</span>
          </>
        )}
      </div>
      <div className="status-right">
        {tab.dirty && <span className="status-unsaved">Unsaved</span>}
        {autosave && tab.path && <span title="Autosave is on">Autosave</span>}
        <span>{tab.eol === "\r\n" ? "CRLF" : "LF"}</span>
        <span>{tab.hasBom ? "UTF-8 BOM" : "UTF-8"}</span>
        <button
          type="button"
          className="status-button"
          title="Toggle source mode (Ctrl+/)"
          onClick={() => switchMode(tab.id)}
        >
          {tab.mode === "source" ? "Markdown source" : "Visual"}
        </button>
      </div>
    </footer>
  );
}
