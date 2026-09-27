import type { Node as PMNode } from "@tiptap/pm/model";

export interface Heading {
  level: number;
  text: string;
}

/** Headings of the visual editor's document, in order. */
export function headingsFromDoc(doc: PMNode): Heading[] {
  const headings: Heading[] = [];
  doc.descendants((node) => {
    if (node.type.name === "heading") {
      headings.push({ level: Number(node.attrs.level ?? 1), text: node.textContent.trim() });
      return false;
    }
    // Headings only appear at the top level or inside blockquotes/lists.
    return node.isBlock && !node.isTextblock;
  });
  return headings;
}

/** Positions of heading nodes, in the same order as headingsFromDoc. */
export function headingPositions(doc: PMNode): number[] {
  const positions: number[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name === "heading") {
      positions.push(pos);
      return false;
    }
    return node.isBlock && !node.isTextblock;
  });
  return positions;
}

const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const ATX = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/;

function stripInlineMarkdown(text: string): string {
  return text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__|\*|_|~~|`)/g, "")
    .trim();
}

/** ATX headings of raw Markdown (skipping fenced code), with their line numbers. */
export function headingsFromMarkdown(markdown: string): (Heading & { line: number })[] {
  const headings: (Heading & { line: number })[] = [];
  let fence: string | null = null;
  let inFrontMatter = false;
  const lines = markdown.split("\n");
  lines.forEach((line, index) => {
    if (index === 0 && line === "---") {
      inFrontMatter = true;
      return;
    }
    if (inFrontMatter) {
      if (line === "---" || line === "...") inFrontMatter = false;
      return;
    }
    const fenceMatch = FENCE.exec(line);
    if (fenceMatch) {
      const marker = fenceMatch[1]!;
      if (fence === null) fence = marker;
      else if (marker[0] === fence[0] && marker.length >= fence.length) fence = null;
      return;
    }
    if (fence !== null) return;
    const m = ATX.exec(line);
    if (m) {
      headings.push({
        level: m[1]!.length,
        text: stripInlineMarkdown(m[2] ?? ""),
        line: index + 1,
      });
    }
  });
  return headings;
}
