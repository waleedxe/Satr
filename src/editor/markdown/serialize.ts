import type { Mark, Node as PMNode } from "@tiptap/pm/model";
import type {
  AlignType,
  BlockContent,
  ListItem,
  PhrasingContent,
  RootContent,
  TableCell,
  TableRow,
} from "mdast";

import { DEFAULT_STYLE, getStringifier, otherBullet } from "./processor";
import type { MarkdownStyle } from "./processor";
import type { SourceBlock, SourceMap } from "./sourceMap";

export interface SerializeResult {
  markdown: string;
  /** Source map describing `markdown`, for the next save. */
  sourceMap: SourceMap;
}

/* ------------------------------------------------------------------ */
/* Editor node -> mdast                                                 */
/* ------------------------------------------------------------------ */

const MARK_RANK: Record<string, number> = { link: 0, bold: 1, italic: 2, strike: 3 };

function isEmptyParagraph(node: PMNode): boolean {
  return node.type.name === "paragraph" && node.content.size === 0;
}

function markEq(a: Mark, b: Mark): boolean {
  if (a.type !== b.type) return false;
  if (a.type.name !== "link") return true;
  return a.attrs.href === b.attrs.href && (a.attrs.title ?? null) === (b.attrs.title ?? null);
}

function formattingMarks(node: PMNode): Mark[] {
  return node.marks.filter((m) => m.type.name in MARK_RANK);
}

type ParentPhrasing = Extract<PhrasingContent, { children: PhrasingContent[] }>;

function markToMdast(mark: Mark): ParentPhrasing {
  switch (mark.type.name) {
    case "bold":
      return { type: "strong", children: [] };
    case "italic":
      return { type: "emphasis", children: [] };
    case "strike":
      return { type: "delete", children: [] };
    default:
      return {
        type: "link",
        url: String(mark.attrs.href ?? ""),
        title: (mark.attrs.title as string | null) ?? null,
        children: [],
      };
  }
}

function leafToMdast(node: PMNode): PhrasingContent | null {
  switch (node.type.name) {
    case "text":
      return node.marks.some((m) => m.type.name === "code")
        ? { type: "inlineCode", value: node.text ?? "" }
        : { type: "text", value: node.text ?? "" };
    case "hardBreak":
      return { type: "break" };
    case "image":
      return {
        type: "image",
        url: String(node.attrs.src ?? ""),
        alt: (node.attrs.alt as string | null) ?? null,
        title: (node.attrs.title as string | null) ?? null,
      };
    case "mathInline":
      return { type: "inlineMath", value: String(node.attrs.latex ?? "") };
    case "rawInline":
      return { type: "html", value: String(node.attrs.value ?? "") };
    default:
      return node.textContent ? { type: "text", value: node.textContent } : null;
  }
}

/**
 * Converts inline content to nested mdast phrasing nodes. Marks that span
 * further ahead are opened first (outermost) so `**a *b***` style runs nest
 * cleanly instead of being closed and reopened.
 */
function inlineToMdast(parent: PMNode): PhrasingContent[] {
  const items: PMNode[] = [];
  parent.content.forEach((child) => items.push(child));
  const root: PhrasingContent[] = [];
  const stack: { mark: Mark; node: ParentPhrasing }[] = [];
  const target = () => stack[stack.length - 1]?.node.children ?? root;

  items.forEach((item, index) => {
    const marks = formattingMarks(item);
    let keep = 0;
    while (keep < stack.length && marks.some((m) => markEq(m, stack[keep]!.mark))) keep++;
    stack.length = keep;

    const runLength = (mark: Mark) => {
      let n = 1;
      for (let j = index + 1; j < items.length; j++) {
        if (!formattingMarks(items[j]!).some((m) => markEq(m, mark))) break;
        n++;
      }
      return n;
    };
    const open = marks
      .filter((m) => !stack.some((s) => markEq(s.mark, m)))
      .map((mark) => ({ mark, run: runLength(mark) }))
      .sort((a, b) => b.run - a.run || MARK_RANK[a.mark.type.name]! - MARK_RANK[b.mark.type.name]!);
    for (const { mark } of open) {
      const node = markToMdast(mark);
      target().push(node);
      stack.push({ mark, node });
    }
    const leaf = leafToMdast(item);
    if (leaf) target().push(leaf);
  });
  return root;
}

