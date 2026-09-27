import { useCallback, useEffect, useState } from "react";

import { editorRegistry } from "../features/files/editorRegistry";
import { openFolderDialog, openPath } from "../features/files/fileActions";
import { bridge } from "../native";
import type { DirEntry } from "../native";
import { useDocuments } from "../stores/documentsStore";
import { useEditorStatus } from "../stores/editorStatusStore";
import { useSettings } from "../stores/settingsStore";
import { basename, samePath } from "../utils/path";

function Outline() {
  const headings = useEditorStatus((s) => s.headings);
  const activeHeading = useEditorStatus((s) => s.activeHeading);
  const tabId = useEditorStatus((s) => s.tabId);
  const activeId = useDocuments((s) => s.activeId);

  if (!activeId || tabId !== activeId) {
    return <p className="sidebar-empty">Open a document to see its outline.</p>;
  }
  if (headings.length === 0) {
    return <p className="sidebar-empty">No headings yet. Start a line with # to add one.</p>;
  }
  const minLevel = Math.min(...headings.map((h) => h.level));
  return (
    <nav aria-label="Document outline">
      <ul className="outline">
        {headings.map((heading, index) => (
          <li key={index}>
            <button
              type="button"
              className={`outline-item${index === activeHeading ? " is-active" : ""}`}
              style={{ paddingInlineStart: `${(heading.level - minLevel) * 14 + 12}px` }}
              onClick={() => editorRegistry.get(activeId)?.scrollToHeading(index)}
              dir="auto"
            >
              {heading.text || <em className="outline-untitled">Untitled heading</em>}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

interface TreeProps {
  path: string;
  depth: number;
}

function DirectoryTree({ path, depth }: TreeProps) {
  const [entries, setEntries] = useState<DirEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const tabs = useDocuments((s) => s.tabs);
  const activeId = useDocuments((s) => s.activeId);
  const activePath = tabs.find((t) => t.id === activeId)?.path ?? null;

  const load = useCallback(() => {
    bridge()
      .listDirectory(path)
      .then((list) => {
        setEntries(list);
        setError(null);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Could not read folder"));
  }, [path]);

  useEffect(load, [load]);

  if (error) return <p className="sidebar-empty">{error}</p>;
  if (!entries) return <p className="sidebar-empty">Loading…</p>;
  if (entries.length === 0 && depth === 0) {
    return <p className="sidebar-empty">No Markdown files in this folder.</p>;
  }
  return (
    <ul className="file-tree" role={depth === 0 ? "tree" : "group"}>
      {entries.map((entry) => {
        const open = expanded.has(entry.path);
        const isActive = activePath !== null && samePath(activePath, entry.path);
        return (
          <li key={entry.path} role="treeitem" aria-expanded={entry.isDir ? open : undefined}>
            <button
              type="button"
              className={`file-item${entry.isDir ? " is-dir" : ""}${isActive ? " is-active" : ""}`}
              style={{ paddingInlineStart: `${depth * 14 + 10}px` }}
              title={entry.path}
              onClick={() => {
                if (entry.isDir) {
                  setExpanded((prev) => {
                    const next = new Set(prev);
                    if (next.has(entry.path)) next.delete(entry.path);
                    else next.add(entry.path);
                    return next;
                  });
                } else {
                  void openPath(entry.path);
                }
              }}
            >
              <span className="file-icon" aria-hidden="true">
                {entry.isDir ? (open ? "▾" : "▸") : "•"}
              </span>
              <span className="file-name">{entry.name}</span>
            </button>
            {entry.isDir && open && <DirectoryTree path={entry.path} depth={depth + 1} />}
          </li>
        );
      })}
    </ul>
  );
}

function Files() {
  const folder = useSettings((s) => s.workspaceFolder);
  const update = useSettings((s) => s.update);
  const [refreshKey, setRefreshKey] = useState(0);

  if (!folder) {
    return (
      <div className="sidebar-empty">
        <p>No folder open.</p>
        <button type="button" className="button" onClick={() => void openFolderDialog()}>
          Open Folder…
        </button>
      </div>
    );
  }
  return (
    <div className="files-panel">
      <div className="files-header">
        <span className="files-root" title={folder}>
          {basename(folder)}
        </span>
        <button
          type="button"
          className="icon-button"
          title="Refresh"
          aria-label="Refresh folder"
          onClick={() => setRefreshKey((k) => k + 1)}
        >
          ⟳
        </button>
        <button
          type="button"
          className="icon-button"
          title="Close folder"
          aria-label="Close folder"
          onClick={() => update({ workspaceFolder: null })}
        >
          ×
        </button>
      </div>
      <DirectoryTree key={`${folder}-${refreshKey}`} path={folder} depth={0} />
    </div>
  );
}

export function Sidebar() {
  const panel = useSettings((s) => s.sidebarPanel);
  const update = useSettings((s) => s.update);

  return (
    <aside className="sidebar" aria-label="Sidebar">
      <div className="sidebar-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={panel === "outline"}
          className={`sidebar-tab${panel === "outline" ? " is-active" : ""}`}
          onClick={() => update({ sidebarPanel: "outline" })}
        >
          Outline
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={panel === "files"}
          className={`sidebar-tab${panel === "files" ? " is-active" : ""}`}
          onClick={() => update({ sidebarPanel: "files" })}
        >
          Files
        </button>
      </div>
      <div className="sidebar-body" role="tabpanel">
        {panel === "outline" ? <Outline /> : <Files />}
      </div>
    </aside>
  );
}
