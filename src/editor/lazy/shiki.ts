// Shiki is loaded on demand with a fine-grained bundle: only the JS regex
// engine (no WASM, which the CSP would block), two themes, and languages
// fetched the first time a code block uses them.

import type { HighlighterCore, ThemedToken } from "shiki/core";

type LangLoader = () => Promise<unknown>;

const LANGUAGES: Record<string, LangLoader> = {
  bash: () => import("@shikijs/langs/shellscript"),
  c: () => import("@shikijs/langs/c"),
  cpp: () => import("@shikijs/langs/cpp"),
  csharp: () => import("@shikijs/langs/csharp"),
  css: () => import("@shikijs/langs/css"),
  diff: () => import("@shikijs/langs/diff"),
  dockerfile: () => import("@shikijs/langs/dockerfile"),
  go: () => import("@shikijs/langs/go"),
  graphql: () => import("@shikijs/langs/graphql"),
  html: () => import("@shikijs/langs/html"),
  ini: () => import("@shikijs/langs/ini"),
  java: () => import("@shikijs/langs/java"),
  javascript: () => import("@shikijs/langs/javascript"),
  json: () => import("@shikijs/langs/json"),
  jsonc: () => import("@shikijs/langs/jsonc"),
  jsx: () => import("@shikijs/langs/jsx"),
  kotlin: () => import("@shikijs/langs/kotlin"),
  latex: () => import("@shikijs/langs/latex"),
  lua: () => import("@shikijs/langs/lua"),
  markdown: () => import("@shikijs/langs/markdown"),
  php: () => import("@shikijs/langs/php"),
  powershell: () => import("@shikijs/langs/powershell"),
  python: () => import("@shikijs/langs/python"),
  r: () => import("@shikijs/langs/r"),
  ruby: () => import("@shikijs/langs/ruby"),
  rust: () => import("@shikijs/langs/rust"),
  scss: () => import("@shikijs/langs/scss"),
  sql: () => import("@shikijs/langs/sql"),
  swift: () => import("@shikijs/langs/swift"),
  toml: () => import("@shikijs/langs/toml"),
  tsx: () => import("@shikijs/langs/tsx"),
  typescript: () => import("@shikijs/langs/typescript"),
  xml: () => import("@shikijs/langs/xml"),
  yaml: () => import("@shikijs/langs/yaml"),
};

const ALIASES: Record<string, string> = {
  sh: "bash",
  shell: "bash",
  shellscript: "bash",
  zsh: "bash",
  console: "bash",
  "c++": "cpp",
  cs: "csharp",
  "c#": "csharp",
  golang: "go",
  htm: "html",
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  kt: "kotlin",
  tex: "latex",
  md: "markdown",
  ps: "powershell",
  ps1: "powershell",
  pwsh: "powershell",
  py: "python",
  rb: "ruby",
  rs: "rust",
  ts: "typescript",
  mts: "typescript",
  yml: "yaml",
  svg: "xml",
  docker: "dockerfile",
};

export const LIGHT_THEME = "github-light";
export const DARK_THEME = "github-dark";

/** Canonical Shiki language id for a fence info string, or null if unsupported. */
export function resolveLanguage(lang: string | null | undefined): string | null {
  if (!lang) return null;
  const key = lang.trim().toLowerCase();
  const id = ALIASES[key] ?? key;
  return id in LANGUAGES ? id : null;
}

let highlighter: HighlighterCore | null = null;
let highlighterPromise: Promise<HighlighterCore> | null = null;
const loaded = new Set<string>();
const loading = new Map<string, Promise<void>>();

export function getLoadedHighlighter(): HighlighterCore | null {
  return highlighter;
}

export function loadHighlighter(): Promise<HighlighterCore> {
  highlighterPromise ??= (async () => {
    const [{ createHighlighterCore }, { createJavaScriptRegexEngine }] = await Promise.all([
      import("shiki/core"),
      import("shiki/engine/javascript"),
    ]);
    const hl = await createHighlighterCore({
      themes: [import("@shikijs/themes/github-light"), import("@shikijs/themes/github-dark")],
      langs: [],
      engine: createJavaScriptRegexEngine({ forgiving: true }),
    });
    highlighter = hl;
    return hl;
  })();
  return highlighterPromise;
}

export function isLanguageLoaded(id: string): boolean {
  return loaded.has(id);
}

/** Loads a language grammar; resolves when it is ready to use. */
export function loadLanguage(id: string): Promise<void> {
  if (loaded.has(id)) return Promise.resolve();
  let pending = loading.get(id);
  if (!pending) {
    const loader = LANGUAGES[id];
    if (!loader) return Promise.resolve();
    pending = (async () => {
      const hl = await loadHighlighter();
      const mod = (await loader()) as { default: Parameters<HighlighterCore["loadLanguage"]>[0] };
      await hl.loadLanguage(mod.default);
      loaded.add(id);
    })().catch((error: unknown) => {
      console.warn(`Could not load highlighting for ${id}`, error);
    });
    loading.set(id, pending);
  }
  return pending;
}

export function tokenize(hl: HighlighterCore, code: string, lang: string): ThemedToken[][] {
  return hl.codeToTokens(code, {
    lang,
    themes: { light: LIGHT_THEME, dark: DARK_THEME },
    defaultColor: false,
  }).tokens;
}
