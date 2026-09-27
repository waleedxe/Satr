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
import { t, useT } from "../i18n";
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
        <h2>{t("doc.crashTitle")}</h2>
        <p>{error.message}</p>
        <p>{t("doc.crashNote")}</p>
        {tab.mode === "wysiwyg" && (
          <button
            type="button"
            className="button"
            onClick={() => {
              this.setState({ error: null });
              switchMode(tab.id, "source");
            }}
          >
            {t("doc.openInSource")}
          </button>
        )}
      </div>
    );
  }
}

function ExternalBanner({ tab }: { tab: DocumentTab }) {
  const t = useT();
  if (tab.external === "modified") {
    return (
      <div className="banner" role="alert">
        <span>{t("doc.changedOnDisk")}</span>
        <button type="button" className="button" onClick={() => void reloadDocument(tab.id)}>
          {t("doc.reload")}
        </button>
        <button
          type="button"
          className="button button-quiet"
          onClick={() => void keepMyVersion(tab.id)}
        >
          {t("doc.keepMine")}
        </button>
      </div>
    );
  }
  if (tab.external === "deleted") {
    return (
      <div className="banner banner-warning" role="alert">
        <span>{t("doc.deleted")}</span>
        <button type="button" className="button" onClick={() => void saveDocument(tab.id)}>
          {t("doc.recreate")}
        </button>
        <button
          type="button"
          className="button button-quiet"
          onClick={() => void closeDocument(tab.id)}
        >
          {t("doc.close")}
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
          <Suspense fallback={<div className="editor-loading">{t("doc.loadingSource")}</div>}>
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
