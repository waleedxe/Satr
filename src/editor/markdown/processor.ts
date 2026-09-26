import type { Nodes, Root } from "mdast";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import { unified } from "unified";

/** Markdown syntax preferences detected from a file and reused when writing. */
export interface MarkdownStyle {
  bullet: "-" | "*" | "+";
  bulletOrdered: "." | ")";
  emphasis: "*" | "_";
  strong: "*" | "_";
  fence: "`" | "~";
  rule: "-" | "*" | "_";
}

export const DEFAULT_STYLE: MarkdownStyle = {
  bullet: "-",
  bulletOrdered: ".",
  emphasis: "*",
  strong: "*",
  fence: "`",
  rule: "-",
};

const parser = unified()
  .use(remarkParse)
  .use(remarkFrontmatter, ["yaml"])
  .use(remarkGfm)
  .use(remarkMath);

export function parseMdast(markdown: string): Root {
  return parser.parse(markdown);
}

export function otherBullet(bullet: MarkdownStyle["bullet"]): MarkdownStyle["bullet"] {
  return bullet === "-" ? "*" : "-";
}

type Stringifier = (tree: Root) => string;
const stringifiers = new Map<string, Stringifier>();

export function getStringifier(style: MarkdownStyle): Stringifier {
  const key = JSON.stringify(style);
  let fn = stringifiers.get(key);
  if (!fn) {
    const processor = unified()
      .use(remarkFrontmatter, ["yaml"])
      .use(remarkGfm)
      .use(remarkMath)
      .use(remarkStringify, {
        bullet: style.bullet,
        bulletOther: otherBullet(style.bullet),
        bulletOrdered: style.bulletOrdered,
        emphasis: style.emphasis,
        strong: style.strong,
        fence: style.fence,
        rule: style.rule,
        fences: true,
        listItemIndent: "one",
        incrementListMarker: true,
        setext: false,
        closeAtx: false,
        resourceLink: false,
      });
    fn = (tree: Root) => processor.stringify(tree);
    stringifiers.set(key, fn);
  }
  return fn;
}

function pick<T extends string>(counts: Map<T, number>, fallback: T): T {
  let best = fallback;
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

function bump<T>(map: Map<T, number>, key: T): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

/** Looks at how the source writes lists, emphasis, fences and rules. */
export function detectStyle(tree: Root, source: string): MarkdownStyle {
  const bullets = new Map<MarkdownStyle["bullet"], number>();
  const ordered = new Map<MarkdownStyle["bulletOrdered"], number>();
  const emphasis = new Map<MarkdownStyle["emphasis"], number>();
  const strong = new Map<MarkdownStyle["strong"], number>();
  const fences = new Map<MarkdownStyle["fence"], number>();
  const rules = new Map<MarkdownStyle["rule"], number>();

  const charAt = (node: Nodes) => {
    const offset = node.position?.start.offset;
    return offset === undefined ? "" : (source[offset] ?? "");
  };

  const walk = (node: Nodes) => {
    switch (node.type) {
      case "list":
        for (const item of node.children) {
          const offset = item.position?.start.offset;
          if (offset === undefined) continue;
          if (node.ordered) {
            const m = /^\d{1,9}([.)])/.exec(source.slice(offset, offset + 12));
            if (m) bump(ordered, m[1] as MarkdownStyle["bulletOrdered"]);
          } else {
            const ch = source[offset];
            if (ch === "-" || ch === "*" || ch === "+") bump(bullets, ch);
          }
        }
        break;
      case "emphasis": {
        const ch = charAt(node);
        if (ch === "*" || ch === "_") bump(emphasis, ch);
        break;
      }
      case "strong": {
        const ch = charAt(node);
        if (ch === "*" || ch === "_") bump(strong, ch);
        break;
      }
      case "code": {
        const ch = charAt(node);
        if (ch === "`" || ch === "~") bump(fences, ch);
        break;
      }
      case "thematicBreak": {
        const ch = charAt(node);
        if (ch === "-" || ch === "*" || ch === "_") bump(rules, ch);
        break;
      }
    }
    if ("children" in node) {
      for (const child of node.children) walk(child as Nodes);
    }
  };
  walk(tree);

  return {
    bullet: pick(bullets, DEFAULT_STYLE.bullet),
    bulletOrdered: pick(ordered, DEFAULT_STYLE.bulletOrdered),
    emphasis: pick(emphasis, DEFAULT_STYLE.emphasis),
    strong: pick(strong, DEFAULT_STYLE.strong),
    fence: pick(fences, DEFAULT_STYLE.fence),
    rule: pick(rules, DEFAULT_STYLE.rule),
  };
}
