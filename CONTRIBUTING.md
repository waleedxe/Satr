# Contributing

Thanks for helping improve Markdown Desktop!

## Getting started

1. Install the prerequisites listed in the README (Node 22+, Rust, platform build tools).
2. `npm install`
3. `npm run tauri dev`

## Before opening a pull request

Run the full check and make sure it passes:

```bash
npm run check
```

- Keep changes focused and commits small, using conventional messages
  (`feat:`, `fix:`, `test:`, `docs:`, `chore:`, `ci:`).
- Add or update tests. Changes to Markdown parsing or saving must come with a
  round-trip fixture in `tests/fixtures/roundtrip/`.
- React components must not call Tauri APIs directly; go through `src/native`.
- Never store document contents anywhere except the user's own files, and never
  send them over the network.

## Reporting bugs

Please include a small Markdown sample that reproduces the problem.