function blocksToMdast(parent: PMNode): BlockContent[] {
  const out: BlockContent[] = [];
  parent.content.forEach((child) => {
    const node = blockToMdast(child);
    if (node) out.push(node as BlockContent);
  });
  return out;
}

function listItem(node: PMNode, checked: boolean | null): ListItem {
  return {
    type: "listItem",
    spread: Boolean(node.attrs.spread),
    checked,
    children: blocksToMdast(node),
  };
}

function tableToMdast(node: PMNode): RootContent {
  const rows: TableRow[] = [];
  let align: AlignType[] = [];
  node.content.forEach((row, _offset, rowIndex) => {
    const cells: TableCell[] = [];
    row.content.forEach((cell) => {
      const children: PhrasingContent[] = [];
      cell.content.forEach((block, _o, i) => {
        if (i > 0) children.push({ type: "text", value: " " });
        children.push(...inlineToMdast(block));
      });
      cells.push({ type: "tableCell", children });
      // Merged cells cannot be expressed in Markdown; pad instead.
      const span = Number(cell.attrs.colspan ?? 1);
      for (let s = 1; s < span; s++) cells.push({ type: "tableCell", children: [] });
      if (rowIndex === 0) {
        align.push((cell.attrs.align as AlignType) ?? null);
        for (let s = 1; s < span; s++) align.push(null);
      }
    });
    rows.push({ type: "tableRow", children: cells });
  });
  const width = Math.max(...rows.map((r) => r.children.length), 0);
  align = Array.from({ length: width }, (_, i) => align[i] ?? null);
  return { type: "table", align, children: rows };
}

export function blockToMdast(node: PMNode): RootContent | null {
  switch (node.type.name) {
    case "paragraph":
      return isEmptyParagraph(node) ? null : { type: "paragraph", children: inlineToMdast(node) };
    case "heading":
      return {
        type: "heading",
        depth: Math.min(Math.max(Number(node.attrs.level ?? 1), 1), 6) as 1 | 2 | 3 | 4 | 5 | 6,
        children: inlineToMdast(node),
      };
    case "blockquote":
      return { type: "blockquote", children: blocksToMdast(node) };
    case "codeBlock":
      return {
        type: "code",
        lang: (node.attrs.language as string | null) || null,
        meta: (node.attrs.meta as string | null) || null,
        value: node.textContent,
      };
    case "horizontalRule":
      return { type: "thematicBreak" };
    case "bulletList":
    case "orderedList":
    case "taskList": {
      const ordered = node.type.name === "orderedList";
      const task = node.type.name === "taskList";
      const children: ListItem[] = [];
      node.content.forEach((item) =>
        children.push(listItem(item, task ? Boolean(item.attrs.checked) : null)),
      );
      return {
        type: "list",
        ordered,
        start: ordered ? Number(node.attrs.start ?? 1) : null,
        spread: Boolean(node.attrs.spread),
        children,
      };
    }
    case "table":
      return tableToMdast(node);
    case "mathBlock":
      return { type: "math", value: String(node.attrs.latex ?? "") };
    case "rawBlock":
      // `html` nodes are written verbatim, which is exactly what raw blocks need.
      return { type: "html", value: node.textContent };
    case "image":
    case "text":
    case "hardBreak":
    case "mathInline":
    case "rawInline":
      return {
        type: "paragraph",
        children: inlineToMdast(node.type.schema.nodes.paragraph!.create(null, node)),
      };
    default:
      return node.textContent
        ? { type: "paragraph", children: [{ type: "text", value: node.textContent }] }
        : null;
  }
}

/* ------------------------------------------------------------------ */
/* Block rendering with verbatim reuse                                  */
/* ------------------------------------------------------------------ */

const canonicalCache = new WeakMap<PMNode, Map<string, string | null>>();

