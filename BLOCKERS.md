# External blockers

Items that need something only the project owner can provide. All other MVP
work is complete without them.

| Blocker | Impact | What is needed |
| --- | --- | --- |
| Code-signing certificate | Installers are unsigned; SmartScreen warns on first run | OV/EV certificate or Azure Trusted Signing account, then the steps in README → "Windows packaging and code signing" |
| Final product name, icon and publisher | App uses the placeholder name "Markdown Desktop" and the default Tauri icon | Branding assets; replace `src-tauri/icons/*` (`npx tauri icon logo.png`) and update `productName`/`publisher` in `tauri.conf.json` |
| License confirmation | MIT is a placeholder | Owner's choice of license |
| GitHub repository | CI and release workflows are configured but not yet run | A GitHub repo to push to |
