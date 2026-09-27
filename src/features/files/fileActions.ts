import { applyLineEnding, normalizeLineEndings } from "../../editor/markdown";
import { t } from "../../i18n";
import { NativeError, bridge } from "../../native";
import { createTabId, getTab, useDocuments } from "../../stores/documentsStore";
import type { DocumentTab, EditorMode } from "../../stores/documentsStore";
import { useSettings } from "../../stores/settingsStore";
import { confirmUnsaved, useUi } from "../../stores/uiStore";
import {
  basename,
  dirname,
  isAbsolutePath,
  isImagePath,
  isMarkdownPath,
  joinPath,
  relativePath,
  samePath,
  stripExtension,
} from "../../utils/path";
import { editorRegistry } from "./editorRegistry";

function markdownFilters() {
  return [
    { name: t("files.markdown"), extensions: ["md", "markdown", "mdown", "mkd", "mkdn"] },
    { name: t("files.text"), extensions: ["txt"] },
  ];
}

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "avif"];

function toast(message: string, kind: "info" | "success" | "error" = "info") {
  useUi.getState().toast(message, kind);
}

function describeError(error: unknown): string {
  const e = NativeError.from(error);
  switch (e.kind) {
    case "notFound":
      return t("error.notFound");
    case "permissionDenied":
      return t("error.permission");
    case "invalidEncoding":
      return t("error.encoding");
    case "tooLarge":
      return t("error.tooLarge");
    case "unsupportedType":
      return t("error.unsupported");
    default:
      return e.message;
  }
}

/** Current Markdown of a tab: from its editor if mounted, otherwise its stored content. */
export function currentMarkdown(tabId: string): string {
  const handle = editorRegistry.get(tabId);
  return handle ? handle.getMarkdown() : (getTab(tabId)?.content ?? "");
}

function findTabByPath(path: string): DocumentTab | undefined {
  return useDocuments.getState().tabs.find((t) => t.path && samePath(t.path, path));
}

async function startTracking(path: string): Promise<void> {
  const native = bridge();
  await Promise.all([
    native.watchDocument(path).catch((e: unknown) => console.warn("watch failed", e)),
    native.allowDocumentDirectory(path).catch((e: unknown) => console.warn("asset scope", e)),
  ]);
}

async function stopTracking(path: string | null): Promise<void> {
  if (!path) return;
  const stillOpen = useDocuments.getState().tabs.some((t) => t.path && samePath(t.path, path));
  if (!stillOpen)
    await bridge()
      .unwatchDocument(path)
      .catch(() => undefined);
}

/* ------------------------------------------------------------------ */
/* New / open                                                           */
/* ------------------------------------------------------------------ */

export function newDocument(): string {
  const docs = useDocuments.getState();
  const tab: DocumentTab = {
    id: createTabId(),
    path: null,
    title: docs.nextUntitledTitle(),
    dirty: false,
    mode: "wysiwyg",
    eol: "\n",
    hasBom: false,
    savedMtime: null,
    external: null,
    content: "",
    revision: 0,
  };
  editorRegistry.setSaved(tab.id, "");
  docs.addTab(tab);
  return tab.id;
}

/** A pristine untitled tab that opening a file may replace. */
function replaceableTab(): DocumentTab | undefined {
  const { tabs, activeId } = useDocuments.getState();
  const tab = tabs.find((t) => t.id === activeId);
  if (!tab || tab.path || tab.dirty || tabs.length !== 1) return undefined;
  return currentMarkdown(tab.id).trim() === "" ? tab : undefined;
}

export async function openPath(path: string): Promise<string | null> {
  const existing = findTabByPath(path);
  if (existing) {
    useDocuments.getState().setActive(existing.id);
    return existing.id;
  }
  const settings = useSettings.getState();
  let file;
  try {
    file = await bridge().readDocument(path);
  } catch (error) {
    const e = NativeError.from(error);
    if (e.kind === "notFound") settings.removeRecent(path);
    toast(t("toast.openFailed", { name: basename(path), reason: describeError(error) }), "error");
    return null;
  }
  // The same file may have been opened while we were reading it.
  const raced = findTabByPath(path);
  if (raced) {
    useDocuments.getState().setActive(raced.id);
    return raced.id;
  }

  const { text, eol } = normalizeLineEndings(file.content);
  const replace = replaceableTab();
  const tab: DocumentTab = {
    id: createTabId(),
    path,
    title: basename(path),
    dirty: false,
    mode: "wysiwyg",
    eol,
    hasBom: file.hasBom,
    savedMtime: file.modifiedMs,
    external: null,
    content: text,
    revision: 0,
  };
  editorRegistry.setSaved(tab.id, text);
  const docs = useDocuments.getState();
  docs.addTab(tab);
  if (replace) {
    docs.removeTab(replace.id);
    editorRegistry.forget(replace.id);
    docs.setActive(tab.id);
  }
  settings.addRecent(path);
  await startTracking(path);
  return tab.id;
}

