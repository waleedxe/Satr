# AUTONOMOUS BUILD SPEC v2 — Desktop Markdown Editor

## Mission

You are the primary implementation agent for this repository.

Your job is NOT to merely plan, suggest architecture, scaffold files, or produce partial code.

Your job is to autonomously build a complete, tested, production-buildable MVP of a modern desktop Markdown editor for Windows.

Continue working until the MVP defined in this document is complete or until you encounter a blocker that genuinely requires something unavailable to you, such as:
- external credentials
- paid service access
- code-signing certificates
- Microsoft Store account access
- unavailable operating-system capabilities

Do not stop for normal technical decisions. Make reasonable engineering decisions yourself and proceed.

---

# 1. Product Goal

Build a modern, fast, lightweight Markdown desktop editor.

The product should feel closer to Typora / Typedown than to a traditional code editor.

Primary goals:
- excellent writing experience
- very fast startup
- low memory use
- local-first
- offline-first
- opens and saves standard `.md` files
- public release quality
- maintainable codebase
- Windows-first
- cross-platform architecture

This is a public product, not a personal/private utility.

Do not hard-code personal names or branding.

Use a neutral temporary product name such as `Markdown Desktop` until branding is finalized.

---

# 2. Core Product Principles

1. Local-first
2. Offline-first
3. Fast startup
4. Low resource usage
5. No mandatory account
6. No mandatory cloud
7. Standard Markdown files remain the source of truth
8. Minimal, modern interface
9. Excellent keyboard support
10. Windows 10/11 first
11. macOS/Linux-compatible architecture where reasonable
12. Simple, modular implementation
13. No unnecessary backend/server
14. No telemetry by default
15. Never send document contents externally unless the user explicitly enables a future feature

---

# 3. Mandatory Technology Stack

Use:

## Desktop
- Tauri 2
- Rust

## Frontend
- React
- TypeScript
- Vite

## Editor
- TipTap / ProseMirror

## Markdown processing
- unified
- remark
- rehype

## Syntax highlighting
- Shiki

## Math
- KaTeX

## State
- Zustand

## Styling
Prefer:
- Tailwind CSS

or a simple maintainable CSS architecture if Tailwind creates unnecessary complexity.

Do NOT use Electron.

Do NOT switch frameworks unless the selected technology is demonstrably unusable.

---

# 4. Autonomous Execution Contract

You must:

- inspect the current repository
- initialize the project if it is empty
- install required dependencies
- create the architecture
- implement production code
- run the application
- run lint
- run typecheck
- run tests
- run Rust checks
- build production bundles
- diagnose failures
- fix failures
- retest
- document the project
- configure CI
- configure Windows release builds
- keep the repository clean

Do NOT stop after:
- writing a plan
- creating a skeleton
- building only the home screen
- creating mock functionality
- leaving core MVP features as TODOs
- compiling once without testing actual workflows

If an implementation choice has several reasonable options:
1. choose the simplest maintainable option
2. document the decision briefly
3. proceed

Do not repeatedly ask the user for approval.

---

# 5. Decision Authority

You are explicitly authorized to decide normal engineering details, including:

- folder structure
- component names
- state structure
- internal APIs
- editor extension design
- file watcher implementation
- testing libraries
- small UX details
- error-handling patterns
- dependency versions
- CI layout

Ask for user input ONLY when required for:
- secrets or API keys
- paid services
- final brand/name/logo
- legal licensing choices that cannot safely use a placeholder
- publishing accounts
- code signing
- destructive actions outside the repository

When branding is unknown, use placeholders and keep building.

---

# 6. MVP Features — REQUIRED

The MVP is NOT complete until all required items below are implemented and tested.

## File operations

- New Markdown file
- Open `.md`
- Open `.markdown`
- Save
- Save As
- Recent files
- Drag-and-drop Markdown file opening
- Unsaved-change detection
- Close warning for unsaved documents
- External file change detection
- Safe handling of missing/deleted files

## Editor

Support:
- headings H1-H6
- bold
- italic
- strikethrough
- inline code
- fenced code blocks
- ordered lists
- unordered lists
- task lists
- blockquotes
- links
- images
- horizontal rules
- tables

## Editing behavior

- undo
- redo
- select all
- copy/paste
- keyboard shortcuts
- Markdown-style typing shortcuts
- find
- replace

