// Small path helpers that work with both Windows and POSIX style paths.

const SEP_RE = /[\\/]+/;

export function isWindowsPath(path: string): boolean {
  return /^[a-zA-Z]:[\\/]/.test(path) || path.startsWith("\\\\");
}

export function isAbsolutePath(path: string): boolean {
  return isWindowsPath(path) || path.startsWith("/");
}

function separatorFor(path: string): string {
  return isWindowsPath(path) || (path.includes("\\") && !path.includes("/")) ? "\\" : "/";
}

export function basename(path: string): string {
  const parts = path.split(SEP_RE).filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

export function dirname(path: string): string {
  const idx = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  if (idx < 0) return "";
  if (idx === 0) return path[0] ?? "";
  const dir = path.slice(0, idx);
  // Keep the root separator for "C:\" style roots.
  return /^[a-zA-Z]:$/.test(dir) ? dir + (path[idx] ?? "\\") : dir;
}

export function extname(path: string): string {
  const name = basename(path);
  const idx = name.lastIndexOf(".");
  return idx > 0 ? name.slice(idx).toLowerCase() : "";
}

export function stripExtension(name: string): string {
  const idx = name.lastIndexOf(".");
  return idx > 0 ? name.slice(0, idx) : name;
}

/** Joins `relative` onto `base`, resolving `.` and `..` segments. */
export function joinPath(base: string, relative: string): string {
  const sep = separatorFor(base);
  const baseParts = base.split(SEP_RE);
  const trailingEmpty = baseParts[baseParts.length - 1] === "";
  if (trailingEmpty) baseParts.pop();
  for (const part of relative.split(SEP_RE)) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      if (baseParts.length > 1) baseParts.pop();
    } else {
      baseParts.push(part);
    }
  }
  const joined = baseParts.join(sep);
  return base.startsWith("/") && !joined.startsWith("/") ? "/" + joined : joined;
}

/** Returns a `/`-separated path from directory `fromDir` to `to`, or null if on another drive. */
export function relativePath(fromDir: string, to: string): string | null {
  const windows = isWindowsPath(fromDir) || isWindowsPath(to);
  const norm = (p: string) => p.split(SEP_RE).filter(Boolean);
  const a = norm(fromDir);
  const b = norm(to);
  const eq = (x: string, y: string) => (windows ? x.toLowerCase() === y.toLowerCase() : x === y);
  if (windows && (!a[0] || !b[0] || !eq(a[0], b[0]))) return null;
  let i = 0;
  while (i < a.length && i < b.length && eq(a[i]!, b[i]!)) i++;
  const up = a.slice(i).map(() => "..");
  return [...up, ...b.slice(i)].join("/");
}

export function samePath(a: string, b: string): boolean {
  const norm = (p: string) => p.replace(/\\/g, "/");
  return isWindowsPath(a) || isWindowsPath(b)
    ? norm(a).toLowerCase() === norm(b).toLowerCase()
    : norm(a) === norm(b);
}

export const MARKDOWN_EXTENSIONS = ["md", "markdown", "mdown", "mkd", "mkdn", "mdwn", "txt"];
export const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "avif"];

export function isMarkdownPath(path: string): boolean {
  return MARKDOWN_EXTENSIONS.includes(extname(path).slice(1));
}

export function isImagePath(path: string): boolean {
  return IMAGE_EXTENSIONS.includes(extname(path).slice(1));
}
