import { describe, expect, it } from "vitest";

import { resolveImageSrc } from "../../src/editor/extensions/documentContext";
import {
  basename,
  dirname,
  extname,
  isAbsolutePath,
  isMarkdownPath,
  joinPath,
  relativePath,
  samePath,
} from "../../src/utils/path";

describe("path utils", () => {
  it("splits windows and posix paths", () => {
    expect(basename("C:\\docs\\notes.md")).toBe("notes.md");
    expect(basename("/home/u/a.md")).toBe("a.md");
    expect(dirname("C:\\docs\\notes.md")).toBe("C:\\docs");
    expect(dirname("C:\\notes.md")).toBe("C:\\");
    expect(dirname("/home/u/a.md")).toBe("/home/u");
    expect(extname("x/Readme.MD")).toBe(".md");
  });

  it("joins relative paths", () => {
    expect(joinPath("C:\\docs\\sub", "../img/a.png")).toBe("C:\\docs\\img\\a.png");
    expect(joinPath("/home/u", "./img/a.png")).toBe("/home/u/img/a.png");
  });

  it("computes relative paths", () => {
    expect(relativePath("C:\\docs", "C:\\docs\\img\\a.png")).toBe("img/a.png");
    expect(relativePath("C:\\docs\\x", "c:\\docs\\img\\a.png")).toBe("../img/a.png");
    expect(relativePath("C:\\docs", "D:\\a.png")).toBeNull();
    expect(relativePath("/a/b", "/a/c/d.png")).toBe("../c/d.png");
  });

  it("recognizes absolute and markdown paths", () => {
    expect(isAbsolutePath("C:\\x")).toBe(true);
    expect(isAbsolutePath("/x")).toBe(true);
    expect(isAbsolutePath("x/y")).toBe(false);
    expect(isMarkdownPath("a.markdown")).toBe(true);
    expect(isMarkdownPath("a.exe")).toBe(false);
    expect(samePath("C:\\A\\b.md", "c:/a/B.md")).toBe(true);
  });
});

describe("image source resolution", () => {
  const ctx = { dir: "C:\\docs", toAssetUrl: (p: string) => `asset://${p}` };

  it("passes remote and data images through", () => {
    expect(resolveImageSrc("https://x.dev/a.png", ctx)).toBe("https://x.dev/a.png");
    expect(resolveImageSrc("data:image/png;base64,AAA", ctx)).toBe("data:image/png;base64,AAA");
  });

  it("resolves local paths against the document directory", () => {
    expect(resolveImageSrc("img/a%20b.png", ctx)).toBe("asset://C:\\docs\\img\\a b.png");
    expect(resolveImageSrc("D:\\pics\\x.png", ctx)).toBe("asset://D:\\pics\\x.png");
    expect(resolveImageSrc("file:///C:/pics/x.png", ctx)).toBe("asset://C:/pics/x.png");
  });

  it("blocks dangerous schemes", () => {
    expect(resolveImageSrc("javascript:alert(1)", ctx)).toBe("");
    expect(resolveImageSrc("vbscript:x", ctx)).toBe("");
  });

  it("cannot resolve relative paths for unsaved documents", () => {
    expect(resolveImageSrc("a.png", { dir: null, toAssetUrl: ctx.toAssetUrl })).toBe("");
  });
});

describe("text direction", () => {
  it("follows the first letter", async () => {
    const { textDirection } = await import("../../src/editor/extensions/textDirection");
    expect(textDirection("123 مرحبا hello")).toBe("rtl");
    expect(textDirection("- hello مرحبا")).toBe("ltr");
    expect(textDirection("שלום")).toBe("rtl");
    expect(textDirection("123 !")).toBeNull();
  });
});
