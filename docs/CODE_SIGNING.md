# Windows code signing

The Windows installers published by Satr are currently **unsigned**. Windows
therefore shows a SmartScreen "Windows protected your PC" warning on first run
and lists the publisher as *Unknown publisher*. Signing the installer removes
that warning and proves the binary was produced by the maintainer.

This document is a practical guide for the owner. **Nothing here is enabled
yet** — the release workflow keeps building and publishing unsigned artifacts
until the signing secrets described below are added.

## Options

### 1. OV / EV code-signing certificate from a CA

Buy an **OV** (organization validated) or **EV** (extended validation) code
signing certificate from a certificate authority. You receive a certificate plus
a private key, which you combine into a single password-protected `.pfx` file:

```bash
openssl pkcs12 -export -in cert.cer -inkey private-key.key -out certificate.pfx
```

- OV certificates are cheaper and available to individuals.
- **EV certificates are usually delivered on a hardware token or a cloud HSM and
  cannot be exported as a simple `.pfx`.** If that is what you have, you cannot
  use the base64/PFX workflow below; use the cloud/`signCommand` route instead
  (see [Azure Key Vault / custom sign command](#3-azure-key-vault-or-another-cloud-hsm)).
- Since 2024 an EV certificate no longer grants instant SmartScreen reputation;
  OV and EV build reputation the same way. Sign every release with the **same**
  certificate so the reputation carries across releases.

### 2. Azure Trusted Signing (now "Azure Artifact Signing")

A cheaper, cloud-based alternative: Microsoft holds the certificate and signs on
your behalf, so there is no `.pfx` to store. It needs an Azure account, a
validated identity, and a signing certificate profile. It is wired into Tauri
through `bundle.windows.signCommand` (see below), not through the PFX secrets.

### 3. Azure Key Vault or another cloud HSM

For a certificate that lives in a cloud HSM (EV tokens, Key Vault), Tauri cannot
use `certificateThumbprint`. Use a **custom sign command** instead, for example
[`relic`](https://github.com/sassoftware/relic) for Key Vault or
[`artifact-signing-cli`](https://github.com/Levminer/artifact-signing-cli) for
Azure Artifact Signing:

```json
{
  "bundle": {
    "windows": {
      "signCommand": "artifact-signing-cli -e https://wus2.codesigning.azure.net -a MyAccount -c MyProfile -d Satr %1"
    }
  }
}
```

## Tauri 2 configuration keys

Tauri reads these from `src-tauri/tauri.conf.json` under `bundle.windows`:

| Key                     | Meaning                                                                 |
| ----------------------- | ----------------------------------------------------------------------- |
| `certificateThumbprint` | SHA-1 thumbprint of a certificate already in the Windows cert store.    |
| `digestAlgorithm`       | Hash used by `signtool`; use `sha256`.                                  |
| `timestampUrl`          | RFC 3161 timestamp server, so signatures stay valid after the cert expires. |
| `signCommand`           | Alternative to `certificateThumbprint`: run an external signing tool.   |

For a local build with a certificate in your own store, add them like this
inside the existing `bundle` object:

```json
{
  "bundle": {
    "windows": {
      "certificateThumbprint": "A1B1A2B2A3B3A4B4A5B5A6B6A7B7A8B8A9B9A0B0",
      "digestAlgorithm": "sha256",
      "timestampUrl": "http://timestamp.digicert.com"
    }
  }
}
```

Do **not** commit a thumbprint that only exists on your machine. For CI, the
workflow writes a platform-specific `src-tauri/tauri.windows.conf.json` at build
time (see below) so the checked-in `tauri.conf.json` stays unsigned by default.

## Wiring it into CI

Store two repository secrets (**Settings → Secrets and variables → Actions**):

| Secret                         | Value                                                                    |
| ------------------------------ | ------------------------------------------------------------------------ |
| `WINDOWS_CERTIFICATE`          | Base64-encoded `.pfx`, e.g. `certutil -encode certificate.pfx out.txt`.  |
| `WINDOWS_CERTIFICATE_PASSWORD` | The `.pfx` export password.                                              |

`.github/workflows/release.yml` already contains guarded steps that:

1. Run only when `WINDOWS_CERTIFICATE` is set
   (`if: env.HAS_CERT == 'true'`).
2. Decode the base64 `.pfx` to a temp file and import it into the runner's
   `Cert:\CurrentUser\My` store with PowerShell `Import-PfxCertificate`.
3. Write `src-tauri/tauri.windows.conf.json` with the imported certificate's
   thumbprint, `digestAlgorithm: sha256`, and a timestamp URL, so the existing
   build step signs the NSIS and MSI bundles without any other change.

If the secrets are absent, `HAS_CERT` is `'false'`, the steps are skipped, and
the build behaves exactly as it does today (unsigned).

## Verify it worked

After a release build, check a downloaded installer on Windows:

```powershell
Get-AuthenticodeSignature .\Satr_0.1.0_x64-setup.exe | Format-List Status, SignerCertificate
```

`Status` should be `Valid` and `SignerCertificate` should show your publisher.
You can also right-click the file → **Properties → Digital Signatures**, or run
`signtool verify /pa /v <file>`.

The build log should contain a line like:

```
info: signing app
info: running signtool "...\signtool.exe"
info: Successfully signed: ...\Satr_0.1.0_x64-setup.exe
```

## References

- [Tauri — Windows code signing](https://tauri.app/distribute/sign/windows/)
- [Microsoft — code signing options](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options)
