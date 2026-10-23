# Security Policy

## Reporting a vulnerability

Please report security issues **privately**. Do not open a public issue with
details, proof-of-concept code, or affected files.

- **Preferred:** use GitHub's **Security → Report a vulnerability** on this
  repository (Private Vulnerability Reporting).
- If private reporting is unavailable, open a **minimal** public issue asking for
  a private channel. Do **not** include vulnerability details in that issue.

Please include:

- The affected version or commit (a release tag such as `v0.1.0`, or a commit
  SHA).
- Steps to reproduce, or a small proof of concept.
- The impact you believe it has.

## Scope

**In scope:** the Satr desktop application in this repository and its Rust
crates (`src-tauri`).

**Out of scope:**

- Third-party GitHub Actions used by the CI workflow in `.github/workflows`.
- Issues that require an already-compromised machine (for example, malware
  running with the user's privileges).

## Supported versions

Only the latest release is supported. Satr is pre-1.0, so fixes ship in the
newest release rather than being backported to older ones.

## Response expectations

This is a personal, unpaid project. Reports are acknowledged and handled on a
best-effort basis; there is no guaranteed response or fix timeline.
