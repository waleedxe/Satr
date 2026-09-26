import { Extension } from "@tiptap/core";

import { isAbsolutePath, joinPath } from "../../utils/path";

export interface DocumentContextStorage {
  /** Directory of the open file, used to resolve relative image paths. */
  dir: string | null;
  /** Turns an absolute local path into a URL the webview can load. */
  toAssetUrl: ((path: string) => string) | null;
}

declare module "@tiptap/core" {
  interface Storage {
    documentContext: DocumentContextStorage;
  }
}

export const DocumentContext = Extension.create<object, DocumentContextStorage>({
  name: "documentContext",
  addStorage() {
    return { dir: null, toAssetUrl: null };
  },
});

const SAFE_REMOTE = /^(https?:|data:image\/|blob:)/i;
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/**
 * Maps a Markdown image `src` to something the webview may display.
 * Remote http(s)/data images pass through; local paths go through the asset
 * protocol; anything else (javascript:, file: to odd places) is dropped.
 */
export function resolveImageSrc(src: string, ctx: DocumentContextStorage | undefined): string {
  const trimmed = src.trim();
  if (!trimmed) return "";
  if (SAFE_REMOTE.test(trimmed)) return trimmed;

  let path = trimmed;
  if (/^file:\/\//i.test(path)) {
    path = path.replace(/^file:\/\/\/?/i, "");
    if (!/^[a-zA-Z]:/.test(path)) path = "/" + path;
  } else if (HAS_SCHEME.test(path) && !/^[a-zA-Z]:[\\/]/.test(path)) {
    return "";
  }
  try {
    path = decodeURI(path);
  } catch {
    // keep undecoded
  }
  if (!ctx?.toAssetUrl) return "";
  if (!isAbsolutePath(path)) {
    if (!ctx.dir) return "";
    path = joinPath(ctx.dir, path);
  }
  return ctx.toAssetUrl(path);
}
