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
| `scripts/new-signing-key.mjs` | Makes a new signing key if the old one is lost or exposed. |
| `scripts/check-window.swift`, `scripts/check-window.ps1` | Used by the GitHub build to check that the Mac and Windows apps open with their window on the screen. |
| `.github/workflows/build.yml` | Builds everything on one of GitHub's Macs and puts it on the release. |

## Shipping an update

1. **Change the program** in `src/lux-management.html` and raise the version in
   `const APP_VERSION = '2.9.3';` (for example to `2.10.0`).
2. **Add release notes** to the top of `CHANGELOG.md`:
   ```
   ## 2.10.0
   EN: What changed, in one or two sentences.
   PT: O que mudou, em uma ou duas frases.
   ```
3. **Commit and push** (GitHub Desktop: write a summary, **Commit to main**, then **Push origin**).
4. **Publish a release** on GitHub: **Releases → Draft a new release → Choose a tag**, type `v2.10.0`
   (it must match the version), give it a title, then **Publish release**. Leave the description empty:
   GitHub fills it in from the changelog, with download instructions. Pushing a tag `v2.10.0` does the same.
   Or, without making a tag yourself: **Actions → Build release → Run workflow** on `main`, tick
   **Publish the release**, then **Run workflow**. It builds, checks the Mac app and publishes `v<version>`.
5. **Wait about five minutes.** GitHub builds everything on a Mac and attaches it to the release:
   - `Lux-Management-Windows-2.10.0.zip`: full download for new Windows computers
   - `Lux-Management-Mac-2.10.0.dmg`: full download for new Macs
   - `Lux-Management-2.10.0.neu`: the update
   - `lux-update-2.10.0.luxupdate`: the signed update (only with the signing key secret, see below)
   - `lux-management-web-2.10.0.html`: the Claude web version
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

## Moving a workspace from an older Lux

Lux 2.7.1 and earlier (the Windows app or the Claude web version) can't update to this version: install it
fresh and bring the data over with one backup file.

1. **In the old Lux:** **Import & export → Export**. Tick every box, **including "Audit log (all months)"**
   (older versions leave that one unticked), then **Export backup (.json)**.
2. **Install the new Lux** from the release and open it. It asks your name: type it.
3. **In the new Lux:** **Import & export → Import** and choose the backup file. The preview lists every
   section, the posting log and the audit log, all ticked. Under **Which person in this backup are you?** pick
   yourself (Lux already picks the person with your name), then **Import**.
4. **Everyone else**, on their own computer: install Lux and, if you share a data folder, point it at the same
   folder (**Settings → Data folder → Change folder**). When Lux asks who is using the computer, they pick their
   own name from the list, so their history stays theirs.

What comes over: every record in every section, the whole posting log, the whole audit log (who made each
change and when), and people's names. Importing the same file again adds nothing twice.

What doesn't: files added under **Library → Files** in the old Windows app, because they aren't in the backup
file. To bring those too, use the old app's automatic full backup instead of steps 1 and 3: copy the newest
`lux-backup-….json` **and** the `Library files` folder from the old app's `backups` folder into the new Lux's
backups folder (**Settings → Backups → Open folder**), then **Settings → Restore a backup**. A restore replaces
everything in the new Lux, so do it before anyone starts working in it.

## The signing key

`lux-update-signing-key.json` proves an update really comes from you. Lux refuses updates without a valid signature.

- **Never commit it or upload it to GitHub as a file.** `.gitignore` blocks the usual file names, but check
  before every commit.
- **Keep it in your password manager**, not in the shared data folder.
- **For updates from GitHub:** store it as a repository **secret**, which GitHub keeps hidden:
  1. On the repository page, open **Settings** (the tab with the gear), then
     **Secrets and variables → Actions → New repository secret**.
  2. Name: `LUX_SIGNING_KEY`.
  3. Secret: open the key file in Notepad or TextEdit, copy everything in it and paste it here. **Add secret**.

  Every release then includes the signed `lux-update-<version>.luxupdate` and Lux installs it by itself.
  The trade-off: anyone who takes over the GitHub account could publish updates. Only do this with
  two-factor authentication on every account that has access to the repository. Without the secret, sign
  each release on your own computer and add the `.luxupdate` to it.
- **If the key is lost or ends up somewhere it shouldn't** (a repository, an email, a chat), make a new one:
  `node scripts/new-signing-key.mjs path/to/new-key.json` writes a new key and puts its public half into
  `src/lux-management.html`. Publish that version once through the shared folder with the old key (it is the
  only key the computers trust until they update), then destroy the old key and replace the secret.
- The key in use since 2.8.1 is the definitive one. 2.8.0 trusted an earlier key, so a computer that still has
  2.8.0 can't install updates signed with this one: install the current version from the release instead.

## Looking up post details online

When a Reddit, TikTok or Instagram link is pasted in the Posting log, Lux asks that platform's public page for
the post's title, views and likes: signed out, from that computer only, one lookup per pasted link (two
requests for TikTok). It never
uses AdsPower, a browser or any account. Whatever a platform refuses (a login page, a block, no connection) is
left for the person to type in, and typed values are never overwritten. Instagram never shows views to
signed-out visitors. Each computer can turn it off in **Settings → Post lookup**. `docs/lookup-spike.md` has the
commands to check, from a given network, which platforms answer.

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
node scripts/sign-update.mjs dist/Lux-Management-2.10.0.neu --key path/to/lux-update-signing-key.json
```

## Running the tests

The tests load the program in a simulated browser (jsdom), so no desktop app is needed. They need Node.js 20.14 or newer:

```
npm install
npm test
```

## Working with Claude

Point Claude at this repository, or upload `src/lux-management.html` and `CHANGELOG.md`, and describe the change.
Ask it to raise `APP_VERSION` and add the changelog entry, then publish a release as above.
