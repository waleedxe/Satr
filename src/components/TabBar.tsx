import { closeDocument, newDocument } from "../features/files/fileActions";
import { useDocuments } from "../stores/documentsStore";

export function TabBar() {
  const tabs = useDocuments((s) => s.tabs);
  const activeId = useDocuments((s) => s.activeId);
  const setActive = useDocuments((s) => s.setActive);

  if (tabs.length === 0) return null;

  return (
    <div className="tabbar" role="tablist" aria-label="Open documents">
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
            <span className="tab-title">{tab.title}</span>
            {tab.mode === "source" && (
              <span className="tab-badge" title="Source mode">
                MD
              </span>
            )}
            <button
              type="button"
              className="tab-close"
              aria-label={`Close ${tab.title}${tab.dirty ? " (unsaved)" : ""}`}
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
        aria-label="New document"
        title="New (Ctrl+N)"
        onClick={() => newDocument()}
      >
        +
      </button>
    </div>
  );
}
