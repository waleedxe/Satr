import { Editor } from "@tiptap/core";
import { Placeholder } from "@tiptap/extensions";
import type { Node as PMNode } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";
import { useEffect, useRef, useState } from "react";

import { CodeHighlight } from "./extensions/highlight";
import { createSchemaExtensions } from "./extensions";
import { WritingModes } from "./extensions/writingModes";
import { attachNodes, fragmentToMarkdown, markdownToSlice, serializeMarkdown } from "./markdown";
import type { MarkdownStyle, SourceMap } from "./markdown";
import { parseMarkdownAsync } from "./markdown/parseAsync";
import { editorRegistry } from "../features/files/editorRegistry";
import type { EditorHandle } from "../features/files/editorRegistry";
import { openLink } from "../features/files/fileActions";
import { headingPositions, headingsFromDoc } from "../features/outline/outline";
import { computeStats } from "../features/outline/stats";
import { Search, createSearchTarget } from "../features/search/searchExtension";
import { bridge } from "../native";
import { getTab, useDocuments } from "../stores/documentsStore";
import type { DocumentTab } from "../stores/documentsStore";
import { useEditorStatus } from "../stores/editorStatusStore";
import { useSettings } from "../stores/settingsStore";
import { dirname } from "../utils/path";

interface Props {
  tab: DocumentTab;
  active: boolean;
}

interface Session {
  sourceMap: SourceMap;
  style: MarkdownStyle;
  /** Document as last loaded/saved; null when the tab was already modified. */
  baseline: PMNode | null;
  pending: { doc: PMNode; markdown: string; sourceMap: SourceMap } | null;
}

function publishStatus(tabId: string, editor: Editor) {
  const doc = editor.state.doc;
  useEditorStatus.getState().publish(tabId, {
    headings: headingsFromDoc(doc),
    stats: computeStats(doc.textBetween(0, doc.content.size, "\n", " ")),
  });
}

function currentHeadingIndex(editor: Editor): number {
  const positions = headingPositions(editor.state.doc);
  const head = editor.state.selection.from;
  let index = -1;
  for (let i = 0; i < positions.length; i++) {
    if (positions[i]! <= head) index = i;
    else break;
  }
  return index;
}

