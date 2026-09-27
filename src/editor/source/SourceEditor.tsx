import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { search } from "@codemirror/search";
import type { Text } from "@codemirror/state";
import { Compartment, EditorState } from "@codemirror/state";
import { EditorView, drawSelection, keymap, placeholder } from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { useEffect, useRef } from "react";

import { editorRegistry } from "../../features/files/editorRegistry";
import type { EditorHandle } from "../../features/files/editorRegistry";
import { headingsFromMarkdown } from "../../features/outline/outline";
import { computeStats } from "../../features/outline/stats";
import { t } from "../../i18n";
import { getTab, useDocuments } from "../../stores/documentsStore";
import type { DocumentTab } from "../../stores/documentsStore";
import { useEditorStatus } from "../../stores/editorStatusStore";
import { useSettings } from "../../stores/settingsStore";
import { createSourceSearch } from "./sourceSearch";

interface Props {
  tab: DocumentTab;
  active: boolean;
}

const highlight = HighlightStyle.define([
  { tag: tags.heading, fontWeight: "700", color: "var(--md-heading)" },
  { tag: tags.strong, fontWeight: "700" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.strikethrough, textDecoration: "line-through" },
  { tag: [tags.link, tags.url], color: "var(--accent)" },
  { tag: tags.monospace, color: "var(--md-code)" },
  {
    tag: [tags.processingInstruction, tags.contentSeparator, tags.meta],
    color: "var(--text-muted)",
  },
  { tag: tags.quote, color: "var(--text-muted)" },
]);

const theme = EditorView.theme({
  "&": { height: "100%", backgroundColor: "transparent", color: "var(--text)" },
  "&.cm-focused": { outline: "none" },
  ".cm-content": {
    fontFamily: "var(--font-mono)",
    fontSize: "var(--editor-font-size)",
    lineHeight: "1.65",
    padding: "32px 0 40vh",
    maxWidth: "var(--content-width)",
    margin: "0 auto",
    caretColor: "var(--accent)",
  },
  ".cm-line": { padding: "0 var(--editor-padding)" },
  ".cm-cursor": { borderLeftColor: "var(--accent)", borderLeftWidth: "2px" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": {
    backgroundColor: "var(--selection) !important",
  },
  ".cm-scroller": { overflow: "auto", fontFamily: "var(--font-mono)" },
  ".cm-searchMatch": { backgroundColor: "var(--search-match)" },
  ".cm-searchMatch-selected": { backgroundColor: "var(--search-current)" },
  ".cm-placeholder": { color: "var(--text-faint)" },
});

function publish(tabId: string, doc: Text) {
  const text = doc.toString();
  useEditorStatus.getState().publish(tabId, {
    headings: headingsFromMarkdown(text),
    stats: computeStats(text),
  });
}

export default function SourceEditor({ tab, active }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const spellcheck = useSettings((s) => s.spellcheck);
  const spellcheckCompartment = useRef(new Compartment());
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const tabId = tab.id;
    const content = tab.content;
    const clean = editorRegistry.getSaved(tabId) === content && !getTab(tabId)?.dirty;
    let baseline: Text | null = null;
    let pending: { text: string; doc: Text } | null = null;
    let statusTimer: ReturnType<typeof setTimeout> | undefined;

    const view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: content,
        extensions: [
          history(),
          drawSelection(),
          keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap]),
          markdown({ base: markdownLanguage }),
          syntaxHighlighting(highlight),
          search({ top: true }),
          EditorView.lineWrapping,
          EditorView.perLineTextDirection.of(true),
          placeholder(t("doc.sourcePlaceholder")),
          spellcheckCompartment.current.of(
            EditorView.contentAttributes.of({
              spellcheck: String(useSettings.getState().spellcheck),
            }),
          ),
          EditorView.contentAttributes.of({ "aria-label": t("doc.sourceLabel") }),
          theme,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              const dirty = baseline ? !update.state.doc.eq(baseline) : true;
              useDocuments.getState().updateTab(tabId, { dirty });
              clearTimeout(statusTimer);
              statusTimer = setTimeout(() => {
                if (activeRef.current) publish(tabId, update.state.doc);
              }, 300);
            }
            if (
              update.selectionSet &&
              useSettings.getState().typewriterMode &&
              update.view.hasFocus
            ) {
              const head = update.state.selection.main.head;
              requestAnimationFrame(() =>
                update.view.dispatch({ effects: EditorView.scrollIntoView(head, { y: "center" }) }),
              );
            }
          }),
        ],
      }),
    });
    viewRef.current = view;
    baseline = clean ? view.state.doc : null;
    if (!clean) useDocuments.getState().updateTab(tabId, { dirty: true });

    const handle: EditorHandle = {
      editor: null,
      sourceView: view,
      getMarkdown() {
        const doc = view.state.doc;
        if (pending?.doc === doc) return pending.text;
        pending = { text: doc.toString(), doc };
        return pending.text;
      },
      markSaved(markdown) {
        if (pending && pending.text === markdown) baseline = pending.doc;
      },
      focus() {
        view.focus();
      },
      scrollToHeading(index) {
        const heading = headingsFromMarkdown(view.state.doc.toString())[index];
        if (!heading) return;
        const line = view.state.doc.line(heading.line);
        view.dispatch({
          selection: { anchor: line.from },
          effects: EditorView.scrollIntoView(line.from, { y: "start", yMargin: 24 }),
        });
        view.focus();
      },
      search: createSourceSearch(() => viewRef.current),
      setDocumentDir() {},
    };
    const unregister = editorRegistry.register(tabId, handle);
    if (activeRef.current) {
      publish(tabId, view.state.doc);
      view.focus();
    }

    return () => {
      clearTimeout(statusTimer);
      unregister();
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab.id, tab.revision]);

  useEffect(() => {
    const view = viewRef.current;
    if (active && view) {
      publish(tab.id, view.state.doc);
      useEditorStatus.getState().publish(tab.id, { activeHeading: -1 });
    }
  }, [active, tab.id]);

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: spellcheckCompartment.current.reconfigure(
        EditorView.contentAttributes.of({ spellcheck: String(spellcheck) }),
      ),
    });
  }, [spellcheck]);

  return <div ref={hostRef} className="source-editor" />;
}
