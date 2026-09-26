import { beforeEach, describe, expect, it } from "vitest";

import {
  closeAllDocuments,
  closeDocument,
  handleDroppedPaths,
  handleExternalChange,
  imageReference,
  keepMyVersion,
  newDocument,
  openDocumentsDialog,
  openLink,
  openPath,
  reloadDocument,
  saveDocument,
  saveDocumentAs,
  switchMode,
} from "../../src/features/files/fileActions";
import { installNativeListeners } from "../../src/features/files/nativeEvents";
import type { MemoryBridge } from "../../src/native/memoryBridge";
import { getTab, useDocuments } from "../../src/stores/documentsStore";
import { useSettings } from "../../src/stores/settingsStore";
import { useUi } from "../../src/stores/uiStore";
import { answerDialog, flush, mountFakeEditor, setupApp } from "../helpers/app";

const DOC = "C:\\docs\\notes.md";

let bridge: MemoryBridge;

beforeEach(async () => {
  bridge = setupApp();
  await installNativeListeners();
  bridge.files.set(DOC, { content: "# Notes\r\n\r\nHello\r\n", mtime: 10, hasBom: false });
});

describe("open", () => {
  it("opens a file into a new tab with normalized line endings", async () => {
    const id = await openPath(DOC);
    const tab = getTab(id!)!;
    expect(tab.title).toBe("notes.md");
    expect(tab.content).toBe("# Notes\n\nHello\n");
    expect(tab.eol).toBe("\r\n");
    expect(tab.dirty).toBe(false);
    expect(useDocuments.getState().activeId).toBe(id);
    expect(bridge.watched.has(DOC)).toBe(true);
  });

  it("records the file in recent files", async () => {
    await openPath(DOC);
    expect(useSettings.getState().recentFiles).toEqual([DOC]);
  });

  it("does not open the same file twice", async () => {
    const first = await openPath(DOC);
    newDocument();
    const second = await openPath("c:/docs/NOTES.md");
    expect(second).toBe(first);
    expect(useDocuments.getState().tabs).toHaveLength(2);
    expect(useDocuments.getState().activeId).toBe(first);
  });

  it("reports missing files and drops them from recent files", async () => {
    useSettings.getState().addRecent("C:\\gone.md");
    const id = await openPath("C:\\gone.md");
    expect(id).toBeNull();
    expect(useSettings.getState().recentFiles).toEqual([]);
    expect(useUi.getState().toasts[0]?.kind).toBe("error");
  });

  it("replaces a pristine untitled tab", async () => {
    newDocument();
    await openPath(DOC);
    const tabs = useDocuments.getState().tabs;
    expect(tabs).toHaveLength(1);
    expect(tabs[0]!.path).toBe(DOC);
  });

  it("opens several files from the dialog", async () => {
    bridge.files.set("C:\\docs\\b.md", { content: "b", mtime: 1, hasBom: false });
    bridge.openDialogResults.push([DOC, "C:\\docs\\b.md"]);
    await openDocumentsDialog();
    expect(useDocuments.getState().tabs.map((t) => t.title)).toEqual(["notes.md", "b.md"]);
  });
});

