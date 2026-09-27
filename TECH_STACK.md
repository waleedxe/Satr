# Tech Stack — Satr (سطر)

Satr is a desktop Markdown editor: a small native shell written in **Rust (Tauri 2)** hosts a **React + TypeScript** interface rendered by the operating system's own web engine (**WebView2** on Windows). No bundled browser, no server, no network access at runtime.

Versions below are the ones locked in `package-lock.json` and `src-tauri/Cargo.lock` as of 2026-09-27.

## Architecture at a glance

```text
┌──────────────────────────── Satr window ─────────────────────────────┐
│  React UI  (menus, tabs, sidebar, dialogs, settings)                  │
│     │                                                                 │
│     ├── Visual editor ── TipTap / ProseMirror ── Shiki · KaTeX       │
│     ├── Source editor ── CodeMirror 6                                 │
│     └── Markdown engine ─ unified / remark (parse ⇄ serialize)        │
│                  │                                                    │
│          src/native  (typed bridge, the only code that calls Tauri)   │
└──────────────────┼────────────────────────────────────────────────────┘
                   │ Tauri IPC (commands + events)
┌──────────────────┴────────────────────────────────────────────────────┐
│  Rust core: file read/atomic write, path validation, file watcher,    │
│  system font list · plugins: dialog, store, opener                    │
└───────────────────────────────────────────────────────────────────────┘
```

## Desktop shell (Rust)

