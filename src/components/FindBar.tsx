import { useEffect, useRef, useState } from "react";

import { editorRegistry } from "../features/files/editorRegistry";
import type { SearchStatus } from "../features/files/editorRegistry";
import { useT } from "../i18n";
import { useDocuments } from "../stores/documentsStore";
import { useUi } from "../stores/uiStore";

export function FindBar() {
  const open = useUi((s) => s.findOpen);
  const replaceOpen = useUi((s) => s.replaceOpen);
  const setFind = useUi((s) => s.setFind);
  const activeId = useDocuments((s) => s.activeId);
  const mode = useDocuments((s) => s.tabs.find((t) => t.id === s.activeId)?.mode);
  const [query, setQuery] = useState("");
  const [replacement, setReplacement] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [status, setStatus] = useState<SearchStatus>({ count: 0, current: -1 });
  const inputRef = useRef<HTMLInputElement>(null);
  const t = useT();

  const target = () => (activeId ? editorRegistry.get(activeId)?.search : undefined);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [open, replaceOpen]);

  // Re-run the search when the query, options, tab or mode change.
  useEffect(() => {
    if (!open) return;
    const handle = setTimeout(() => {
      setStatus(target()?.setQuery(query, caseSensitive) ?? { count: 0, current: -1 });
    }, 80);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, query, caseSensitive, activeId, mode]);

  useEffect(() => {
    if (!open && activeId) editorRegistry.get(activeId)?.search.clear();
  }, [open, activeId]);

  if (!open || !activeId) return null;

  const close = () => {
    setFind(false);
    editorRegistry.get(activeId)?.focus();
  };

  const label =
    query === ""
      ? ""
      : status.count === 0
        ? t("find.noResults")
        : t("find.count", { current: status.current + 1, count: status.count });

  return (
    <div className="findbar" role="search" aria-label={t("find.label")}>
      <div className="findbar-row">
        <input
          ref={inputRef}
          className="findbar-input"
          type="text"
          value={query}
          placeholder={t("find.find")}
          aria-label={t("find.find")}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              const t = target();
              if (t) setStatus(e.shiftKey ? t.previous() : t.next());
            } else if (e.key === "Escape") {
              e.preventDefault();
              close();
            }
          }}
        />
        <span className="findbar-count" aria-live="polite">
          {label}
        </span>
        <button
          type="button"
          className={`icon-button${caseSensitive ? " is-on" : ""}`}
          aria-pressed={caseSensitive}
          title={t("find.matchCase")}
          onClick={() => setCaseSensitive((v) => !v)}
        >
          Aa
        </button>
        <button
          type="button"
          className="icon-button"
          title={t("find.previous")}
          aria-label={t("find.previous")}
          onClick={() => target() && setStatus(target()!.previous())}
        >
          ↑
        </button>
        <button
          type="button"
          className="icon-button"
          title={t("find.next")}
          aria-label={t("find.next")}
          onClick={() => target() && setStatus(target()!.next())}
        >
          ↓
        </button>
        <button
          type="button"
          className="icon-button"
          title={t("find.toggleReplace")}
          aria-label={t("find.toggleReplace")}
          onClick={() => setFind(true, !replaceOpen)}
        >
          ⇄
        </button>
        <button
          type="button"
          className="icon-button"
          title={t("find.close")}
          aria-label={t("find.close")}
          onClick={close}
        >
          ×
        </button>
      </div>
      {replaceOpen && (
        <div className="findbar-row">
          <input
            className="findbar-input"
            type="text"
            value={replacement}
            placeholder={t("find.replace")}
            aria-label={t("find.replaceWith")}
            onChange={(e) => setReplacement(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                const t = target();
                if (t) setStatus(t.replace(replacement));
              } else if (e.key === "Escape") {
                e.preventDefault();
                close();
              }
            }}
          />
          <button
            type="button"
            className="button"
            disabled={status.count === 0}
            onClick={() => target() && setStatus(target()!.replace(replacement))}
          >
            {t("find.replaceOne")}
          </button>
          <button
            type="button"
            className="button"
            disabled={status.count === 0}
            onClick={() => {
              const t = target();
              if (!t) return;
              t.replaceAll(replacement);
              setStatus(t.setQuery(query, caseSensitive));
            }}
          >
            {t("find.replaceAll")}
          </button>
        </div>
      )}
    </div>
  );
}
