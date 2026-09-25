# Lux Management

The internal workspace for Lux Management: models, team, accounts, subreddits, posting log, library, meetings, tasks, audit log and AI briefings. One source file runs as a Windows desktop app and as a Claude web artifact.

**Keep this repository private.** It holds no workspace data, but it is the agency's internal tool.

## What's where

| Path | What it is |
|---|---|
| `src/lux-management.html` | The whole program. Every change happens here. |
| `CHANGELOG.md` | Release notes. The `EN:` and `PT:` lines appear in Lux's update bar. |
| `app/` | Desktop app settings, fonts and icon. |
| `release/LuxManagement.exe` | The Windows program file. It stays the same every release so Windows keeps trusting it. Don't replace it. |
| `release/README.txt` | The guide included in the Windows download. |
| `scripts/build.py` | Builds the update file, the Windows download and the web version. |
| `scripts/sign-update.mjs` | Optional: signs an update so it installs without opening Lux. |
| `.github/workflows/build.yml` | Runs the build on GitHub when you publish a release. |

## Shipping an update

1. **Change the program** in `src/lux-management.html` and raise the version in
   `const APP_VERSION = '2.7.1';` (for example to `2.8.0`).
2. **Add release notes** to the top of `CHANGELOG.md`:
   ```
   ## 2.8.0
   EN: What changed, in one or two sentences.
   PT: O que mudou, em uma ou duas frases.
   ```
3. **Commit and push** (GitHub Desktop: write a summary, **Commit to main**, then **Push origin**).
4. **Publish a release** on GitHub: **Releases → Draft a new release → Choose a tag**, type `v2.8.0`
   (it must match the version), give it a title, then **Publish release**.
5. **Wait about two minutes.** GitHub builds everything and attaches it to the release:
   - `Lux-Management-2.8.0.neu`: the update
   - `Lux-Management-Windows-2.8.0.zip`: full download for new computers
   - `lux-management-web-2.8.0.html`: the Claude web version
   - `SHA256SUMS.txt`: fingerprints to check the files
   If the build fails, the **Actions** tab shows why in plain words (for example, a version that doesn't match the tag).
6. **Send it to the team.** Download the `.neu` from the release, then in Lux:
   **Settings → Program updates → Publish an update** → choose the `.neu` → choose the signing key.
   Every computer on the shared data folder is offered it within 30 minutes.

If something goes wrong, **Settings → Version history** can take one computer or the whole team back.

## The signing key

`lux-update-signing-key.json` proves an update really comes from you. Lux refuses updates without a valid signature.

- **Never commit it.** `.gitignore` blocks the usual file names, but check before every commit.
- **Keep it in your password manager**, not in the shared data folder.
- **Optional shortcut:** add the key's contents as a repository secret named `LUX_SIGNING_KEY`
  (**Settings → Secrets and variables → Actions → New repository secret**). Releases then also include a
  ready-to-install `lux-update-2.8.0.luxupdate`, which you drop into the shared **Lux updates** folder,
  and you skip step 6. The trade-off: anyone who takes over the GitHub account could publish updates.
  Only do this with two-factor authentication on every account that has access to the repository.

## Never upload

Workspace data, settings, backups, exports, library files, `.luxupdate` files or the signing key.
The `.gitignore` covers these, but only if they are inside this folder. Keep the Lux program folder
(where people actually run the app) somewhere else.

## Building on your own computer

Needs Python 3 and Node.js.

```
npm install -g @neutralinojs/neu
python3 scripts/build.py
```

The files appear in `dist/`. To sign one yourself:

```
node scripts/sign-update.mjs dist/Lux-Management-2.8.0.neu --key path/to/lux-update-signing-key.json
```

## Working with Claude

Point Claude at this repository, or upload `src/lux-management.html` and `CHANGELOG.md`, and describe the change.
Ask it to raise `APP_VERSION` and add the changelog entry, then publish a release as above.
