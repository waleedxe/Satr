import {
  SearchCursor,
  SearchQuery,
  findNext,
  findPrevious,
  replaceAll,
  replaceNext,
  setSearchQuery,
} from "@codemirror/search";
import type { EditorView } from "@codemirror/view";

import type { SearchStatus, SearchTarget } from "../../features/files/editorRegistry";

const MAX_MATCHES = 10_000;

/** SearchTarget for the CodeMirror source editor (literal, optional case sensitivity). */
export function createSourceSearch(getView: () => EditorView | null): SearchTarget {
  let query = "";
  let caseSensitive = false;
  const none: SearchStatus = { count: 0, current: -1 };

  const status = (view: EditorView): SearchStatus => {
    if (!query) return none;
    const normalize = caseSensitive ? undefined : (s: string) => s.toLowerCase();
    const cursor = new SearchCursor(
      view.state.doc,
      caseSensitive ? query : query.toLowerCase(),
      0,
      view.state.doc.length,
      normalize,
    );
    const sel = view.state.selection.main;
    let count = 0;
    let current = -1;
    while (!cursor.next().done && count < MAX_MATCHES) {
      if (cursor.value.from === sel.from && cursor.value.to === sel.to) current = count;
      count++;
    }
    return { count, current };
  };

  const apply = (view: EditorView, replace = "") => {
    view.dispatch({
      effects: setSearchQuery.of(
        new SearchQuery({ search: query, caseSensitive, literal: true, replace }),
      ),
    });
  };

  return {
    setQuery(q, cs) {
      const view = getView();
      if (!view) return none;
      query = q;
      caseSensitive = cs;
      apply(view);
      if (!q) return none;
      // Search forward from the start of the current selection.
      const from = view.state.selection.main.from;
      view.dispatch({ selection: { anchor: from } });
      findNext(view);
      return status(view);
    },
    next() {
      const view = getView();
      if (!view || !query) return none;
      findNext(view);
      return status(view);
    },
    previous() {
      const view = getView();
      if (!view || !query) return none;
      findPrevious(view);
      return status(view);
    },
    replace(replacement) {
      const view = getView();
      if (!view || !query) return none;
      apply(view, replacement);
      replaceNext(view);
      return status(view);
    },
    replaceAll(replacement) {
      const view = getView();
      if (!view || !query) return 0;
      const before = status(view).count;
      apply(view, replacement);
      replaceAll(view);
      return before;
    },
    clear() {
      const view = getView();
      query = "";
      if (view) apply(view);
    },
  };
}
