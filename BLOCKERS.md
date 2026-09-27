# External blockers

Items that need something only the project owner can provide. All other MVP
work is complete without them.

| Blocker | Impact | What is needed |
| --- | --- | --- |
| Code-signing certificate | Installers are unsigned; SmartScreen warns on first run | OV/EV certificate or Azure Trusted Signing account, then the steps in README → "Windows packaging and code signing" |
| Publisher name | Installer lists "Satr contributors" as publisher | Owner or company name for `bundle.publisher` in `tauri.conf.json` |
| License confirmation | MIT is a placeholder | Owner's choice of license |
| GitHub repository | CI and release workflows are configured but not yet run | A GitHub repo to push to |
