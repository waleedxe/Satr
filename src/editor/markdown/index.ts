import type { Schema, Node as PMNode, Fragment } from "@tiptap/pm/model";
import { Slice } from "@tiptap/pm/model";

import { parseMarkdown } from "./parse";
import { DEFAULT_STYLE } from "./processor";
import { serializeMarkdown } from "./serialize";

export { parseMarkdown } from "./parse";
export type { ParseResult } from "./parse";
export { serializeMarkdown, renderBlock } from "./serialize";
export { DEFAULT_STYLE } from "./processor";
export type { MarkdownStyle } from "./processor";
export { attachNodes, emptySourceMap } from "./sourceMap";
export type { SourceMap } from "./sourceMap";

export type LineEnding = "\n" | "\r\n";

/** Normalizes CRLF/CR to LF and reports which ending the file mostly used. */
export function normalizeLineEndings(text: string): { text: string; eol: LineEnding } {
  const crlf = text.match(/\r\n/g)?.length ?? 0;
  const lf = (text.match(/\n/g)?.length ?? 0) - crlf;
  return {
    text: text.replace(/\r\n?/g, "\n"),
    eol: crlf > lf ? "\r\n" : "\n",
  };
}

export function applyLineEnding(text: string, eol: LineEnding): string {
  return eol === "\n" ? text : text.replace(/\n/g, eol);
}

/** Parses pasted Markdown into a slice that can be inserted into the editor. */
export function markdownToSlice(schema: Schema, markdown: string): Slice {
  const { doc } = parseMarkdown(markdown.replace(/\r\n?/g, "\n"));
  const node = schema.nodeFromJSON(doc);
  return Slice.maxOpen(node.content);
}

/** Serializes copied editor content to Markdown for the plain-text clipboard. */
export function fragmentToMarkdown(schema: Schema, fragment: Fragment): string {
  let doc: PMNode;
  const first = fragment.firstChild;
  if (first && first.isInline) {
    doc = schema.topNodeType.create(null, schema.nodes.paragraph!.create(null, fragment));
  } else {
    try {
      doc = schema.topNodeType.create(null, fragment);
    } catch {
      return fragment.textBetween(0, fragment.size, "\n\n");
    }
  }
  return serializeMarkdown(doc, null, DEFAULT_STYLE).markdown.replace(/\n$/, "");
}