export async function openDocumentsDialog(): Promise<void> {
  const active = useDocuments
    .getState()
    .tabs.find((t) => t.id === useDocuments.getState().activeId);
  const paths = await bridge().showOpenDialog({
    title: t("files.openTitle"),
    multiple: true,
    filters: markdownFilters(),
    defaultPath: active?.path ? dirname(active.path) : undefined,
  });
  if (!paths) return;
  for (const path of paths) await openPath(path);
}

export async function openFolderDialog(): Promise<void> {
  const paths = await bridge().showOpenDialog({
    title: t("files.openFolderTitle"),
    directory: true,
  });
  const folder = paths?.[0];
  if (!folder) return;
  useSettings.getState().update({
    workspaceFolder: folder,
    sidebarVisible: true,
    sidebarPanel: "files",
  });
}

/* ------------------------------------------------------------------ */
/* Save                                                                 */
/* ------------------------------------------------------------------ */

const saving = new Map<string, Promise<boolean>>();

async function writeTab(tabId: string, path: string): Promise<boolean> {
  const tab = getTab(tabId);
  if (!tab) return false;
  const handle = editorRegistry.get(tabId);
  const markdown = currentMarkdown(tabId);
  const output = applyLineEnding(markdown, tab.eol);
  let mtime: number;
  try {
    mtime = await bridge().writeDocument(path, output, tab.hasBom);
  } catch (error) {
    toast(t("toast.saveFailed", { name: basename(path), reason: describeError(error) }), "error");
    return false;
  }

  const oldPath = tab.path;
  handle?.markSaved(markdown);
  editorRegistry.setSaved(tabId, markdown);
  // Edits typed while the write was in flight keep the tab dirty.
  const stillSame = handle ? handle.getMarkdown() === markdown : true;
  useDocuments.getState().updateTab(tabId, {
    path,
    title: basename(path),
    savedMtime: mtime,
    external: null,
    dirty: !stillSame,
    ...(handle ? {} : { content: markdown }),
  });
  useSettings.getState().addRecent(path);
  if (!oldPath || !samePath(oldPath, path)) {
    await startTracking(path);
    await stopTracking(oldPath);
    handle?.setDocumentDir(dirname(path));
  }
  return true;
}

export function saveDocument(tabId: string): Promise<boolean> {
  const pending = saving.get(tabId);
  if (pending) return pending;
  const run = (async () => {
    const tab = getTab(tabId);
    if (!tab) return false;
    if (!tab.path) return saveDocumentAsInner(tabId);
    return writeTab(tabId, tab.path);
  })().finally(() => saving.delete(tabId));
  saving.set(tabId, run);
  return run;
}

async function saveDocumentAsInner(tabId: string): Promise<boolean> {
  const tab = getTab(tabId);
  if (!tab) return false;
  const suggested = tab.path ?? `${stripExtension(tab.title)}.md`;
  const path = await bridge().showSaveDialog({
    title: t("files.saveAsTitle"),
    defaultPath: suggested,
    filters: markdownFilters(),
  });
  if (!path) return false;
  const finalPath = isMarkdownPath(path) ? path : `${path}.md`;
  const other = findTabByPath(finalPath);
  if (other && other.id !== tabId) {
    toast(t("toast.alreadyOpen", { name: basename(finalPath) }), "error");
    return false;
  }
  return writeTab(tabId, finalPath);
}

export function saveDocumentAs(tabId: string): Promise<boolean> {
  return saveDocumentAsInner(tabId);
}

export async function saveAll(): Promise<boolean> {
  for (const tab of useDocuments.getState().tabs) {
    if (tab.dirty && !(await saveDocument(tab.id))) return false;
  }
  return true;
}

/* ------------------------------------------------------------------ */
/* Close                                                                */
/* ------------------------------------------------------------------ */

/** Closes a tab, asking about unsaved changes. Resolves false if cancelled. */
export async function closeDocument(tabId: string): Promise<boolean> {
  const tab = getTab(tabId);
  if (!tab) return true;
  if (tab.dirty) {
    useDocuments.getState().setActive(tabId);
    const choice = await confirmUnsaved(tab.title);
    if (choice === "cancel") return false;
    if (choice === "save" && !(await saveDocument(tabId))) return false;
  }
  const path = getTab(tabId)?.path ?? null;
  useDocuments.getState().removeTab(tabId);
  editorRegistry.forget(tabId);
  await stopTracking(path);
  return true;
}

/** Used when the window closes: asks about every unsaved document. */
export async function closeAllDocuments(): Promise<boolean> {
  for (const tab of [...useDocuments.getState().tabs]) {
    if (!(await closeDocument(tab.id))) return false;
  }
  return true;
}

/* ------------------------------------------------------------------ */
/* Modes and reloads                                                    */
/* ------------------------------------------------------------------ */

export function switchMode(tabId: string, mode?: EditorMode): void {
  const tab = getTab(tabId);
  if (!tab) return;
  const next = mode ?? (tab.mode === "wysiwyg" ? "source" : "wysiwyg");
  if (next === tab.mode) return;
  const content = currentMarkdown(tabId);
  useDocuments.getState().updateTab(tabId, {
    mode: next,
    content,
    revision: tab.revision + 1,
  });
}

