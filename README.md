# Lux Management

The internal workspace for Lux Management: models, team, accounts, subreddits, posting log, library, meetings, tasks, audit log and AI briefings. One source file runs as a desktop app for **Windows and Mac** and as a Claude web artifact. There is no Linux version.

**Keep this repository private.** It holds no workspace data, but it is the agency's internal tool.

## What's where

| Path | What it is |
|---|---|
| `src/lux-management.html` | The whole program. Every change happens here. |
| `CHANGELOG.md` | Release notes. The `EN:` and `PT:` lines appear in Lux's update bar. |
| `app/` | Desktop app settings, fonts and icon. |
| `release/windows/LuxManagement.exe` | The Windows program file. It stays the same every release so Windows keeps trusting it. Don't replace it. |
| `release/windows/README.txt` | The guide included in the Windows download. |
| `release/mac/` | What makes the Mac app: its starting program (`launcher.c`), `Info.plist` and the guide included in the Mac download. |
| `scripts/build.py` | Builds the update file, the Windows and Mac downloads and the web version. |
| `scripts/sign-update.mjs` | Signs an update so Lux installs it. |
| `.github/workflows/build.yml` | Builds everything on one of GitHub's Macs and puts it on the release. |

## Shipping an update

1. **Change the program** in `src/lux-management.html` and raise the version in
   `const APP_VERSION = '2.8.0';` (for example to `2.9.0`).
2. **Add release notes** to the top of `CHANGELOG.md`:
   ```
   ## 2.9.0
   EN: What changed, in one or two sentences.
   PT: O que mudou, em uma ou duas frases.
   ```
3. **Commit and push** (GitHub Desktop: write a summary, **Commit to main**, then **Push origin**).
4. **Publish a release** on GitHub: **Releases → Draft a new release → Choose a tag**, type `v2.9.0`
   (it must match the version), give it a title, then **Publish release**.
   Pushing a tag `v2.9.0` does the same, and GitHub then writes the release notes from the changelog.
5. **Wait about five minutes.** GitHub builds everything on a Mac and attaches it to the release:
   - `Lux-Management-Windows-2.9.0.zip`: full download for new Windows computers
   - `Lux-Management-Mac-2.9.0.dmg`: full download for new Macs
   - `Lux-Management-2.9.0.neu`: the update
   - `lux-update-2.9.0.luxupdate`: the signed update (only with the signing key secret, see below)
   - `lux-management-web-2.9.0.html`: the Claude web version
   - `SHA256SUMS.txt`: fingerprints to check the files
   If the build fails, the **Actions** tab shows why in plain words (for example, a version that doesn't match the tag).
6. **The team gets it.** If the release has the signed `.luxupdate`, every Lux finds it on GitHub within
   30 minutes and offers it in the gold bar. If it doesn't, either publish it through the shared data folder
   (download the `.neu`, then in Lux: **Settings → Program updates → Publish an update** → choose the `.neu`
   → choose the signing key), or sign it on your computer and add the `.luxupdate` to the release
   (see *Building on your own computer*).

If something goes wrong, **Settings → Version history** can take one computer or the whole team back.

## Updates straight from GitHub

Lux asks GitHub for this repository's releases when it opens and every 30 minutes (and when someone clicks
**Check for updates**). It installs a release only through its `lux-update-<version>.luxupdate` file, and only
after checking the signature with the key built into Lux, exactly like updates from the shared folder.
Drafts and pre-releases are ignored. Versions withdrawn with **Rewind everyone** are never offered again.

- **The repository is private**, so Lux needs a read-only token to see the releases:
  1. On GitHub, open [a new fine-grained token](https://github.com/settings/personal-access-tokens/new).
  2. **Repository access:** Only select repositories → `lux_management_app`.
  3. **Permissions:** Contents → Read-only. Nothing else.
  4. Pick an expiration and put a reminder to renew it.
  5. In Lux: **Settings → Program updates → GitHub access**, paste the token, **Save**.

  The token is saved in the data folder (`Lux updates/github.json`), so every computer that uses the same
  shared data folder can check GitHub. It can only read this repository. When it expires, Settings says so
  and updates still arrive through the shared folder.
- If the repository is ever made public, no token is needed.
- Anyone can turn the GitHub check off on their computer with **Look for updates on GitHub** in Settings.
- Downloads use `curl`, which comes with Windows 10 and 11 and with macOS.
- **Moving the team from 2.7.1:** 2.7.1 and earlier only look in the shared folder. Publish 2.8.0 once
  through the shared folder (step 6 above). From 2.8.0 on, updates can come straight from GitHub.

## The signing key

`lux-update-signing-key.json` proves an update really comes from you. Lux refuses updates without a valid signature.

- **Never commit it.** `.gitignore` blocks the usual file names, but check before every commit.
- **Keep it in your password manager**, not in the shared data folder.
- **For updates from GitHub:** add the key's contents as a repository secret named `LUX_SIGNING_KEY`
  (**Settings → Secrets and variables → Actions → New repository secret**). Every release then includes the
  signed `lux-update-<version>.luxupdate` and Lux installs it by itself. The trade-off: anyone who takes over
  the GitHub account could publish updates. Only do this with two-factor authentication on every account that
  has access to the repository. Without the secret, sign each release on your own computer and add the
  `.luxupdate` to it.

## The Mac app

- The app is not notarized by Apple, so the first time macOS asks to confirm it:
  **System Settings → Privacy & Security → Open Anyway** (on older macOS: Control-click the app → Open).
- Everything Lux keeps on a Mac (program file, data, settings, backups, versions) is in
  `~/Library/Application Support/Lux Management`. The app itself never changes, so updates never break its
  signature, and replacing the app never touches the data.
- The Mac app can only be built on a Mac. GitHub does that for every release.

## Never upload

Workspace data, settings, backups, exports, library files, `.luxupdate` files, GitHub tokens or the signing key.
The `.gitignore` covers these, but only if they are inside this folder. Keep the Lux program folder
(where people actually run the app) somewhere else.

## Building on your own computer

Needs Python 3 and Node.js. The Mac app also needs a Mac with the Xcode command line tools
(`xcode-select --install`); on Windows the build makes everything except the Mac app.

```
npm install -g @neutralinojs/neu
python3 scripts/build.py
```

The files appear in `dist/`. To sign one yourself:

```
node scripts/sign-update.mjs dist/Lux-Management-2.9.0.neu --key path/to/lux-update-signing-key.json
```

## Working with Claude

Point Claude at this repository, or upload `src/lux-management.html` and `CHANGELOG.md`, and describe the change.
Ask it to raise `APP_VERSION` and add the changelog entry, then publish a release as above.
