import { Node, mergeAttributes } from "@tiptap/core";

/**
 * Markdown the visual editor does not model (raw HTML, front matter,
 * footnote/reference definitions, unusual list shapes...). It is shown and
 * edited as plain source and written back byte-for-byte, so nothing is lost.
 */
export const RawBlock = Node.create({
  name: "rawBlock",
  group: "block",
  content: "text*",
  marks: "",
  code: true,
  defining: true,

  addAttributes() {
    return {
      kind: { default: "raw" as "raw" | "html" | "frontmatter" },
    };
  },

  parseHTML() {
    return [
      {
        tag: "pre[data-raw-block]",
        preserveWhitespace: "full",
        getAttrs: (el) => ({ kind: (el as HTMLElement).getAttribute("data-kind") ?? "raw" }),
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const labels: Record<string, string> = {
      html: "HTML",
      frontmatter: "Front matter",
      raw: "Markdown",
    };
    return [
      "pre",
      mergeAttributes(HTMLAttributes, {
        "data-raw-block": "",
        "data-kind": node.attrs.kind,
        "data-label": labels[String(node.attrs.kind)] ?? "Markdown",
        class: "raw-block",
        spellcheck: "false",
      }),
      ["code", 0],
    ];
  },
});

/** Inline Markdown the editor does not model (inline HTML, reference links...). */
export const RawInline = Node.create({
  name: "rawInline",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return { value: { default: "" } };
  },

  parseHTML() {
    return [
      {
        tag: "span[data-raw-inline]",
        getAttrs: (el) => ({ value: (el as HTMLElement).getAttribute("data-value") ?? "" }),
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-raw-inline": "",
        "data-value": node.attrs.value,
        class: "raw-inline",
        title: "Raw Markdown (edit in source mode)",
      }),
      String(node.attrs.value),
    ];
  },

  renderText({ node }) {
    return String(node.attrs.value);
  },
});