/** Markdown for a single top-level block, or null if it renders to nothing. */
export function renderBlock(node: PMNode, style: MarkdownStyle): string | null {
  const key = JSON.stringify(style);
  let perStyle = canonicalCache.get(node);
  if (perStyle?.has(key)) return perStyle.get(key)!;
  const mdast = blockToMdast(node);
  const text = mdast
    ? getStringifier(style)({ type: "root", children: [mdast] }).replace(/\n$/, "")
    : null;
  if (!perStyle) {
    perStyle = new Map();
    canonicalCache.set(node, perStyle);
  }
  perStyle.set(key, text);
  return text;
}

interface Entry {
  node: PMNode;
  text: string;
  /** Index of the reused source block, or -1 if rendered fresh. */
  origin: number;
}

const LOOKAHEAD = 32;

function listKind(node: PMNode): "bullet" | "ordered" | null {
  const name = node.type.name;
  if (name === "bulletList" || name === "taskList") return "bullet";
  if (name === "orderedList") return "ordered";
  return null;
}

function listMarker(text: string, kind: "bullet" | "ordered"): string {
  if (kind === "bullet") return text.trimStart()[0] ?? "";
  return /^\s*\d+([.)])/.exec(text)?.[1] ?? "";
}

/**
 * Serializes the editor document to Markdown. Top-level blocks that are
 * unchanged since the last load/save (per `sourceMap`) are copied verbatim;
 * everything else is rendered with the document's detected style.
 */
export function serializeMarkdown(
  doc: PMNode,
  sourceMap: SourceMap | null,
  style: MarkdownStyle = DEFAULT_STYLE,
): SerializeResult {
  const originals: SourceBlock[] = sourceMap?.blocks ?? [];
  const entries: Entry[] = [];
  let next = 0;

  doc.content.forEach((node) => {
    let origin = -1;
    for (let k = next; k < Math.min(originals.length, next + LOOKAHEAD); k++) {
      const candidate = originals[k]!.node;
      if (candidate && (candidate === node || candidate.eq(node))) {
        origin = k;
        break;
      }
    }
    if (origin >= 0) {
      entries.push({ node, text: originals[origin]!.raw, origin });
      next = origin + 1;
      return;
    }
    const text = renderBlock(node, style);
    if (text !== null) entries.push({ node, text, origin: -1 });
  });

  // Two adjacent lists with the same marker would merge into one list when
  // read back; switch the marker of the second one.
  for (let i = 1; i < entries.length; i++) {
    const prev = entries[i - 1]!;
    const cur = entries[i]!;
    const kind = listKind(cur.node);
    if (!kind || kind !== listKind(prev.node)) continue;
    const marker = listMarker(prev.text, kind);
    if (marker !== listMarker(cur.text, kind)) continue;
    const alt: MarkdownStyle =
      kind === "bullet"
        ? { ...style, bullet: otherBullet(marker as MarkdownStyle["bullet"]) }
        : { ...style, bulletOrdered: marker === "." ? ")" : "." };
    cur.text = renderBlock(cur.node, alt) ?? cur.text;
    cur.origin = -1;
  }

  const separators: string[] = [];
  let markdown = "";
  entries.forEach((entry, i) => {
    if (i === 0) {
      if (entry.origin === 0) markdown += sourceMap?.leading ?? "";
    } else {
      const prev = entries[i - 1]!;
      const sep =
        prev.origin >= 0 && entry.origin === prev.origin + 1
          ? (sourceMap?.separators[prev.origin] ?? "\n\n")
          : "\n\n";
      separators.push(sep);
      markdown += sep;
    }
    markdown += entry.text;
  });
  const leading = entries[0]?.origin === 0 ? (sourceMap?.leading ?? "") : "";

  let trailing: string;
  if (entries.length === 0) trailing = originals.length ? "" : (sourceMap?.trailing ?? "");
  else if (originals.length) trailing = sourceMap?.trailing ?? "\n";
  else trailing = "\n";
  markdown += trailing;

  return {
    markdown,
    sourceMap: {
      blocks: entries.map((e) => ({ raw: e.text, node: e.node })),
      separators,
      leading,
      trailing,
    },
  };
}
