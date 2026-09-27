import { formatShortcut } from "../app/shortcuts";
import {
  newDocument,
  openDocumentsDialog,
  openFolderDialog,
  openPath,
} from "../features/files/fileActions";
import { useT } from "../i18n";
import { useSettings } from "../stores/settingsStore";
import { basename, dirname } from "../utils/path";

export function EmptyState() {
  const recentFiles = useSettings((s) => s.recentFiles);
  const t = useT();
  return (
    <div className="empty-state">
      <div className="empty-card">
        <h1 className="empty-title">
          Satr{" "}
          <span className="empty-title-ar" lang="ar">
            سطر
          </span>
        </h1>
        <p className="empty-subtitle">{t("empty.subtitle")}</p>
        <div className="empty-actions">
          <button type="button" className="button button-primary" onClick={() => newDocument()}>
            {t("empty.new")} <kbd>{formatShortcut("Mod+N")}</kbd>
          </button>
          <button type="button" className="button" onClick={() => void openDocumentsDialog()}>
            {t("empty.open")} <kbd>{formatShortcut("Mod+O")}</kbd>
          </button>
          <button type="button" className="button" onClick={() => void openFolderDialog()}>
            {t("empty.openFolder")}
          </button>
        </div>
        {recentFiles.length > 0 && (
          <section className="recent" aria-labelledby="recent-heading">
            <h2 id="recent-heading" className="recent-heading">
              {t("empty.recent")}
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
                    <span className="recent-name" dir="ltr">
                      {basename(path)}
                    </span>
                    <span className="recent-dir" dir="ltr">
                      {dirname(path)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
        <p className="empty-hint">{t("empty.tip", { key: formatShortcut("F1") })}</p>
      </div>
    </div>
  );
}
