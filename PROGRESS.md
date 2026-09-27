# Build Progress — Markdown Desktop

Tracks progress against `01-MARKDOWN-EDITOR-AUTONOMOUS-BUILD-v2.md` (the spec).
Updated and committed after every major step.

## Request summary

- Typora-style Markdown editor for Windows (placeholder name **Markdown Desktop**)
- Stack: Tauri 2 + Rust, React + TypeScript + Vite, TipTap, unified/remark, Shiki, KaTeX, Zustand
- Local-first, offline, no telemetry; `.md` files are the source of truth
- Lossless round trips (tables, code, math, Unicode, Arabic)
- Tests, lint, typecheck, Rust checks, NSIS installer, GitHub Actions, README

## Environment

| Tool | Version |
|------|---------|
| Node / npm | 22.11 / 10.9 |
| Rust | 1.98.1 (installed via rustup) |
| MSVC | VS 2022 Build Tools 14.44 (installed) |
| WebView2 | 153 (pre-installed) |

## Phases

- [x] **Phase 0 — Bootstrap**: Tauri 2 + React + TS, ESLint, Prettier, strict TS, Rust checks
- [x] **Phase 1 — Markdown engine**: remark parser/serializer, verbatim block reuse, round-trip fixtures
- [x] **Phase 2 — File workflow**: new/open/save/save-as, unsaved state, recent files, drag-drop, watcher
- [x] **Phase 3 — Full editing**: tables, tasks, links, images, Shiki, KaTeX, shortcuts, find/replace
- [x] **Phase 4 — Desktop UX**: outline, sidebar, themes, settings, font/width, empty and error states
- [x] **Phase 5 — Quality**: tests, accessibility basics, README, docs
- [x] **Phase 6 — Release**: NSIS + MSI installers built locally, CI and release workflows written

## Decisions

- **Plain CSS with design tokens instead of Tailwind**: editor typography is custom CSS anyway; fewer dependencies.
- **Verbatim block reuse**: the serializer compares each top-level editor node with the node it was loaded from (`Node.eq`) and writes the original source text when unchanged. Edited blocks are rendered with the file's detected style (bullet, emphasis, fence characters).
- **Unsupported Markdown becomes a raw block** (footnotes, reference definitions, mixed task lists, HTML, front matter) so nothing is ever lost.
- **Line endings and BOM** are detected on load and restored on save.
- **Parsing large files in a Web Worker** (≥ 64 KB) keeps the UI responsive.
- **Shiki with the JavaScript regex engine** (no WASM, keeps the CSP strict); languages load on demand.
- **KaTeX loaded lazily** with `trust: false`.
- **Native bridge** (`src/native`): React never calls Tauri directly; tests use an in-memory bridge.
- **Atomic saves** in Rust (temp file + rename, with a direct-write fallback).
- **Asset protocol scope** is granted per opened document's folder only.
- **happy-dom/node test environment** because jsdom 27 needs Node ≥ 22.12.
- **In-app menu bar** (not a native menu) so shortcuts and menus behave identically everywhere.

## Log

- 2026-09-26: Read spec, created tracker, initialized git.
- 2026-09-26: Installed Rust + MSVC Build Tools, scaffolded Tauri app, Rust file layer (14 tests).
- 2026-09-26: Markdown engine with 13 round-trip fixtures (68 tests).
- 2026-09-26: File workflow and stores (27 integration tests).
- 2026-09-27: Editor UI, source mode, commands, sidebar, themes; lint + typecheck clean, 103 tests pass.
- 2026-09-27: Docs, CI/release workflows, smoke-test script; release build started.
- 2026-09-27: Release build: NSIS setup.exe (3.1 MB) + MSI (3.9 MB). End-to-end smoke test on the real app: 19/19 checks pass.

## Blockers

See [BLOCKERS.md](BLOCKERS.md) — code-signing certificate, final branding, license confirmation, GitHub repo.
