import { Extension } from "@tiptap/core";

/**
 * Attributes that exist only to preserve Markdown details across a
 * parse/serialize round trip, plus `dir="auto"` so right-to-left text
 * (Arabic, Hebrew) renders correctly per block.
 */
export const MarkdownAttributes = Extension.create({
  name: "markdownAttributes",

  addGlobalAttributes() {
    return [
      {
        types: ["paragraph", "heading"],
        attributes: {
          dir: {
            default: "auto",
            rendered: true,
            parseHTML: () => "auto",
            renderHTML: () => ({ dir: "auto" }),
          },
        },
      },
      {
        // Loose ("spread") lists have blank lines between items.
        types: ["bulletList", "orderedList", "taskList", "listItem", "taskItem"],
        attributes: {
          spread: {
            default: false,
            keepOnSplit: true,
            parseHTML: () => false,
            renderHTML: () => ({}),
          },
        },
      },
      {
        types: ["tableCell", "tableHeader"],
        attributes: {
          align: {
            default: null,
            parseHTML: (el: HTMLElement) => {
              const value = el.style.textAlign;
              return value === "left" || value === "right" || value === "center" ? value : null;
            },
            renderHTML: (attrs: Record<string, unknown>) =>
              attrs.align ? { style: `text-align: ${String(attrs.align)}` } : {},
          },
        },
      },
    ];
  },
});
