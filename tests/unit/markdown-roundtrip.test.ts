import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { load, render, save } from "../helpers/schema";

const FIXTURES = join(__dirname, "..", "fixtures", "roundtrip");
const fixtures = readdirSync(FIXTURES).filter((f) => f.endsWith(".md"));

describe("markdown round trip", () => {
  it("has fixtures", () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(10);
  });

  describe.each(fixtures)("%s", (name) => {
    const source = readFileSync(join(FIXTURES, name), "utf8");

    it("saves an unedited document byte-for-byte", () => {
      expect(save(load(source))).toBe(source);
    });

    it("re-rendered Markdown parses back to the same document", () => {
      const first = load(source);
      const rendered = render(first.doc, first.style);
      const second = load(rendered);
      expect(second.doc.toJSON()).toEqual(first.doc.toJSON());
    });

    it("re-rendering is idempotent", () => {
      const first = load(source);
      const once = render(first.doc, first.style);
      const twice = render(load(once).doc, first.style);
      expect(twice).toBe(once);
    });
  });
});
