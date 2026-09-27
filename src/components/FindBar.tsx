import { useEffect, useRef, useState } from "react";

import { editorRegistry } from "../features/files/editorRegistry";
import type { SearchStatus } from "../features/files/editorRegistry";
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
        ? "No results"
        : `${status.current + 1} of ${status.count}`;

  return (
    <div className="findbar" role="search" aria-label="Find and replace">
      <div className="findbar-row">
        <input
          ref={inputRef}
          className="findbar-input"
          type="text"
          value={query}
          placeholder="Find"
          aria-label="Find"
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
          title="Match case"
          onClick={() => setCaseSensitive((v) => !v)}
        >
          Aa
        </button>
        <button
          type="button"
          className="icon-button"
          title="Previous (Shift+Enter)"
          aria-label="Previous match"
          onClick={() => target() && setStatus(target()!.previous())}
        >
          ↑
        </button>
        <button
          type="button"
          className="icon-button"
          title="Next (Enter)"
          aria-label="Next match"
          onClick={() => target() && setStatus(target()!.next())}
        >
          ↓
        </button>
        <button
          type="button"
          className="icon-button"
          title="Toggle replace"
          aria-label="Toggle replace"
          onClick={() => setFind(true, !replaceOpen)}
        >
          ⇄
        </button>
        <button
          type="button"
          className="icon-button"
          title="Close (Esc)"
          aria-label="Close find"
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
            placeholder="Replace"
            aria-label="Replace with"
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
            Replace
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
            Replace All
          </button>
        </div>
      )}
    </div>
  );
}
