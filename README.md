# Satr

A fast, local-first Markdown editor for Windows (with a cross-platform architecture). It is designed to feel like writing, not coding: you edit formatted text directly, and your `.md` files stay exactly what they are — plain Markdown on your disk.

> **Satr** (سطر) means "a line of writing" in Arabic.

## Screenshots

_Screenshots will be added before the first public release._

## Download

Download the latest `.exe` or `.msi` installer from the [Releases](../../releases/latest) page and run it.

Builds are currently **not code-signed**, so Windows SmartScreen shows a warning: choose **More info → Run anyway**.

## Features

- **Visual (WYSIWYG) editing** with Markdown typing shortcuts (`#`, `-`, `1.`, `[ ]`, `>`, ` ``` `, `---`, `$$`, `**bold**`, …)
- **Raw Markdown source mode** (Ctrl+/) powered by CodeMirror
- **Lossless saving** — blocks you did not touch are written back byte-for-byte; unsupported syntax (HTML, footnotes, front matter, reference links) is preserved verbatim
- Headings, bold, italic, strikethrough, inline code, links, images, lists, nested lists, task lists, blockquotes, horizontal rules and **tables** (with column alignment)
- **Code blocks** with Shiki syntax highlighting for 35+ languages, loaded on demand
- **Math** with KaTeX — inline `$…$` and block `$$…$$`
- **Find and replace** (Ctrl+F / Ctrl+H)
- **Tabs**, **recent files**, **open folder** file explorer, **document outline**
- **Light, dark and system themes**, adjustable font size and content width
- **Fonts**: five bundled Arabic-friendly fonts (IBM Plex Sans Arabic, Cairo, Tajawal, Noto Naskh Arabic, Amiri), any font installed on the computer, and a separate heading font
- **Interface languages**: English (default) and Arabic with a fully mirrored right-to-left layout; adding a language is one translation file in `src/i18n/`
- **Focus mode** (F8), **typewriter mode** (F9), optional **autosave**
- Word count, character count and reading time
- Unsaved-change protection, external change detection (reload / keep mine), deleted-file handling
- Keeps line endings (LF/CRLF) and UTF-8 BOM exactly as they were
- Right-to-left text (Arabic, Hebrew) is laid out per paragraph automatically

## Privacy

Satr works completely offline. There is **no account, no cloud sync and no telemetry**. The app only reads and writes the files you open, and never sends document contents anywhere. Remote images referenced by a document (`https://…`) are loaded like in any Markdown viewer.

## Installation

Download the latest `Satr_x.y.z_x64-setup.exe` (or `.msi`) from the [Releases](../../releases) page and run it.

- Supported: Windows 10, Windows 11 and Windows Server 2019/2022 (x64).
- Requires Microsoft Edge WebView2 (pre-installed on Windows 11 and current Windows 10; the installer downloads it if missing).
- Builds are currently **not code-signed**, so Windows SmartScreen shows a warning: choose **More info → Run anyway**.

## Adding a language

1. Copy `src/i18n/ar.ts` to a new file (e.g. `fr.ts`) and translate the strings. TypeScript reports any missing key.
2. Register it in `LANGUAGES` and `dictionaries` in `src/i18n/index.ts`, and add its id to the `language` check in `src/features/settings/settings.ts`.
3. Run `npm test`; the translation tests check that every string and placeholder is present.

## Development

Prerequisites:

- Node.js 22+
- Rust (stable) via [rustup](https://rustup.rs)
- Windows: Visual Studio C++ Build Tools and WebView2 ([Tauri prerequisites](https://tauri.app/start/prerequisites/))

```bash
npm install
npm run tauri dev      # run the desktop app with hot reload
npm run dev            # run the UI alone in a browser (uses an in-memory file system)
```

Quality checks:

```bash
npm run lint           # ESLint
npm run typecheck      # TypeScript (strict)
npm test               # Vitest unit + integration tests
npm run format:check   # Prettier
npm run rust:fmt       # cargo fmt --check
npm run rust:clippy    # clippy, warnings are errors
npm run rust:test      # Rust unit tests
npm run check          # everything above
npm run smoke:build && npm run smoke   # end-to-end test of the real app (Windows)
```

## Building

```bash
npm run tauri build
```

Artifacts are written to `src-tauri/target/release/bundle/`:

- `nsis/Satr_<version>_x64-setup.exe` — per-user installer
- `msi/Satr_<version>_x64_en-US.msi` — MSI package
- `src-tauri/target/release/satr.exe` — the portable executable

### Windows packaging and code signing

Installers are produced by Tauri's NSIS and WiX bundlers. For a public release the installers should be signed so SmartScreen trusts them:

1. Obtain an OV or EV code-signing certificate (or use Azure Trusted Signing).
2. Import it into the build machine's certificate store and set `bundle.windows.certificateThumbprint`, `digestAlgorithm` (`sha256`) and `timestampUrl` in `src-tauri/tauri.conf.json`.
3. In CI, store the certificate as the `WINDOWS_CERTIFICATE` (base64 PFX) and `WINDOWS_CERTIFICATE_PASSWORD` secrets and import it before `tauri-action` runs.

See the [Tauri Windows signing guide](https://tauri.app/distribute/sign/windows/).

### Releases

Pushing a tag such as `v0.1.0` runs `.github/workflows/release.yml`, which builds the Windows installers and attaches them to a draft GitHub Release.

## Project structure

```text
src/
  app/            commands, menus, shortcuts, start-up
  components/     menu bar, tabs, sidebar, status bar, dialogs, panels
  editor/
    extensions/   TipTap nodes: math, code blocks, images, raw blocks, highlighting
    markdown/     remark-based parser/serializer with verbatim block reuse
    source/       CodeMirror source mode
    lazy/         on-demand loaders for Shiki and KaTeX
  features/       files (open/save/watch), outline, search, settings, themes
  native/         typed bridge to Tauri (plus an in-memory bridge for tests)
  stores/         Zustand stores
  styles/         design tokens, app chrome and editor typography
src-tauri/
  src/            Rust: commands, filesystem (atomic writes), watcher, errors
tests/
  fixtures/       Markdown round-trip fixtures
  unit/           converter, settings, path tests
  integration/    file workflow tests
```

An Arabic guide to the whole project is in [`docs/GUIDE_AR.md`](docs/GUIDE_AR.md). Key decisions are listed in [`PROGRESS.md`](PROGRESS.md); every library and tool is described in [`TECH_STACK.md`](TECH_STACK.md).

## Roadmap

- Code-signed releases and auto-update
- Split editor/preview mode
- Paste and drag images into the document folder
- Export to HTML and PDF
- Custom themes
- macOS and Linux builds

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT — see [LICENSE](LICENSE). (Placeholder choice; confirm before the first public release.)
