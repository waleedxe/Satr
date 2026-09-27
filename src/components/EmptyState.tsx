import { formatShortcut } from "../app/shortcuts";
import {
  newDocument,
  openDocumentsDialog,
  openFolderDialog,
  openPath,
} from "../features/files/fileActions";
import { useSettings } from "../stores/settingsStore";
import { basename, dirname } from "../utils/path";

export function EmptyState() {
  const recentFiles = useSettings((s) => s.recentFiles);
  return (
    <div className="empty-state">
      <div className="empty-card">
        <h1 className="empty-title">Markdown Desktop</h1>
        <p className="empty-subtitle">A calm place to write. Your files stay on your computer.</p>
        <div className="empty-actions">
          <button type="button" className="button button-primary" onClick={() => newDocument()}>
            New document <kbd>{formatShortcut("Mod+N")}</kbd>
          </button>
          <button type="button" className="button" onClick={() => void openDocumentsDialog()}>
            Open file… <kbd>{formatShortcut("Mod+O")}</kbd>
          </button>
          <button type="button" className="button" onClick={() => void openFolderDialog()}>
            Open folder…
          </button>
        </div>
        {recentFiles.length > 0 && (
          <section className="recent" aria-labelledby="recent-heading">
            <h2 id="recent-heading" className="recent-heading">
              Recent
            </h2>
            <ul className="recent-list">
              {recentFiles.slice(0, 8).map((path) => (
                <li key={path}>
                  <button
                    type="button"
                    className="recent-item"
                    title={path}
                    onClick={() => void openPath(path)}
                  >
                    <span className="recent-name">{basename(path)}</span>
                    <span className="recent-dir">{dirname(path)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
        <p className="empty-hint">
          Tip: drop a .md file anywhere in this window to open it. Press {formatShortcut("F1")} for
          shortcuts.
        </p>
      </div>
    </div>
  );
}