export function WysiwygEditor({ tab, active }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [error, setError] = useState<string | null>(null);
  const spellcheck = useSettings((s) => s.spellcheck);
  const activeRef = useRef(active);
  activeRef.current = active;

  // Build the editor once per (tab, revision); content changes remount it.
  useEffect(() => {
    let cancelled = false;
    let instance: Editor | null = null;
    let unregister: (() => void) | undefined;
    let statusTimer: ReturnType<typeof setTimeout> | undefined;
    const tabId = tab.id;
    const content = tab.content;

    parseMarkdownAsync(content)
      .then((parsed) => {
        if (cancelled || !mountRef.current) return;
        const session: Session = {
          sourceMap: parsed.sourceMap,
          style: parsed.style,
          baseline: null,
          pending: null,
        };

        const scheduleStatus = () => {
          clearTimeout(statusTimer);
          statusTimer = setTimeout(() => {
            if (instance && !instance.isDestroyed && activeRef.current)
              publishStatus(tabId, instance);
          }, 250);
        };

        instance = new Editor({
          element: mountRef.current,
          extensions: [
            ...createSchemaExtensions(),
            CodeHighlight,
            Search,
            WritingModes.configure({ isTypewriter: () => useSettings.getState().typewriterMode }),
            Placeholder.configure({ placeholder: "Start writing…" }),
          ],
          content: parsed.doc,
          enableInputRules: true,
          enablePasteRules: true,
          editorProps: {
            attributes: {
              class: "markdown-body",
              spellcheck: String(useSettings.getState().spellcheck),
              "aria-label": "Document editor",
              role: "textbox",
              "aria-multiline": "true",
            },
            handleClick(view, pos, event) {
              if (!(event.ctrlKey || event.metaKey)) return false;
              const $pos = view.state.doc.resolve(pos);
              const link = $pos.marks().find((m) => m.type.name === "link");
              if (!link) return false;
              void openLink(String(link.attrs.href ?? ""), getTab(tabId)?.path ?? null);
              return true;
            },
            clipboardTextSerializer: (slice) => fragmentToMarkdown(instance!.schema, slice.content),
            clipboardTextParser: (text) => markdownToSlice(instance!.schema, text),
          },
          onUpdate: ({ editor: ed }) => {
            const dirty = session.baseline ? !ed.state.doc.eq(session.baseline) : true;
            useDocuments.getState().updateTab(tabId, { dirty });
            scheduleStatus();
          },
          onSelectionUpdate: ({ editor: ed }) => {
            if (activeRef.current) {
              useEditorStatus.getState().publish(tabId, { activeHeading: currentHeadingIndex(ed) });
            }
          },
        });

        attachNodes(session.sourceMap, instance.state.doc, parsed.blockTypes);
        const tabNow = getTab(tabId);
        const clean = editorRegistry.getSaved(tabId) === content && !tabNow?.dirty;
        session.baseline = clean ? instance.state.doc : null;
        if (!clean) useDocuments.getState().updateTab(tabId, { dirty: true });

        const context = instance.storage.documentContext;
        context.dir = tabNow?.path ? dirname(tabNow.path) : null;
        context.toAssetUrl = (path) => bridge().toAssetUrl(path);

        const ed = instance;
        const handle: EditorHandle = {
          editor: ed,
          sourceView: null,
          getMarkdown() {
            const doc = ed.state.doc;
            if (session.pending?.doc === doc) return session.pending.markdown;
            const result = serializeMarkdown(doc, session.sourceMap, session.style);
            session.pending = { doc, markdown: result.markdown, sourceMap: result.sourceMap };
            return result.markdown;
          },
          markSaved(markdown) {
            const pending = session.pending;
            if (pending && pending.markdown === markdown) {
              session.sourceMap = pending.sourceMap;
              session.baseline = pending.doc;
            }
          },
          focus() {
            if (!ed.isDestroyed) ed.commands.focus();
          },
          scrollToHeading(index) {
            const pos = headingPositions(ed.state.doc)[index];
            if (pos === undefined) return;
            const selection = TextSelection.near(ed.state.doc.resolve(pos + 1));
            ed.view.dispatch(ed.state.tr.setSelection(selection));
            const dom = ed.view.nodeDOM(pos);
            if (dom instanceof HTMLElement)
              dom.scrollIntoView({ block: "start", behavior: "smooth" });
            ed.commands.focus();
          },
          search: createSearchTarget(() => (ed.isDestroyed ? null : ed)),
          setDocumentDir(dir) {
            context.dir = dir;
          },
        };
        unregister = editorRegistry.register(tabId, handle);
        setEditor(instance);
        if (activeRef.current) {
          publishStatus(tabId, instance);
          instance.commands.focus("start");
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });

    return () => {
      cancelled = true;
      clearTimeout(statusTimer);
      unregister?.();
      instance?.destroy();
    };
    // Remount only when the tab or its content revision changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab.id, tab.revision]);

  // Refresh sidebar/status when this tab becomes active.
  useEffect(() => {
    if (active && editor && !editor.isDestroyed) {
      publishStatus(tab.id, editor);
      useEditorStatus.getState().publish(tab.id, { activeHeading: currentHeadingIndex(editor) });
    }
  }, [active, editor, tab.id]);

  useEffect(() => {
    if (editor && !editor.isDestroyed) {
      editor.view.dom.setAttribute("spellcheck", String(spellcheck));
    }
  }, [editor, spellcheck]);

  if (error) {
    return (
      <div className="editor-error" role="alert">
        <h2>This document could not be displayed</h2>
        <p>{error}</p>
        <p>You can still edit it in source mode.</p>
      </div>
    );
  }

  return (
    <>
      {!editor && <div className="editor-loading">Loading document…</div>}
      <div ref={mountRef} className="wysiwyg-mount" />
    </>
  );
}
