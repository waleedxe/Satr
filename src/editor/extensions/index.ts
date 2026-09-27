import type { AnyExtension } from "@tiptap/core";
import Code from "@tiptap/extension-code";
import Link from "@tiptap/extension-link";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import Strike from "@tiptap/extension-strike";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import StarterKit from "@tiptap/starter-kit";

import { MarkdownCodeBlock } from "./codeBlock";
import { DocumentContext } from "./documentContext";
import { MarkdownImage } from "./image";
import { MarkdownAttributes } from "./markdownAttributes";
import { MathBlock, MathInline } from "./math";
import { RawBlock, RawInline } from "./raw";

// Markdown table cells hold a single line of inline content.
const MarkdownTableCell = TableCell.extend({ content: "paragraph" });
const MarkdownTableHeader = TableHeader.extend({ content: "paragraph" });

// Markdown allows inline code inside links and emphasis, so the code mark
// must not exclude other marks.
const MarkdownCode = Code.extend({ excludes: "" });

// Ctrl+Shift+S is "Save As"; strikethrough uses Ctrl+Shift+X instead.
const MarkdownStrike = Strike.extend({
  addKeyboardShortcuts() {
    return { "Mod-Shift-x": () => this.editor.commands.toggleStrike() };
  },
});

/**
 * Extensions that define the document schema. Shared by the editor and by
 * the Markdown converter tests, so they must not require a DOM at import.
 */
export function createSchemaExtensions(): AnyExtension[] {
  return [
    StarterKit.configure({
      codeBlock: false,
      code: false,
      strike: false,
      link: false,
      underline: false,
      trailingNode: false,
      heading: { levels: [1, 2, 3, 4, 5, 6] },
    }),
    MarkdownCode,
    MarkdownStrike,
    Link.configure({
      openOnClick: false,
      autolink: true,
      linkOnPaste: true,
      defaultProtocol: "https",
      HTMLAttributes: { target: null, rel: "noopener noreferrer nofollow" },
    }),
    MarkdownCodeBlock,
    TaskList,
    TaskItem.configure({ nested: true }),
    Table.configure({ resizable: false, allowTableNodeSelection: true }),
    TableRow,
    MarkdownTableHeader,
    MarkdownTableCell,
    MarkdownImage,
    MathInline,
    MathBlock,
    RawBlock,
    RawInline,
    MarkdownAttributes,
    DocumentContext,
  ];
}