describe("save", () => {
  it("writes edits back with the original line endings", async () => {
    const id = (await openPath(DOC))!;
    const editor = mountFakeEditor(id);
    editor.type("# Notes\n\nHello world\n");
    expect(getTab(id)!.dirty).toBe(true);

    expect(await saveDocument(id)).toBe(true);
    expect(bridge.files.get(DOC)!.content).toBe("# Notes\r\n\r\nHello world\r\n");
    const tab = getTab(id)!;
    expect(tab.dirty).toBe(false);
    expect(tab.savedMtime).toBe(bridge.files.get(DOC)!.mtime);
  });

  it("keeps a UTF-8 BOM", async () => {
    bridge.files.set(DOC, { content: "x\n", mtime: 1, hasBom: true });
    const id = (await openPath(DOC))!;
    mountFakeEditor(id).type("y\n");
    await saveDocument(id);
    expect(bridge.files.get(DOC)).toMatchObject({ content: "y\n", hasBom: true });
  });

  it("asks for a path when saving an untitled document", async () => {
    const id = newDocument();
    mountFakeEditor(id).type("# Draft\n");
    bridge.saveDialogResults.push("C:\\docs\\draft");
    expect(await saveDocument(id)).toBe(true);
    const tab = getTab(id)!;
    expect(tab.path).toBe("C:\\docs\\draft.md");
    expect(tab.title).toBe("draft.md");
    expect(bridge.files.get("C:\\docs\\draft.md")!.content).toBe("# Draft\n");
    expect(bridge.watched.has("C:\\docs\\draft.md")).toBe(true);
  });

  it("leaves the document untouched when Save As is cancelled", async () => {
    const id = newDocument();
    mountFakeEditor(id).type("text");
    bridge.saveDialogResults.push(null);
    expect(await saveDocument(id)).toBe(false);
    expect(getTab(id)!.path).toBeNull();
    expect(getTab(id)!.dirty).toBe(true);
  });

  it("Save As moves the document to a new path", async () => {
    const id = (await openPath(DOC))!;
    const editor = mountFakeEditor(id);
    bridge.saveDialogResults.push("C:\\docs\\copy.md");
    expect(await saveDocumentAs(id)).toBe(true);
    expect(getTab(id)!.path).toBe("C:\\docs\\copy.md");
    expect(bridge.files.get("C:\\docs\\copy.md")!.content).toBe("# Notes\r\n\r\nHello\r\n");
    expect(bridge.watched.has(DOC)).toBe(false);
    expect(bridge.watched.has("C:\\docs\\copy.md")).toBe(true);
    expect(editor.handle.setDocumentDir).toHaveBeenCalledWith("C:\\docs");
    expect(useSettings.getState().recentFiles[0]).toBe("C:\\docs\\copy.md");
  });

  it("reports write failures and stays dirty", async () => {
    const id = (await openPath(DOC))!;
    mountFakeEditor(id).type("changed");
    bridge.writeDocument = async () => {
      throw { kind: "permissionDenied", message: "denied" };
    };
    expect(await saveDocument(id)).toBe(false);
    expect(getTab(id)!.dirty).toBe(true);
    expect(useUi.getState().toasts.at(-1)?.message).toMatch(/Permission denied/);
  });
});

describe("unsaved changes", () => {
  it("closes clean tabs without asking", async () => {
    const id = (await openPath(DOC))!;
    expect(await closeDocument(id)).toBe(true);
    expect(useDocuments.getState().tabs).toHaveLength(0);
    expect(bridge.watched.has(DOC)).toBe(false);
  });

  it("keeps the tab when the user cancels", async () => {
    const id = (await openPath(DOC))!;
    mountFakeEditor(id).type("changed");
    const closing = closeDocument(id);
    await answerDialog("cancel");
    expect(await closing).toBe(false);
    expect(getTab(id)).toBeDefined();
  });

  it("discards changes when asked", async () => {
    const id = (await openPath(DOC))!;
    mountFakeEditor(id).type("changed");
    const closing = closeDocument(id);
    await answerDialog("discard");
    expect(await closing).toBe(true);
    expect(bridge.files.get(DOC)!.content).toBe("# Notes\r\n\r\nHello\r\n");
  });

  it("saves before closing when asked", async () => {
    const id = (await openPath(DOC))!;
    mountFakeEditor(id).type("changed\n");
    const closing = closeDocument(id);
    await answerDialog("save");
    expect(await closing).toBe(true);
    expect(bridge.files.get(DOC)!.content).toBe("changed\r\n");
  });

  it("window close stops at the first cancelled document", async () => {
    const a = (await openPath(DOC))!;
    mountFakeEditor(a).type("changed");
    const b = newDocument();
    mountFakeEditor(b).type("draft");
    const closing = closeAllDocuments();
    await answerDialog("discard");
    await answerDialog("cancel");
    expect(await closing).toBe(false);
    expect(useDocuments.getState().tabs.map((t) => t.id)).toEqual([b]);
  });

  it("the window close handler blocks closing while documents are unsaved", async () => {
    const id = (await openPath(DOC))!;
    mountFakeEditor(id).type("changed");
    const request = bridge.requestClose();
    await answerDialog("cancel");
    expect(await request).toBe(false);
    expect(bridge.closed).toBe(false);
  });
});

