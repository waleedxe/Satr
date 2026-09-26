# Build Progress — Markdown Desktop

Tracks progress against `01-MARKDOWN-EDITOR-AUTONOMOUS-BUILD-v2.md` (the spec).
Update this file and commit after every major step so no work is lost.

## Request summary

- Build a Typora-style Markdown editor for Windows (placeholder name: **Markdown Desktop**)
- Stack: Tauri 2 + Rust, React + TypeScript + Vite, TipTap, unified/remark/rehype, Shiki, KaTeX, Zustand, Tailwind
- Local-first, offline, no telemetry; `.md` files are the source of truth
- Must preserve Markdown on round-trips, including tables, code, math, Unicode and Arabic
- WYSIWYG view plus raw source view, outline, themes, find/replace, recent files, file watcher
- Needs tests, lint, typecheck, Rust checks, NSIS installer, GitHub Actions CI and a README
- Work autonomously phase by phase, with small git commits; log external blockers in `BLOCKERS.md`

## Environment (checked 2026-09-26)

| Tool | Status |
|------|--------|
| git  | 2.45.2 ✅ |
| node | 22.11.0 ✅ |
| npm  | 10.9.0 ✅ |
| pnpm | missing (npm will be used) |
| Rust / cargo | ❌ **missing, needs to be installed (rustup + MSVC build tools)** |

## Phases

- [ ] **Phase 0: Bootstrap.** Tauri 2 + React + TS scaffold, lint/format, strict TS, Rust checks, dev launch, first Windows build
- [ ] **Phase 1: Markdown engine.** TipTap, parse/serialize, round-trip tests
- [ ] **Phase 2: File workflow.** New/open/save/save-as, unsaved state, recent files, drag-drop, watcher
- [ ] **Phase 3: Full editing.** Tables, tasks, links, images, Shiki, KaTeX, shortcuts, find/replace
- [ ] **Phase 4: Desktop UX.** Outline, sidebar, themes, settings, font/width, empty and error states
- [ ] **Phase 5: Quality.** Tests, accessibility, performance, cleanup, README
- [ ] **Phase 6: Release.** NSIS installer, GitHub Actions, version metadata, release docs

## Log

- 2026-09-26: Read the spec, created this file, ran `git init` and made the initial commit.

## Decisions

_(record engineering decisions here as they're made)_

## Blockers

- Rust toolchain is not installed. It's required for Tauri, so it must be installed before Phase 0 can finish.