## Views

Required:
- WYSIWYG-style editor
- raw Markdown source mode

Optional if cleanly achievable:
- split editor/preview mode

## Navigation

- document outline based on headings
- click outline item to navigate
- collapsible sidebar

## Appearance

- light theme
- dark theme
- system theme
- readable typography
- adjustable font size
- adjustable content width
- focused writing layout

## Code

- syntax highlighting using Shiki
- support common languages
- reasonable fallback for unknown languages

## Math

- inline math
- block math
- KaTeX rendering

---

# 7. Strongly Recommended MVP Features

Implement if practical without destabilizing release:

- tabs
- autosave option
- word count
- character count
- reading time
- open folder/workspace
- file explorer sidebar
- focus mode
- typewriter mode

These are secondary to correctness of core editing and file persistence.

---

# 8. Explicit Non-Goals for MVP

Do NOT let these delay completion:

- cloud sync
- user accounts
- collaboration
- AI assistant
- plugin marketplace
- Git integration
- publishing platform
- mobile app
- full Notion-style block database

Architecture may allow these later, but do not build them before MVP is complete.

---

# 9. Suggested Architecture

Use separation similar to:

```text
src/
  app/
  components/
  editor/
    extensions/
    commands/
    markdown/
    serializers/
    parsers/
  features/
    files/
    recent/
    outline/
    search/
    settings/
    themes/
  hooks/
  stores/
  styles/
  types/
  utils/

src-tauri/
  src/
    commands/
    filesystem/
    watcher/
    settings/
    errors/
    lib.rs

tests/
.github/
  workflows/
```

Important rule:

React components should NOT call arbitrary Tauri APIs everywhere.

Create a small typed native bridge/service layer.

---

# 10. Data and State Rules

Markdown files are the source of truth.

Do not store user document contents in a database.

Settings may be stored in:
- Tauri store
- lightweight local config

Recent files should store only necessary paths/metadata.

Keep application state predictable and minimal.

---

# 11. Markdown Fidelity

This is critical.

Opening and saving a Markdown file must avoid unnecessary destructive transformations.

Requirements:
- preserve content semantics
- avoid rewriting unrelated sections when possible
- preserve valid Markdown structures
- avoid corrupting tables, code fences, links, Unicode, or Arabic text
- test Markdown round-trips

Create fixtures for:
- headings
- lists
- nested lists
- task lists
- code blocks
- tables
- links/images
- math
- Unicode
- mixed Arabic/English text

---

# 12. Performance Requirements

The application must feel responsive.

Requirements:
- do not reparse/re-render the entire document unnecessarily on every keystroke
- debounce expensive tasks
- lazy-load heavy optional features
- move native/expensive work off the UI thread
- avoid unnecessary large dependencies

Target:
- normal documents feel instant
- 1–5 MB Markdown files remain usable

Measure obvious bottlenecks instead of guessing.

---

# 13. Security Requirements

Markdown files are untrusted input.

- sanitize rendered HTML
- do not execute scripts embedded in Markdown
- do not expose arbitrary shell commands
- follow Tauri capability security
- grant minimum filesystem permissions
- validate file paths
- handle malformed content safely
- never transmit documents externally

---

# 14. Windows Distribution

Primary platform:
- Windows 10
- Windows 11

Build:
- development executable
- production executable
- NSIS `.exe` installer

If straightforward:
- MSI package

Prepare application metadata:
- placeholder icon
- version
- publisher placeholder
- app identifier
- uninstall support

Code signing is NOT required for local MVP completion, but document how it should be added for public release.

---

# 15. CI/CD

Create GitHub Actions.

## PR workflow
Run:
- frontend install
- lint
- TypeScript typecheck
- tests
- Rust fmt check
- clippy
- Rust tests
- production build validation where practical

## Release workflow
On version tag:
- build Windows release
- generate installer
- upload artifacts to GitHub Release

If Windows build requires a Windows runner, configure it.

---

# 16. Documentation

Create a high-quality README with:

- what the app is
- screenshots placeholder section
- features
- installation
- development setup
- build instructions
- Windows packaging
- project structure
- privacy statement
- roadmap
- contributing
- license placeholder/choice

Also create:

- `CHANGELOG.md`
- `CONTRIBUTING.md`
- `.gitignore`
- issue templates if useful

---

# 17. Testing Requirements

