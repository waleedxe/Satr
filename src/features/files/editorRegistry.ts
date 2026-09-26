import type { Editor } from "@tiptap/core";

/** Find/replace operations shared by the WYSIWYG and source editors. */
export interface SearchTarget {
  /** Sets the query; returns the number of matches and the current index. */
  setQuery(query: string, caseSensitive: boolean): SearchStatus;
  next(): SearchStatus;
  previous(): SearchStatus;
  replace(replacement: string): SearchStatus;
  replaceAll(replacement: string): number;
  clear(): void;
}

export interface SearchStatus {
  count: number;
  /** Zero-based index of the current match, -1 if none. */
  current: number;
}

/** What the rest of the app may ask of a mounted editor. */
export interface EditorHandle {
  /** Current document as Markdown with LF line endings. */
  getMarkdown(): string;
  /** Records `markdown` (returned by getMarkdown) as the saved state. */
  markSaved(markdown: string): void;
  focus(): void;
  scrollToHeading(index: number): void;
  search: SearchTarget;
  /** The TipTap editor, in WYSIWYG mode only. */
  editor: Editor | null;
  setDocumentDir(dir: string | null): void;
}

const handles = new Map<string, EditorHandle>();
/** Markdown last loaded from / saved to disk for each tab (LF endings). */
const savedMarkdown = new Map<string, string>();

export const editorRegistry = {
  register(tabId: string, handle: EditorHandle): () => void {
    handles.set(tabId, handle);
    return () => {
      if (handles.get(tabId) === handle) handles.delete(tabId);
    };
  },
  get(tabId: string): EditorHandle | undefined {
    return handles.get(tabId);
  },
  getSaved(tabId: string): string | undefined {
    return savedMarkdown.get(tabId);
  },
  setSaved(tabId: string, markdown: string): void {
    savedMarkdown.set(tabId, markdown);
  },
  forget(tabId: string): void {
    handles.delete(tabId);
    savedMarkdown.delete(tabId);
  },
};