| Technology | Version | Used for |
|---|---|---|
| [Tauri](https://tauri.app) | 2.12 | Native window, IPC, bundling, installers, security capabilities |
| Rust | 1.98 (stable) | Native code: file system, watcher, fonts |
| WebView2 (Microsoft Edge) | system | Renders the UI on Windows (already part of Windows 10/11/Server) |
| `tauri-plugin-dialog` | 2.7 | Open / Save As / folder dialogs |
| `tauri-plugin-store` | 2.4 | Settings and recent files (`settings.json` in app data) |
| `tauri-plugin-opener` | 2.5 | Opening web links in the default browser |
| `notify` | 8.2 | Watching open files for changes made by other programs |
| `fontdb` | 0.24 | Listing fonts installed on the computer |
| `serde` / `serde_json` | 1.0 | Data passed to and from the UI |
| `thiserror` | 2.0 | Typed errors returned to the UI as `{ kind, message }` |
| `tempfile` (tests only) | 3.27 | Temporary folders in Rust tests |

Rust modules: `commands.rs` (IPC commands), `filesystem.rs` (validation, BOM-aware reads, atomic writes), `watcher.rs`, `fonts.rs`, `errors.rs`.

## Frontend

| Technology | Version | Used for |
|---|---|---|
| React | 19.3 | UI components |
| TypeScript | 6.0 (strict) | All frontend code |
| Vite | 8.3 | Dev server and production bundling (code splitting for lazy features) |
| Zustand | 5.0 | State: documents/tabs, settings, UI, editor status |
| Plain CSS + design tokens | — | Styling (`src/styles`); light/dark themes via CSS variables, logical properties for right-to-left |

Tailwind was considered and not used: the editor's typography is custom CSS anyway, and plain tokens keep the dependency list short.

## Editing

| Technology | Version | Used for |
|---|---|---|
| [TipTap](https://tiptap.dev) (core, starter-kit, table, list, image, link, code, code-block, strike, extensions) | 3.31 | Visual (WYSIWYG) editor built on ProseMirror |
| ProseMirror (via `@tiptap/pm`) | — | Document model, transactions, decorations, tables |
| [CodeMirror 6](https://codemirror.net) (state, view, commands, language, search, lang-markdown) | 6.x | Raw Markdown source mode (loaded only when opened) |
| `@lezer/highlight` | 1.2 | Syntax colors in source mode |

Custom editor extensions (`src/editor/extensions`): math nodes, raw Markdown/HTML blocks, images with local-path resolution, code block language picker, Shiki highlighting, find/replace, focus and typewriter modes, per-block text direction for Arabic.

## Markdown engine

| Technology | Version | Used for |
|---|---|---|
| [unified](https://unifiedjs.com) | 11.0 | Processing pipeline |
| `remark-parse` / `remark-stringify` | 11.0 | Markdown ⇄ syntax tree (mdast) |
| `remark-gfm` | 4.0 | Tables, task lists, strikethrough, autolinks |
| `remark-math` | 6.0 | `$inline$` and `$$block$$` math |
| `remark-frontmatter` | 5.0 | YAML front matter |

Satr's own layer (`src/editor/markdown`) converts between mdast and the editor document and keeps a **source map**: blocks you did not edit are written back byte-for-byte; edited blocks use the file's detected style. Unsupported syntax is kept as raw Markdown. Files larger than 64 KB are parsed in a Web Worker.

## Rendering extras (loaded on demand)

| Technology | Version | Used for |
|---|---|---|
| [Shiki](https://shiki.style) (+ `@shikijs/langs`, `@shikijs/themes`) | 4.4 | Code highlighting for 35+ languages, JavaScript regex engine (no WASM) |
| [KaTeX](https://katex.org) | 0.18 | Math rendering, `trust: false` |
| Fontsource: IBM Plex Sans Arabic, Cairo, Tajawal, Noto Naskh Arabic, Amiri | 5.3 | Bundled fonts, loaded only when selected |

## Internationalization

A small built-in i18n layer (`src/i18n`), no library: typed dictionaries for **English** (default) and **Arabic**. TypeScript and tests ensure every string exists in every language. Arabic switches the whole layout to right-to-left.

## Testing and quality

| Tool | Version | Used for |
|---|---|---|
| Vitest | 4.1 | Unit and integration tests (112 tests: Markdown round trips, file workflow, settings, i18n, fonts) |
| `cargo test` | — | Rust tests (15: file access, watcher, errors, fonts) |
| playwright-core | 1.63 | End-to-end smoke test driving the real app over WebView2 DevTools (19 checks) and screenshots |
| ESLint + typescript-eslint + react-hooks | 9.39 / 8.70 / 7.1 | Linting |
| Prettier | 3.9 | Formatting |
| rustfmt + clippy | — | Rust formatting and lints (warnings are errors) |

`npm run check` runs formatting, lint, typecheck, tests, rustfmt, clippy and Rust tests.

## Build, packaging and CI

| Tool | Used for |
|---|---|
| Tauri bundler (NSIS) | `Satr_<version>_x64-setup.exe`, per-user installer |
| Tauri bundler (WiX 3) | `Satr_<version>_x64_en-US.msi` |
| GitHub Actions | `ci.yml`: all checks on push/PR (Windows runner) · `release.yml`: installers attached to a draft release on `v*` tags |

## Security model

- Strict Content-Security-Policy; no remote scripts, no `eval`, no WASM.
- Tauri capabilities grant only the permissions the app uses.
- Every path from the UI is validated in Rust (absolute paths, Markdown/text extensions only).
- The webview may only load local images from folders of documents the user opened.
- Markdown is untrusted: raw HTML is shown as text, never executed; KaTeX runs with `trust: false`; link schemes are filtered.
- No telemetry and no network requests from the app itself.

## Measured footprint (release build, Windows Server 2022)

| Metric | Value |
|---|---|
| Installer | 4.6 MB |
| Installed executable | 8 MB |
| Window visible | ~0.2 s |
| Memory (app + WebView2) | ~130–140 MB |
| Idle CPU | ~1% of one core |

## Requirements

- **Users:** Windows 10, Windows 11 or Windows Server 2019/2022 (x64) with WebView2 (installed by default; the installer fetches it if missing).
- **Developers:** Node.js 22+, Rust stable, Visual Studio C++ Build Tools. See [README.md](README.md).
