import { Component, Suspense, lazy, useEffect } from "react";
import type { ErrorInfo, ReactNode } from "react";

import { WysiwygEditor } from "../editor/WysiwygEditor";
import {
  closeDocument,
  keepMyVersion,
  reloadDocument,
  saveDocument,
  switchMode,
} from "../features/files/fileActions";
import { useDocuments } from "../stores/documentsStore";
import type { DocumentTab } from "../stores/documentsStore";
import { useSettings } from "../stores/settingsStore";

const SourceEditor = lazy(() => import("../editor/source/SourceEditor"));

const AUTOSAVE_DELAY_MS = 1500;

class EditorErrorBoundary extends Component<
  { tab: DocumentTab; children: ReactNode },
  { error: Error | null }
> {
  override state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Editor crashed", error, info.componentStack);
  }

  override render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const { tab } = this.props;
    return (
      <div className="editor-error" role="alert">
        <h2>Something went wrong displaying this document</h2>
        <p>{error.message}</p>
        <p>Your file on disk has not been changed.</p>
        {tab.mode === "wysiwyg" && (
          <button
            type="button"
            className="button"
            onClick={() => {
              this.setState({ error: null });
              switchMode(tab.id, "source");
            }}
          >
            Open in source mode
          </button>
        )}
      </div>
    );
  }
}

function ExternalBanner({ tab }: { tab: DocumentTab }) {
  if (tab.external === "modified") {
    return (
      <div className="banner" role="alert">
        <span>This file was changed by another program.</span>
        <button type="button" className="button" onClick={() => void reloadDocument(tab.id)}>
          Reload from disk
        </button>
        <button
          type="button"
          className="button button-quiet"
          onClick={() => void keepMyVersion(tab.id)}
        >
          Keep my version
        </button>
      </div>
    );
  }
  if (tab.external === "deleted") {
    return (
      <div className="banner banner-warning" role="alert">
        <span>This file was deleted or moved. Your text is still here.</span>
        <button type="button" className="button" onClick={() => void saveDocument(tab.id)}>
          Save to recreate it
        </button>
        <button
          type="button"
          className="button button-quiet"
          onClick={() => void closeDocument(tab.id)}
        >
          Close
        </button>
      </div>
    );
  }
  return null;
}

function useAutosave(tab: DocumentTab) {
  const autosave = useSettings((s) => s.autosave);
  useEffect(() => {
    if (!autosave || !tab.dirty || !tab.path || tab.external) return;
    const timer = setTimeout(() => void saveDocument(tab.id), AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  });
}

function DocumentPane({ tab, active }: { tab: DocumentTab; active: boolean }) {
  useAutosave(tab);
  return (
    <section className={`document-pane mode-${tab.mode}`} hidden={!active} aria-label={tab.title}>
      <ExternalBanner tab={tab} />
      <EditorErrorBoundary key={`${tab.mode}-${tab.revision}`} tab={tab}>
        {tab.mode === "wysiwyg" ? (
          <div className="editor-scroll">
            <WysiwygEditor key={tab.revision} tab={tab} active={active} />
          </div>
        ) : (
          <Suspense fallback={<div className="editor-loading">Loading source editor…</div>}>
            <SourceEditor key={tab.revision} tab={tab} active={active} />
          </Suspense>
        )}
      </EditorErrorBoundary>
    </section>
  );
}

export function DocumentArea() {
  const tabs = useDocuments((s) => s.tabs);
  const activeId = useDocuments((s) => s.activeId);
  return (
    <>
      {tabs.map((tab) => (
        <DocumentPane key={tab.id} tab={tab} active={tab.id === activeId} />
      ))}
    </>
  );
}
