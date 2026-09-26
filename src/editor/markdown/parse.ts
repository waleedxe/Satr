import type { JSONContent } from "@tiptap/core";
import type {
  BlockContent,
  DefinitionContent,
  List,
  ListItem,
  Nodes,
  PhrasingContent,
  RootContent,
  Table,
} from "mdast";

import { detectStyle, parseMdast } from "./processor";
import type { MarkdownStyle } from "./processor";
import type { SourceMap } from "./sourceMap";

export interface ParseResult {
  doc: JSONContent;
  sourceMap: SourceMap;
  style: MarkdownStyle;
  /** Top-level node type of each source block, used by `attachNodes`. */
  blockTypes: string[];
}

type MarkJSON = NonNullable<JSONContent["marks"]>[number];

/** Thrown for Markdown the editor schema cannot represent faithfully. */
class Unsupported extends Error {}

function sliceOf(source: string, node: Nodes): string | null {
  const start = node.position?.start.offset;
  const end = node.position?.end.offset;
  return start === undefined || end === undefined ? null : source.slice(start, end);
}

function withMark(marks: MarkJSON[], mark: MarkJSON): MarkJSON[] {
  if (mark.type === "link") return [...marks.filter((m) => m.type !== "link"), mark];
  return marks.some((m) => m.type === mark.type) ? marks : [...marks, mark];
}

function marked(node: JSONContent, marks: MarkJSON[]): JSONContent {
  return marks.length ? { ...node, marks } : node;
}

class Converter {
  constructor(private source: string) {}

  inline(nodes: PhrasingContent[], marks: MarkJSON[] = []): JSONContent[] {
    const out: JSONContent[] = [];
    for (const node of nodes) {
      switch (node.type) {
        case "text":
          if (node.value) out.push(marked({ type: "text", text: node.value }, marks));
          break;
        case "emphasis":
          out.push(...this.inline(node.children, withMark(marks, { type: "italic" })));
          break;
        case "strong":
          out.push(...this.inline(node.children, withMark(marks, { type: "bold" })));
          break;
        case "delete":
          out.push(...this.inline(node.children, withMark(marks, { type: "strike" })));
          break;
        case "inlineCode":
          if (node.value) {
            out.push({ type: "text", text: node.value, marks: withMark(marks, { type: "code" }) });
          } else {
            out.push(this.rawInline(node, marks));
          }
          break;
        case "link":
          out.push(
            ...this.inline(
              node.children,
              withMark(marks, {
                type: "link",
                attrs: { href: node.url, title: node.title ?? null },
              }),
            ),
          );
          break;
        case "image":
          out.push(
            marked(
              {
                type: "image",
                attrs: { src: node.url, alt: node.alt ?? null, title: node.title ?? null },
              },
              marks,
            ),
          );
          break;
        case "break":
          out.push(marked({ type: "hardBreak" }, marks));
          break;
        case "inlineMath":
          out.push(marked({ type: "mathInline", attrs: { latex: node.value } }, marks));
          break;
        case "html":
          out.push(marked({ type: "rawInline", attrs: { value: node.value } }, marks));
          break;
        default:
          // linkReference, imageReference, footnoteReference, ...
          out.push(this.rawInline(node, marks));
      }
    }
    return out;
  }

  private rawInline(node: Nodes, marks: MarkJSON[]): JSONContent {
    const raw = sliceOf(this.source, node);
    if (raw === null) throw new Unsupported();
    return marked({ type: "rawInline", attrs: { value: raw } }, marks);
  }

  private paragraph(children: PhrasingContent[]): JSONContent {
    const content = this.inline(children);
    return content.length ? { type: "paragraph", content } : { type: "paragraph" };
  }

  blocks(nodes: (BlockContent | DefinitionContent | RootContent)[]): JSONContent[] {
    return nodes.map((node) => this.block(node));
  }

