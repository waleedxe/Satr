import { beforeEach, describe, expect, it } from "vitest";

import {
  DEFAULT_SETTINGS,
  MAX_RECENT_FILES,
  addRecentFile,
  clampFontSize,
  removeRecentFile,
  sanitizeSettings,
} from "../../src/features/settings/settings";
import { flushSettings, useSettings } from "../../src/stores/settingsStore";
import { setupApp } from "../helpers/app";

describe("settings validation", () => {
  it("returns defaults for garbage", () => {
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings("x")).toEqual(DEFAULT_SETTINGS);
  });

  it("keeps valid values and rejects invalid ones", () => {
    const s = sanitizeSettings({
      theme: "dark",
      fontSize: 99,
      contentWidth: "huge",
      autosave: "yes",
      recentFiles: ["a.md", 3, "b.md"],
    });
    expect(s.theme).toBe("dark");
    expect(s.fontSize).toBe(28);
    expect(s.contentWidth).toBe("medium");
    expect(s.autosave).toBe(false);
    expect(s.recentFiles).toEqual(["a.md", "b.md"]);
  });

  it("clamps font sizes", () => {
    expect(clampFontSize(2)).toBe(12);
    expect(clampFontSize(17.6)).toBe(18);
    expect(clampFontSize(Number.NaN)).toBe(16);
  });
});

describe("recent files", () => {
  it("moves re-opened files to the front without duplicates", () => {
    const list = addRecentFile(["C:\\a.md", "C:\\b.md"], "c:\\B.md");
    expect(list).toEqual(["c:\\B.md", "C:\\a.md"]);
  });

  it("caps the list", () => {
    let list: string[] = [];
    for (let i = 0; i < 20; i++) list = addRecentFile(list, `/f${i}.md`);
    expect(list).toHaveLength(MAX_RECENT_FILES);
    expect(list[0]).toBe("/f19.md");
  });

  it("removes entries", () => {
    expect(removeRecentFile(["/a.md", "/b.md"], "/a.md")).toEqual(["/b.md"]);
  });
});

describe("settings store", () => {
  beforeEach(() => {
    setupApp();
  });

  it("persists and reloads settings", async () => {
    useSettings.getState().update({ theme: "dark", fontSize: 20 });
    useSettings.getState().addRecent("/x.md");
    await flushSettings();
    useSettings.setState({ ...DEFAULT_SETTINGS });
    await useSettings.getState().load();
    const s = useSettings.getState();
    expect(s.theme).toBe("dark");
    expect(s.fontSize).toBe(20);
    expect(s.recentFiles).toEqual(["/x.md"]);
  });

  it("zooms within bounds and resets", () => {
    const { zoom } = useSettings.getState();
    for (let i = 0; i < 30; i++) zoom(1);
    expect(useSettings.getState().fontSize).toBe(28);
    zoom(0);
    expect(useSettings.getState().fontSize).toBe(16);
  });
});
