import { Slice } from "@tiptap/pm/model";
import { describe, expect, it } from "vitest";

import {
  applyLineEnding,
  fragmentToMarkdown,
  markdownToSlice,
  normalizeLineEndings,
  parseMarkdown,
  serializeMarkdown,
} from "../../src/editor/markdown";
import { load, render, save, schema } from "../helpers/schema";

describe("verbatim preservation when editing", () => {
  const source = [
    "Intro   with  odd   spacing and _underscores_.",
    "",
    "* star list",
    "* second",
    "",
    "Paragraph to edit.",
    "",
    "| a | b |",
    "|---|:-:|",
    "| 1 | 2 |",
    "",
  ].join("\n");

  it("rewrites only the edited block", () => {
    const loaded = load(source);
    let pos = 0;
    for (let i = 0; i < 2; i++) pos += loaded.doc.child(i).nodeSize;
    const target = loaded.doc.child(2);
    const edited = schema.nodes.paragraph!.create(null, [
      schema.text("Edited "),
      schema.text("text", [schema.marks.bold!.create()]),
    ]);
    const doc = loaded.doc.replace(
      pos,
      pos + target.nodeSize,
      new Slice(schema.nodes.doc!.create(null, edited).content, 0, 0),
    );
    const out = serializeMarkdown(doc, loaded.sourceMap, loaded.style).markdown;
    expect(out).toBe(source.replace("Paragraph to edit.", "Edited **text**"));
  });

  it("keeps untouched blocks when a block is deleted", () => {
    const loaded = load(source);
    const first = loaded.doc.child(0);
    const doc = loaded.doc.replace(0, first.nodeSize, Slice.empty);
    const out = serializeMarkdown(doc, loaded.sourceMap, loaded.style).markdown;
    expect(out).toBe(source.slice(source.indexOf("* star list")));
  });

  it("returns a source map that makes the next save verbatim", () => {
    const loaded = load(source);
    const first = serializeMarkdown(loaded.doc, loaded.sourceMap, loaded.style);
    const second = serializeMarkdown(loaded.doc, first.sourceMap, loaded.style);
    expect(second.markdown).toBe(source);
  });
});

describe("serialization details", () => {
  it("does not merge adjacent lists that use the same marker", () => {
    const loaded = load("- a\n- b\n\n* c\n* d\n");
    const rendered = render(loaded.doc);
    expect(load(rendered).doc.childCount).toBe(2);
  });

  it("keeps table alignment", () => {
    const { doc } = load("| l | c | r |\n|:--|:-:|--:|\n| 1 | 2 | 3 |\n");
    expect(render(doc)).toContain("| :- | :-: | -: |");
  });

  it("keeps task state and nesting", () => {
    const { doc } = load("- [x] done\n- [ ] todo\n  - [x] nested\n");
    expect(render(doc)).toBe("- [x] done\n- [ ] todo\n  - [x] nested\n");
  });

  it("serializes math", () => {
    const { doc } = load("a $x^2$ b\n\n$$\n\\frac{1}{2}\n$$\n");
    expect(render(doc)).toBe("a $x^2$ b\n\n$$\n\\frac{1}{2}\n$$\n");
  });

  it("keeps link + code + emphasis nesting", () => {
    const md = '[**`code`** text](https://x.dev "t") and ***both*** *a **b***\n';
    const { doc } = load(md);
    expect(load(render(doc)).doc.toJSON()).toEqual(doc.toJSON());
  });

  it("drops empty paragraphs the editor adds", () => {
    const doc = schema.nodes.doc!.create(null, [
      schema.nodes.paragraph!.create(null, schema.text("x")),
      schema.nodes.paragraph!.create(),
      schema.nodes.paragraph!.create(),
    ]);
    expect(render(doc)).toBe("x\n");
  });

  it("handles an empty document", () => {
    const parsed = parseMarkdown("");
    expect(parsed.doc.content).toEqual([{ type: "paragraph" }]);
    expect(save(load(""))).toBe("");
    expect(render(schema.nodeFromJSON(parsed.doc))).toBe("");
  });

  it("preserves Arabic text exactly", () => {
    const md = "مرحبا **بالعالم** و English\n";
    expect(render(load(md).doc)).toBe(md);
  });

  it("detects document style", () => {
    const parsed = parseMarkdown("* a\n\n_x_ __y__\n\n~~~\nc\n~~~\n\n***\n\n1) z\n");
    expect(parsed.style).toEqual({
      bullet: "*",
      bulletOrdered: ")",
      emphasis: "_",
      strong: "_",
      fence: "~",
      rule: "*",
    });
  });

  it("uses the detected style for new content", () => {
    const loaded = load("* a\n* b\n");
    expect(render(loaded.doc, loaded.style)).toBe("* a\n* b\n");
  });

  it("keeps unsupported constructs as raw Markdown", () => {
    const md = "- [ ] task\n- normal item\n";
    const parsed = parseMarkdown(md);
    expect(parsed.blockTypes).toEqual(["rawBlock"]);
    expect(render(schema.nodeFromJSON(parsed.doc))).toBe(md);
  });

  it("escapes HTML-like text typed in the editor", () => {
    const doc = schema.nodes.doc!.create(
      null,
      schema.nodes.paragraph!.create(null, schema.text("<script>alert(1)</script>")),
    );
    const out = render(doc);
    expect(out).toBe("\\<script>alert(1)\\</script>\n");
    expect(parseMarkdown(out).blockTypes).toEqual(["paragraph"]);
  });
});

describe("line endings", () => {
  it("normalizes CRLF and restores it", () => {
    const { text, eol } = normalizeLineEndings("a\r\nb\r\n");
    expect(text).toBe("a\nb\n");
    expect(eol).toBe("\r\n");
    expect(applyLineEnding(text, eol)).toBe("a\r\nb\r\n");
  });

  it("defaults to LF", () => {
    expect(normalizeLineEndings("a\nb").eol).toBe("\n");
    expect(normalizeLineEndings("").eol).toBe("\n");
  });

  it("round-trips a CRLF document byte-for-byte", () => {
    const original = "# T\r\n\r\n- a\r\n- b\r\n";
    const { text, eol } = normalizeLineEndings(original);
    expect(applyLineEnding(save(load(text)), eol)).toBe(original);
  });
});

describe("clipboard", () => {
  it("parses pasted Markdown into rich content", () => {
    const slice = markdownToSlice(schema, "# Title\n\n- **item**");
    const types: string[] = [];
    slice.content.forEach((n) => types.push(n.type.name));
    expect(types).toEqual(["heading", "bulletList"]);
  });

  it("copies rich content as Markdown", () => {
    const { doc } = load("Some **bold** text\n\n- item\n");
    expect(fragmentToMarkdown(schema, doc.content)).toBe("Some **bold** text\n\n- item");
    expect(fragmentToMarkdown(schema, doc.child(0).content)).toBe("Some **bold** text");
  });
});