  block(node: RootContent): JSONContent {
    switch (node.type) {
      case "paragraph":
        return this.paragraph(node.children);
      case "heading": {
        const content = this.inline(node.children);
        return {
          type: "heading",
          attrs: { level: node.depth },
          ...(content.length ? { content } : {}),
        };
      }
      case "thematicBreak":
        return { type: "horizontalRule" };
      case "blockquote": {
        const content = this.blocks(node.children);
        return { type: "blockquote", content: content.length ? content : [{ type: "paragraph" }] };
      }
      case "code":
        return {
          type: "codeBlock",
          attrs: { language: node.lang ?? null, meta: node.meta ?? null },
          ...(node.value ? { content: [{ type: "text", text: node.value }] } : {}),
        };
      case "math":
        return { type: "mathBlock", attrs: { latex: node.value } };
      case "list":
        return this.list(node);
      case "table":
        return this.table(node);
      case "html":
        return this.rawBlock(node.value, "html");
      case "yaml": {
        const raw = sliceOf(this.source, node);
        if (raw === null) throw new Unsupported();
        return this.rawBlock(raw, "frontmatter");
      }
      default:
        throw new Unsupported();
    }
  }

  rawBlock(text: string, kind: "raw" | "html" | "frontmatter"): JSONContent {
    return {
      type: "rawBlock",
      attrs: { kind },
      ...(text ? { content: [{ type: "text", text }] } : {}),
    };
  }

  private listItemContent(item: ListItem): JSONContent[] {
    if (item.children.length === 0) return [{ type: "paragraph" }];
    if (item.children[0]?.type !== "paragraph") throw new Unsupported();
    return this.blocks(item.children);
  }

  private list(node: List): JSONContent {
    const checks = node.children.map((item) => item.checked);
    const tasks = checks.filter((c) => c !== null && c !== undefined).length;
    if (tasks > 0) {
      // GFM allows mixed and ordered task lists; the editor does not.
      if (tasks !== checks.length || node.ordered) throw new Unsupported();
      return {
        type: "taskList",
        attrs: { spread: Boolean(node.spread) },
        content: node.children.map((item) => ({
          type: "taskItem",
          attrs: { checked: Boolean(item.checked), spread: Boolean(item.spread) },
          content: this.listItemContent(item),
        })),
      };
    }
    const items = node.children.map((item) => ({
      type: "listItem",
      attrs: { spread: Boolean(item.spread) },
      content: this.listItemContent(item),
    }));
    if (node.ordered) {
      return {
        type: "orderedList",
        attrs: { start: node.start ?? 1, spread: Boolean(node.spread) },
        content: items,
      };
    }
    return { type: "bulletList", attrs: { spread: Boolean(node.spread) }, content: items };
  }

  private table(node: Table): JSONContent {
    const width = Math.max(...node.children.map((row) => row.children.length), 1);
    return {
      type: "table",
      content: node.children.map((row, rowIndex) => {
        const cells = [...row.children];
        const content: JSONContent[] = [];
        for (let c = 0; c < width; c++) {
          const cell = cells[c];
          const inline = cell ? this.inline(cell.children) : [];
          content.push({
            type: rowIndex === 0 ? "tableHeader" : "tableCell",
            attrs: { align: node.align?.[c] ?? null },
            content: [
              inline.length ? { type: "paragraph", content: inline } : { type: "paragraph" },
            ],
          });
        }
        return { type: "tableRow", content };
      }),
    };
  }
}

/** Parses Markdown into editor JSON plus the source map used when saving. */
export function parseMarkdown(markdown: string): ParseResult {
  const tree = parseMdast(markdown);
  const style = detectStyle(tree, markdown);
  const converter = new Converter(markdown);
  const content: JSONContent[] = [];
  const sourceMap: SourceMap = { blocks: [], separators: [], leading: "", trailing: "" };
  const blockTypes: string[] = [];

  let cursor = 0;
  tree.children.forEach((child, index) => {
    const start = child.position?.start.offset ?? cursor;
    const end = child.position?.end.offset ?? start;
    const raw = markdown.slice(start, end);
    const gap = markdown.slice(cursor, start);
    if (index === 0) sourceMap.leading = gap;
    else sourceMap.separators.push(gap);
    cursor = end;

    let node: JSONContent;
    try {
      node = converter.block(child);
    } catch (error) {
      if (!(error instanceof Unsupported)) throw error;
      node = converter.rawBlock(raw, "raw");
    }
    content.push(node);
    blockTypes.push(node.type ?? "");
    sourceMap.blocks.push({ raw });
  });
  sourceMap.trailing = tree.children.length ? markdown.slice(cursor) : markdown;

  return {
    doc: { type: "doc", content: content.length ? content : [{ type: "paragraph" }] },
    sourceMap,
    style,
    blockTypes,
  };
}
