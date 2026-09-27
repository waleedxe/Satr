import { Extension } from "@tiptap/core";
import type { Editor } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import type { Transaction } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

import type { SearchStatus, SearchTarget } from "../files/editorRegistry";

export interface Match {
  from: number;
  to: number;
}

interface SearchState {
  query: string;
  caseSensitive: boolean;
  matches: Match[];
  current: number;
  decorations: DecorationSet;
}

type SearchMeta = { query: string; caseSensitive: boolean } | { current: number };

export const searchKey = new PluginKey<SearchState>("search");

const MAX_MATCHES = 10_000;
// One character per inline leaf node keeps text offsets aligned with positions.
const LEAF_CHAR = "￼";

/** Finds all matches of `query` inside textblocks (never across blocks). */
export function findMatches(doc: PMNode, query: string, caseSensitive: boolean): Match[] {
  const matches: Match[] = [];
  if (!query) return matches;
  const needle = caseSensitive ? query : query.toLocaleLowerCase();
  doc.descendants((node, pos) => {
    if (matches.length >= MAX_MATCHES) return false;
    if (!node.isTextblock) return true;
    let text = node.textBetween(0, node.content.size, undefined, LEAF_CHAR);
    if (!caseSensitive) text = text.toLocaleLowerCase();
    let index = text.indexOf(needle);
    while (index >= 0 && matches.length < MAX_MATCHES) {
      matches.push({ from: pos + 1 + index, to: pos + 1 + index + needle.length });
      index = text.indexOf(needle, index + Math.max(needle.length, 1));
    }
    return false;
  });
  return matches;
}

function decorate(doc: PMNode, matches: Match[], current: number): DecorationSet {
  if (!matches.length) return DecorationSet.empty;
  return DecorationSet.create(
    doc,
    matches.map((m, i) =>
      Decoration.inline(m.from, m.to, {
        class: i === current ? "search-match search-match-current" : "search-match",
      }),
    ),
  );
}

function build(doc: PMNode, query: string, caseSensitive: boolean, current: number): SearchState {
  const matches = findMatches(doc, query, caseSensitive);
  const clamped = matches.length ? Math.min(Math.max(current, 0), matches.length - 1) : -1;
  return {
    query,
    caseSensitive,
    matches,
    current: clamped,
    decorations: decorate(doc, matches, clamped),
  };
}

const EMPTY: SearchState = {
  query: "",
  caseSensitive: false,
  matches: [],
  current: -1,
  decorations: DecorationSet.empty,
};

export const Search = Extension.create({
  name: "search",

  addProseMirrorPlugins() {
    return [
      new Plugin<SearchState>({
        key: searchKey,
        state: {
          init: () => EMPTY,
          apply(tr: Transaction, prev: SearchState): SearchState {
            const meta = tr.getMeta(searchKey) as SearchMeta | undefined;
            if (meta && "query" in meta) {
              return build(tr.doc, meta.query, meta.caseSensitive, 0);
            }
            if (meta && "current" in meta) {
              return {
                ...prev,
                current: meta.current,
                decorations: decorate(tr.doc, prev.matches, meta.current),
              };
            }
            if (tr.docChanged && prev.query) {
              return build(tr.doc, prev.query, prev.caseSensitive, prev.current);
            }
            return prev;
          },
        },
        props: {
          decorations: (state) => searchKey.getState(state)?.decorations,
        },
      }),
    ];
  },
});

function status(editor: Editor): SearchStatus {
  const state = searchKey.getState(editor.state) ?? EMPTY;
  return { count: state.matches.length, current: state.current };
}

function select(editor: Editor, index: number): SearchStatus {
  const state = searchKey.getState(editor.state) ?? EMPTY;
  if (!state.matches.length) return status(editor);
  const current = ((index % state.matches.length) + state.matches.length) % state.matches.length;
  const match = state.matches[current]!;
  const tr = editor.state.tr
    .setMeta(searchKey, { current })
    .setSelection(TextSelection.create(editor.state.doc, match.from, match.to))
    .scrollIntoView();
  editor.view.dispatch(tr);
  return status(editor);
}

/** Adapts the search plugin to the editor-independent SearchTarget API. */
export function createSearchTarget(getEditor: () => Editor | null): SearchTarget {
  const none: SearchStatus = { count: 0, current: -1 };
  return {
    setQuery(query, caseSensitive) {
      const editor = getEditor();
      if (!editor) return none;
      editor.view.dispatch(editor.state.tr.setMeta(searchKey, { query, caseSensitive }));
      // Start from the match nearest to the cursor.
      const state = searchKey.getState(editor.state) ?? EMPTY;
      const head = editor.state.selection.from;
      const nearest = state.matches.findIndex((m) => m.from >= head);
      return state.matches.length ? select(editor, nearest < 0 ? 0 : nearest) : status(editor);
    },
    next() {
      const editor = getEditor();
      if (!editor) return none;
      return select(editor, (searchKey.getState(editor.state)?.current ?? -1) + 1);
    },
    previous() {
      const editor = getEditor();
      if (!editor) return none;
      return select(editor, (searchKey.getState(editor.state)?.current ?? 0) - 1);
    },
    replace(replacement) {
      const editor = getEditor();
      if (!editor) return none;
      const state = searchKey.getState(editor.state) ?? EMPTY;
      const match = state.matches[state.current];
      if (!match) return status(editor);
      const tr = editor.state.tr;
      if (replacement) tr.insertText(replacement, match.from, match.to);
      else tr.delete(match.from, match.to);
      editor.view.dispatch(tr);
      return select(editor, state.current);
    },
    replaceAll(replacement) {
      const editor = getEditor();
      if (!editor) return 0;
      const state = searchKey.getState(editor.state) ?? EMPTY;
      if (!state.matches.length) return 0;
      const tr = editor.state.tr;
      for (let i = state.matches.length - 1; i >= 0; i--) {
        const m = state.matches[i]!;
        if (replacement) tr.insertText(replacement, m.from, m.to);
        else tr.delete(m.from, m.to);
      }
      editor.view.dispatch(tr);
      return state.matches.length;
    },
    clear() {
      const editor = getEditor();
      if (!editor || editor.isDestroyed) return;
      editor.view.dispatch(editor.state.tr.setMeta(searchKey, { query: "", caseSensitive: false }));
    },
  };
}
