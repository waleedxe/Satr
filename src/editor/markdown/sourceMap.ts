import type { Node as PMNode } from "@tiptap/pm/model";

/**
 * Remembers the exact source text of each top-level block of the last loaded
 * or saved Markdown. When saving, blocks the user did not touch are written
 * back verbatim, so unrelated parts of a file are never reformatted.
 */
export interface SourceBlock {
  /** Exact source text of the block. */
  raw: string;
  /** Top-level editor node this text produced (attached after loading). */
  node?: PMNode;
}

export interface SourceMap {
  blocks: SourceBlock[];
  /** separators[i] is the text between blocks[i] and blocks[i + 1]. */
  separators: string[];
  /** Text before the first block (usually empty). */
  leading: string;
  /** Text after the last block (usually a single newline). */
  trailing: string;
}

export function emptySourceMap(): SourceMap {
  return { blocks: [], separators: [], leading: "", trailing: "" };
}

/**
 * Links each source block to the editor node created from it. Blocks whose
 * node does not line up (should not happen) are simply never reused.
 */
export function attachNodes(map: SourceMap, doc: PMNode, blockTypes: string[]): void {
  map.blocks.forEach((block, index) => {
    const node = index < doc.childCount ? doc.child(index) : undefined;
    block.node = node && node.type.name === blockTypes[index] ? node : undefined;
  });
}