/** Replaces the tab's content with what is on disk. */
export async function reloadDocument(tabId: string): Promise<boolean> {
  const tab = getTab(tabId);
  if (!tab?.path) return false;
  try {
    const file = await bridge().readDocument(tab.path);
    const { text, eol } = normalizeLineEndings(file.content);
    editorRegistry.setSaved(tabId, text);
    useDocuments.getState().updateTab(tabId, {
      content: text,
      eol,
      hasBom: file.hasBom,
      savedMtime: file.modifiedMs,
      dirty: false,
      external: null,
      revision: tab.revision + 1,
    });
    return true;
  } catch (error) {
    toast(t("toast.reloadFailed", { name: tab.title, reason: describeError(error) }), "error");
    return false;
  }
}

/** Keeps the in-editor version after an external change; the next save overwrites. */
export async function keepMyVersion(tabId: string): Promise<void> {
  const tab = getTab(tabId);
  if (!tab?.path) return;
  const mtime = await bridge()
    .statDocument(tab.path)
    .catch(() => null);
  useDocuments.getState().updateTab(tabId, {
    external: null,
    dirty: true,
    savedMtime: mtime ?? tab.savedMtime,
  });
}

const checking = new Set<string>();

/** Reacts to a change notification (or focus check) for a file on disk. */
export async function handleExternalChange(path: string): Promise<void> {
  const tab = findTabByPath(path);
  if (!tab?.path || checking.has(tab.id) || saving.has(tab.id)) return;
  checking.add(tab.id);
  try {
    const mtime = await bridge()
      .statDocument(tab.path)
      .catch(() => undefined);
    if (mtime === undefined) return;
    const current = getTab(tab.id);
    if (!current) return;
    if (mtime === null) {
      if (current.external !== "deleted") {
        useDocuments.getState().updateTab(tab.id, { external: "deleted", dirty: true });
      }
      return;
    }
    if (mtime === current.savedMtime) {
      if (current.external === "deleted") {
        useDocuments.getState().updateTab(tab.id, { external: null });
      }
      return;
    }
    if (!current.dirty) {
      if (await reloadDocument(tab.id)) toast(t("toast.reloaded", { name: current.title }));
    } else if (current.external !== "modified") {
      useDocuments.getState().updateTab(tab.id, { external: "modified" });
    }
  } finally {
    checking.delete(tab.id);
  }
}

export async function checkOpenDocuments(): Promise<void> {
  const paths = useDocuments
    .getState()
    .tabs.map((t) => t.path)
    .filter((p): p is string => p !== null);
  await Promise.all(paths.map((p) => handleExternalChange(p)));
}

/* ------------------------------------------------------------------ */
/* Drag and drop, links and images                                      */
/* ------------------------------------------------------------------ */

export async function handleDroppedPaths(paths: string[]): Promise<void> {
  const images = paths.filter(isImagePath);
  const docs = paths.filter(isMarkdownPath);
  for (const path of docs) await openPath(path);
  if (images.length && docs.length === 0) {
    const tab = useDocuments.getState().tabs.find((t) => t.id === useDocuments.getState().activeId);
    const editor = tab ? editorRegistry.get(tab.id)?.editor : null;
    if (!tab || !editor) {
      toast(t("toast.imagesNeedEditor"));
      return;
    }
    for (const image of images) {
      editor
        .chain()
        .focus()
        .insertContent({
          type: "image",
          attrs: { src: imageReference(tab.path, image), alt: stripExtension(basename(image)) },
        })
        .run();
    }
  }
  const ignored = paths.length - images.length - docs.length;
  if (ignored > 0) toast(t("toast.onlyMarkdownAndImages"));
}

/** Path to write into Markdown for an image: relative to the document when possible. */
export function imageReference(docPath: string | null, imagePath: string): string {
  if (docPath) {
    const rel = relativePath(dirname(docPath), imagePath);
    if (rel !== null) return rel;
  }
  return imagePath.replace(/\\/g, "/");
}

export async function browseForImage(docPath: string | null): Promise<string | null> {
  const paths = await bridge().showOpenDialog({
    title: t("files.insertImageTitle"),
    filters: [{ name: t("files.images"), extensions: IMAGE_EXTENSIONS }],
    defaultPath: docPath ? dirname(docPath) : undefined,
  });
  const image = paths?.[0];
  return image ? imageReference(docPath, image) : null;
}

/** Opens a link from the document: web links in the browser, Markdown files in a tab. */
export async function openLink(href: string, docPath: string | null): Promise<void> {
  const url = href.trim();
  if (/^(https?:|mailto:)/i.test(url)) {
    await bridge().openExternal(url);
    return;
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(url) && !/^[a-zA-Z]:[\\/]/.test(url)) {
    toast(t("toast.linkType"));
    return;
  }
  const target = decodeURI(url.split("#")[0] ?? "");
  if (!target) return;
  if (!isMarkdownPath(target)) {
    toast(t("toast.linkOnlyMarkdown"));
    return;
  }
  if (!isAbsolutePath(target) && !docPath) {
    toast(t("toast.saveFirstForLinks"));
    return;
  }
  const full = isAbsolutePath(target) ? target : joinPath(dirname(docPath!), target);
  await openPath(full);
}
