import { Extension } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { Transaction } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

// `dir="auto"` on a container ignores descendants that carry their own
// `dir` (every paragraph does), so lists, quotes and tables would always
// resolve to LTR. This plugin sets their direction from their own text.

const CONTAINERS = new Set([
  "bulletList",
  "orderedList",
  "taskList",
  "listItem",
  "taskItem",
  "blockquote",
  "table",
]);

const FIRST_LETTER = /\p{L}/u;
const RTL_SCRIPT =
  /[\p{Script=Arabic}\p{Script=Hebrew}\p{Script=Syriac}\p{Script=Thaana}\p{Script=Nko}]/u;

export function textDirection(text: string): "rtl" | "ltr" | null {
  const letter = FIRST_LETTER.exec(text)?.[0];
  if (!letter) return null;
  return RTL_SCRIPT.test(letter) ? "rtl" : "ltr";
}

function decorateBlock(node: PMNode, pos: number, out: Decoration[]): void {
  if (CONTAINERS.has(node.type.name)) {
    const dir = textDirection(node.textContent);
    if (dir) out.push(Decoration.node(pos, pos + node.nodeSize, { dir }));
  }
  if (node.isTextblock) return;
  node.forEach((child, offset) => decorateBlock(child, pos + 1 + offset, out));
}

function build(doc: PMNode): DecorationSet {
  const out: Decoration[] = [];
  doc.forEach((child, offset) => decorateBlock(child, offset, out));
  return DecorationSet.create(doc, out);
}

/** Re-computes only the top-level blocks touched by the transaction. */
function update(tr: Transaction, set: DecorationSet): DecorationSet {
  let next = set.map(tr.mapping, tr.doc);
  const touched = new Set<number>();
  tr.mapping.maps.forEach((map, index) => {
    map.forEach((_a, _b, start, end) => {
      const rest = tr.mapping.slice(index + 1);
      const from = Math.max(0, rest.map(start, -1));
      const to = Math.min(tr.doc.content.size, rest.map(end, 1));
      tr.doc.nodesBetween(from, to, (_node, pos) => {
        touched.add(pos);
        return false;
      });
    });
  });
  for (const pos of touched) {
    const node = tr.doc.nodeAt(pos);
    if (!node) continue;
    next = next.remove(next.find(pos, pos + node.nodeSize));
    const out: Decoration[] = [];
    decorateBlock(node, pos, out);
    next = next.add(tr.doc, out);
  }
  return next;
}

const key = new PluginKey<DecorationSet>("textDirection");

export const TextDirection = Extension.create({
  name: "textDirection",
  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key,
        state: {
          init: (_config, state) => build(state.doc),
          apply: (tr, set) => (tr.docChanged ? update(tr, set) : set),
        },
        props: { decorations: (state) => key.getState(state) },
      }),
    ];
  },
});
