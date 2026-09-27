import { formatShortcut } from "../app/shortcuts";
import { closeDocument, newDocument } from "../features/files/fileActions";
import { useT } from "../i18n";
import { useDocuments } from "../stores/documentsStore";

export function TabBar() {
  const tabs = useDocuments((s) => s.tabs);
  const activeId = useDocuments((s) => s.activeId);
  const setActive = useDocuments((s) => s.setActive);
  const t = useT();

  if (tabs.length === 0) return null;

  return (
    <div className="tabbar" role="tablist" aria-label={t("tabs.label")}>
      {tabs.map((tab) => {
        const active = tab.id === activeId;
        return (
          <div
            key={tab.id}
            role="tab"
            tabIndex={active ? 0 : -1}
            aria-selected={active}
            className={`tab${active ? " is-active" : ""}${tab.dirty ? " is-dirty" : ""}`}
            title={tab.path ?? tab.title}
            onMouseDown={(event) => {
              if (event.button === 1) {
                event.preventDefault();
                void closeDocument(tab.id);
              } else if (event.button === 0) {
                setActive(tab.id);
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") setActive(tab.id);
            }}
          >
            <span className="tab-title" dir="ltr">
              {tab.title}
            </span>
            {tab.mode === "source" && (
              <span className="tab-badge" title={t("tabs.sourceBadge")}>
                MD
              </span>
            )}
            <button
              type="button"
              className="tab-close"
              aria-label={t(tab.dirty ? "tabs.closeUnsaved" : "tabs.close", { title: tab.title })}
              onMouseDown={(event) => event.stopPropagation()}
              onClick={() => void closeDocument(tab.id)}
            >
              <span className="tab-dot" aria-hidden="true" />
              <span className="tab-x" aria-hidden="true">
                ×
              </span>
            </button>
          </div>
        );
      })}
      <button
        type="button"
        className="tab-new"
        aria-label={t("tabs.new")}
        title={t("tabs.newTitle", { key: formatShortcut("Mod+N") })}
        onClick={() => newDocument()}
      >
        +
      </button>
    </div>
  );
}