Use suitable frontend and Rust testing tools.

Required test categories:

## Unit
- Markdown parsing/serialization
- utility functions
- settings logic

## Integration
- open file
- save file
- save as
- unsaved state
- recent file entry
- external file change behavior where practical

## Manual smoke validation
Perform and document:

1. Launch app
2. Create file
3. Type formatted Markdown
4. Save
5. Close
6. Reopen
7. Verify formatting
8. Switch source/WYSIWYG
9. Verify code block
10. Verify math
11. Switch theme
12. Build production app

---

# 18. Development Sequence

Work in this order.

## Phase 0 — Bootstrap

- initialize Tauri 2 + React + TypeScript
- install dependencies
- configure formatting/linting
- strict TypeScript
- configure Rust checks
- create architecture
- verify dev launch
- verify initial Windows build

Do not stop here.

## Phase 1 — Markdown Engine

- TipTap editor
- Markdown parsing
- Markdown serialization
- load text
- basic formatting
- round-trip tests

Continue automatically.

## Phase 2 — File Workflow

- open
- save
- save as
- new file
- unsaved state
- recent files
- drag/drop
- external file watcher

Continue automatically.

## Phase 3 — Full Editing

- tables
- tasks
- links
- images
- code
- Shiki
- KaTeX
- shortcuts
- find/replace

Continue automatically.

## Phase 4 — Desktop UX

- outline
- sidebar
- themes
- settings
- font/content width
- polished empty state
- error states

Continue automatically.

## Phase 5 — Quality

- test suite
- accessibility pass
- performance review
- dependency cleanup
- error handling
- README

Continue automatically.

## Phase 6 — Release

- production Windows bundle
- NSIS installer
- GitHub Actions
- version metadata
- release documentation

---

# 19. Mandatory Loop After Every Major Feature

For each major implementation:

1. implement
2. run formatter
3. run lint
4. run typecheck
5. run relevant tests
6. run build if impacted
7. fix failures
8. repeat until clean
9. commit logically if Git is available

Do NOT move on while knowingly leaving basic build-breaking errors.

---

# 20. Git Discipline

If Git is available:

Use small logical commits.

Examples:
- `chore: bootstrap tauri react app`
- `feat: add markdown editor core`
- `feat: implement file open and save`
- `feat: add document outline`
- `test: add markdown roundtrip fixtures`
- `ci: add windows release workflow`

Do not put secrets into Git.

Do not commit:
- node_modules
- target build output
- installers
- temporary files

Release binaries belong in GitHub Releases, not source history.

---

# 21. Blocker Protocol

If blocked:

1. identify whether the blocker is truly external
2. try reasonable technical alternatives
3. continue all independent work
4. leave repository clean
5. document blocker in `BLOCKERS.md`

Examples of valid external blockers:
- code-signing certificate absent
- Microsoft Store account absent
- branding asset unavailable

Examples that are NOT valid blockers:
- library API needs investigation
- compile error
- dependency conflict
- CSS issue
- test failure
- unfamiliar Rust code

Solve normal engineering problems yourself.

---

# 22. Definition of Done

The MVP is complete only when:

- application launches
- user can open Markdown
- user can create Markdown
- user can edit in WYSIWYG
- user can edit raw Markdown
- common formatting works
- tables work
- code blocks work
- syntax highlighting works
- math works
- outline works
- files save correctly
- Markdown survives reopen
- unsaved state is handled
- recent files work
- light/dark/system themes work
- app works offline
- lint passes
- typecheck passes
- tests pass
- Rust checks pass
- production build succeeds
- Windows installer is generated or release workflow is correctly configured if local environment cannot package it
- README exists
- CI exists

Do NOT declare completion before these conditions are met.

---

# 23. Final Delivery Report

When finished, provide a concise report containing:

- completed features
- repository architecture
- exact commands used to test
- test results
- build result
- generated artifact locations
- known limitations
- optional next steps

Do NOT replace implementation work with a report.

The report is only produced after implementation.

---

# 24. START NOW

Immediately:

1. inspect the repository
2. initialize it if empty
3. create a short internal execution plan
4. begin Phase 0
5. continue phase by phase without waiting for user confirmation
6. keep working until the Definition of Done is satisfied or a genuine external blocker remains

Do not stop after planning.

BUILD THE PRODUCT.
