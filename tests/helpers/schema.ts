import { getSchema } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";

import { createSchemaExtensions } from "../../src/editor/extensions";
import { attachNodes, parseMarkdown, serializeMarkdown } from "../../src/editor/markdown";
import type { MarkdownStyle, SourceMap } from "../../src/editor/markdown";

export const schema = getSchema(createSchemaExtensions());

export interface Loaded {
  doc: PMNode;
  sourceMap: SourceMap;
  style: MarkdownStyle;
}

/** Mirrors what the editor does on load: parse, build nodes, attach source. */
export function load(markdown: string): Loaded {
  const parsed = parseMarkdown(markdown);
  const doc = schema.nodeFromJSON(parsed.doc);
  doc.check();
  attachNodes(parsed.sourceMap, doc, parsed.blockTypes);
  return { doc, sourceMap: parsed.sourceMap, style: parsed.style };
}

export function save(loaded: Loaded): string {
  return serializeMarkdown(loaded.doc, loaded.sourceMap, loaded.style).markdown;
}

/** Serializes without any source map, i.e. fully re-rendered Markdown. */
export function render(doc: PMNode, style?: MarkdownStyle): string {
  return serializeMarkdown(doc, null, style).markdown;
}
