import { Extension } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorState, Transaction } from "@tiptap/pm/state";
import { AttrStep } from "@tiptap/pm/transform";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

import {
  getLoadedHighlighter,
  isLanguageLoaded,
  loadHighlighter,
  loadLanguage,
  resolveLanguage,
  tokenize,
} from "../lazy/shiki";

const key = new PluginKey<DecorationSet>("codeHighlight");
const REFRESH = "refresh";

// Very large blocks are left plain to keep typing responsive.
const MAX_HIGHLIGHT_CHARS = 100_000;

interface Span {
  from: number;
  to: number;
  style: string;
}

const tokenCache = new Map<string, Span[]>();

function styleOf(htmlStyle: Record<string, string> | undefined): string {
  if (!htmlStyle) return "";
  return Object.entries(htmlStyle)
    .map(([k, v]) => `${k}:${v}`)
    .join(";");
}

/** Token spans (relative to the block's content start) for one code block. */
function blockSpans(node: PMNode): Span[] | null {
  const lang = resolveLanguage(node.attrs.language as string | null);
  const hl = getLoadedHighlighter();
  const code = node.textContent;
  if (!lang || !hl || !isLanguageLoaded(lang) || !code || code.length > MAX_HIGHLIGHT_CHARS) {
    return null;
  }
  const cacheKey = `${lang}\u0000${code}`;
  const cached = tokenCache.get(cacheKey);
  if (cached) return cached;

  const out: Span[] = [];
  let offset = 0;
  for (const line of tokenize(hl, code, lang)) {
    for (const token of line) {
      const style = styleOf(token.htmlStyle);
      const length = token.content.length;
      if (style && length) {
        out.push({ from: offset, to: offset + length, style });
      }
      offset += length;
    }
    offset += 1; // newline
  }
  if (tokenCache.size > 500) tokenCache.clear();
  tokenCache.set(cacheKey, out);
  return out;
}

function decorateBlock(node: PMNode, pos: number): Decoration[] {
  const spans = blockSpans(node);
  if (!spans) return [];
  const start = pos + 1;
  return spans.map((s) => Decoration.inline(start + s.from, start + s.to, { style: s.style }));
}

function buildAll(doc: PMNode): DecorationSet {
  const decorations: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name === "codeBlock") {
      decorations.push(...decorateBlock(node, pos));
      return false;
    }
    return node.isBlock && !node.isTextblock;
  });
  return DecorationSet.create(doc, decorations);
}

/** Re-highlights only code blocks touched by the transaction. */
function updateChanged(tr: Transaction, set: DecorationSet): DecorationSet {
  let next = set.map(tr.mapping, tr.doc);
  const touched = new Map<number, PMNode>();
  tr.mapping.maps.forEach((map, index) => {
    map.forEach((_oldStart, _oldEnd, newStart, newEnd) => {
      // Map the range to the final document.
      const rest = tr.mapping.slice(index + 1);
      const from = Math.max(0, rest.map(newStart, -1));
      const to = Math.min(tr.doc.content.size, rest.map(newEnd, 1));
      tr.doc.nodesBetween(from, to, (node, pos) => {
        if (node.type.name === "codeBlock") {
          touched.set(pos, node);
          return false;
        }
        return node.isBlock && !node.isTextblock;
      });
    });
  });
  // Attribute-only changes (e.g. language edits) do not show up as ranges above.
  if (tr.steps.some((s) => s instanceof AttrStep)) return buildAll(tr.doc);
  for (const [pos, node] of touched) {
    const end = pos + node.nodeSize;
    next = next.remove(next.find(pos, end));
    next = next.add(tr.doc, decorateBlock(node, pos));
  }
  return next;
}

function missingLanguages(state: EditorState): string[] {
  const langs = new Set<string>();
  state.doc.descendants((node) => {
    if (node.type.name === "codeBlock") {
      const lang = resolveLanguage(node.attrs.language as string | null);
      if (lang && !isLanguageLoaded(lang)) langs.add(lang);
      return false;
    }
    return node.isBlock && !node.isTextblock;
  });
  return [...langs];
}

/** Syntax highlighting for fenced code blocks, powered by Shiki. */
export const CodeHighlight = Extension.create({
  name: "codeHighlight",

  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key,
        state: {
          init: (_config, state) => buildAll(state.doc),
          apply: (tr, set) => {
            if (tr.getMeta(key) === REFRESH) return buildAll(tr.doc);
            if (!tr.docChanged) return set;
            return updateChanged(tr, set);
          },
        },
        props: {
          decorations: (state) => key.getState(state),
        },
        view: (view) => {
          let destroyed = false;
          let pending = false;
          let timer: ReturnType<typeof setTimeout> | undefined;
          const ensureLanguages = () => {
            if (pending || destroyed) return;
            const langs = missingLanguages(view.state);
            if (!langs.length) return;
            pending = true;
            void loadHighlighter()
              .then(() => Promise.all(langs.map((lang) => loadLanguage(lang))))
              .then(() => {
                pending = false;
                if (!destroyed) view.dispatch(view.state.tr.setMeta(key, REFRESH));
              });
          };
          ensureLanguages();
          return {
            update: (_view, prev) => {
              if (prev.doc === view.state.doc) return;
              clearTimeout(timer);
              timer = setTimeout(ensureLanguages, 300);
            },
            destroy: () => {
              destroyed = true;
              clearTimeout(timer);
            },
          };
        },
      }),
    ];
  },
});