describe("external changes", () => {
  it("reloads a clean document silently", async () => {
    const id = (await openPath(DOC))!;
    bridge.externalWrite(DOC, "# Changed elsewhere\n");
    await flush();
    const tab = getTab(id)!;
    expect(tab.content).toBe("# Changed elsewhere\n");
    expect(tab.revision).toBe(1);
    expect(tab.dirty).toBe(false);
  });

  it("asks before replacing unsaved edits", async () => {
    const id = (await openPath(DOC))!;
    mountFakeEditor(id).type("mine");
    bridge.externalWrite(DOC, "theirs");
    await flush();
    expect(getTab(id)!.external).toBe("modified");
    expect(getTab(id)!.content).toBe("# Notes\n\nHello\n");

    await reloadDocument(id);
    expect(getTab(id)).toMatchObject({ content: "theirs", external: null, dirty: false });
  });

  it("can keep the local version", async () => {
    const id = (await openPath(DOC))!;
    mountFakeEditor(id).type("mine");
    bridge.externalWrite(DOC, "theirs");
    await flush();
    await keepMyVersion(id);
    expect(getTab(id)).toMatchObject({ external: null, dirty: true });
    await saveDocument(id);
    expect(bridge.files.get(DOC)!.content).toBe("mine");
  });

  it("ignores notifications caused by our own saves", async () => {
    const id = (await openPath(DOC))!;
    mountFakeEditor(id).type("edited\n");
    await saveDocument(id);
    await handleExternalChange(DOC);
    expect(getTab(id)!.external).toBeNull();
    expect(getTab(id)!.revision).toBe(0);
  });

  it("flags deleted files and keeps the content", async () => {
    const id = (await openPath(DOC))!;
    bridge.externalDelete(DOC);
    await flush();
    expect(getTab(id)).toMatchObject({ external: "deleted", dirty: true });
    // Saving recreates the file.
    await saveDocument(id);
    expect(bridge.files.has(DOC)).toBe(true);
    expect(getTab(id)!.external).toBeNull();
  });
});

describe("modes, drops and links", () => {
  it("carries edits across a mode switch", async () => {
    const id = (await openPath(DOC))!;
    mountFakeEditor(id).type("edited\n");
    switchMode(id);
    expect(getTab(id)).toMatchObject({
      mode: "source",
      content: "edited\n",
      revision: 1,
      dirty: true,
    });
  });

  it("opens dropped Markdown files", async () => {
    bridge.files.set("C:\\docs\\dropped.md", { content: "d", mtime: 1, hasBom: false });
    await handleDroppedPaths(["C:\\docs\\dropped.md", "C:\\x.exe"]);
    expect(useDocuments.getState().tabs.map((t) => t.title)).toEqual(["dropped.md"]);
    expect(useUi.getState().toasts.at(-1)?.message).toMatch(/Only Markdown/);
  });

  it("writes image references relative to the document", () => {
    expect(imageReference("C:\\docs\\a.md", "C:\\docs\\img\\p.png")).toBe("img/p.png");
    expect(imageReference("C:\\docs\\a.md", "D:\\p.png")).toBe("D:/p.png");
    expect(imageReference(null, "C:\\p q.png")).toBe("C:/p q.png");
  });

  it("opens web links externally and Markdown links in the app", async () => {
    bridge.files.set("C:\\docs\\other.md", { content: "o", mtime: 1, hasBom: false });
    await openLink("https://example.com", DOC);
    expect(bridge.openedUrls).toEqual(["https://example.com"]);
    await openLink("other.md#section", DOC);
    expect(useDocuments.getState().tabs.some((t) => t.title === "other.md")).toBe(true);
    await openLink("javascript:alert(1)", DOC);
    expect(bridge.openedUrls).toHaveLength(1);
  });
});
