#!/usr/bin/env python3
"""Build Lux Management from src/lux-management.html, for Windows and Mac (there is no Linux version).

Produces, in dist/:
  Lux-Management-<version>.neu          program update (publish it from Settings, or sign it)
  Lux-Management-Windows-<version>.zip  full download for new Windows computers
  Lux-Management-Mac-<version>.dmg      full download for new Macs (only when built on a Mac)
  lux-management-web-<version>.html     the Claude web version
  SHA256SUMS.txt                        fingerprints of everything above
and .tmp/release-notes.md, the text GitHub shows on the release page.

Needs Python 3 and Node.js with the Neutralino CLI:  npm install -g @neutralinojs/neu
The Mac app can only be made on a Mac with the Xcode command line tools (xcode-select --install).
GitHub builds both on a Mac for every release.
"""
import hashlib, json, os, re, shutil, subprocess, sys, tempfile, time, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'src', 'lux-management.html')
APP = os.path.join(ROOT, 'app')
RES = os.path.join(APP, 'resources')
DIST = os.path.join(ROOT, 'dist')
WIN = os.path.join(ROOT, 'release', 'windows')
MAC = os.path.join(ROOT, 'release', 'mac')
FONTS = [('Bodoni Moda', 'bodoni-moda-latin-400-normal', 400, 'normal'), ('Bodoni Moda', 'bodoni-moda-latin-500-normal', 500, 'normal'),
         ('Bodoni Moda', 'bodoni-moda-latin-600-normal', 600, 'normal'), ('Bodoni Moda', 'bodoni-moda-latin-400-italic', 400, 'italic'),
         ('Hanken Grotesk', 'hanken-grotesk-latin-400-normal', 400, 'normal'), ('Hanken Grotesk', 'hanken-grotesk-latin-500-normal', 500, 'normal'),
         ('Hanken Grotesk', 'hanken-grotesk-latin-600-normal', 600, 'normal'), ('Hanken Grotesk', 'hanken-grotesk-latin-700-normal', 700, 'normal')]
CSP = ('<meta http-equiv="Content-Security-Policy" content="default-src \'self\'; script-src \'self\' \'unsafe-inline\'; '
       'style-src \'self\' \'unsafe-inline\'; img-src \'self\' data:; font-src \'self\'; '
       'connect-src \'self\' ws://127.0.0.1:* ws://localhost:* http://127.0.0.1:* http://localhost:* https://api.github.com">\n')


def fail(msg):
    print('ERROR: ' + msg, file=sys.stderr)
    sys.exit(1)


def read_version(html):
    m = re.search(r"const APP_VERSION = '(\d+\.\d+\.\d+)';", html)
    if not m:
        fail("Could not find const APP_VERSION = 'x.y.z'; in src/lux-management.html")
    return m.group(1)


def read_notes(version):
    """Release notes come from CHANGELOG.md: a '## x.y.z' heading, then 'EN:' and 'PT:' lines."""
    path = os.path.join(ROOT, 'CHANGELOG.md')
    text = open(path, encoding='utf-8').read() if os.path.exists(path) else ''
    m = re.search(r'^##\s+' + re.escape(version) + r'\s*$(.*?)(?=^##\s|\Z)', text, re.M | re.S)
    if not m:
        fail(f'CHANGELOG.md has no "## {version}" section. Add one with EN: and PT: lines.')
    block = m.group(1)
    en = re.search(r'^EN:\s*(.+)$', block, re.M)
    pt = re.search(r'^PT:\s*(.+)$', block, re.M)
    if not en:
        fail(f'The "## {version}" section in CHANGELOG.md needs an "EN: ..." line.')
    return {'en': en.group(1).strip(), 'pt': (pt.group(1).strip() if pt else en.group(1).strip())}


def desktop_page(html):
    s = re.sub(r'<link rel="preconnect"[^>]*>\n', '', html)
    s = re.sub(r'<link href="https://fonts.googleapis.com[^>]*>\n', '', s)
    faces = ''.join(f"@font-face{{font-family:'{fam}';font-style:{st};font-weight:{wt};font-display:swap;src:url(fonts/{fn}.woff2) format('woff2')}}\n"
                    for fam, fn, wt, st in FONTS)
    if '<style>\n' not in s or '<script>\n(() => {' not in s:
        fail('src/lux-management.html does not have the expected <style> and <script> blocks.')
    s = s.replace('<style>\n', CSP + '<style>\n' + faces, 1)
    s = s.replace('<script>\n(() => {', '<script src="js/neutralino.js"></script>\n<script>\n(() => {', 1)
    return s


def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 16), b''):
            h.update(chunk)
    return h.hexdigest()


def run(cmd, **kw):
    subprocess.run(cmd, check=True, **kw)


def build_program(html, version, notes):
    """Makes resources.neu, the program file that every Lux install runs, and returns its path."""
    open(os.path.join(RES, 'index.html'), 'w', encoding='utf-8').write(desktop_page(html))
    json.dump({'version': version, 'notes': notes}, open(os.path.join(RES, 'release.json'), 'w', encoding='utf-8'), ensure_ascii=False)
    cfg_path = os.path.join(APP, 'neutralino.config.json')
    cfg = json.load(open(cfg_path, encoding='utf-8'))
    cfg['version'] = version
    json.dump(cfg, open(cfg_path, 'w', encoding='utf-8'), indent=2)

    neu = shutil.which('neu') or fail('The Neutralino CLI is missing. Install it with: npm install -g @neutralinojs/neu')
    bin_dir = os.path.join(APP, 'bin')
    if not os.path.exists(os.path.join(RES, 'js', 'neutralino.js')) or not os.path.exists(os.path.join(bin_dir, 'neutralino-mac_universal')):
        subprocess.run([neu, 'update'], cwd=APP, check=True)
    for name in os.listdir(bin_dir):  # Windows and Mac only
        if name.startswith('neutralino-linux'):
            os.remove(os.path.join(bin_dir, name))
    shutil.rmtree(os.path.join(APP, 'dist'), ignore_errors=True)
    subprocess.run([neu, 'build'], cwd=APP, check=True)
    built = os.path.join(APP, 'dist', 'LuxManagement', 'resources.neu')
    if not os.path.exists(built):
        fail('The build did not produce resources.neu.')
    return built


def windows_zip(version, built):
    out = os.path.join(DIST, f'Lux-Management-Windows-{version}.zip')
    readme = open(os.path.join(WIN, 'README.txt'), encoding='utf-8').read()
    readme = readme.replace('LUX MANAGEMENT DESKTOP APP', f'LUX MANAGEMENT {version} — DESKTOP APP', 1).replace('LUX MANAGEMENT APP PARA DESKTOP', f'LUX MANAGEMENT {version} — APP PARA DESKTOP', 1)
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
        z.write(os.path.join(WIN, 'LuxManagement.exe'), 'Lux Management/LuxManagement.exe')
        z.write(built, 'Lux Management/resources.neu')
        z.writestr('Lux Management/README.txt', readme.replace('\r\n', '\n').replace('\n', '\r\n'))
    return out


def minimum_macos(binary):
    """The oldest macOS the Neutralino runtime was built for, read from the file itself.
    Never below 11.0, the first version for Apple Silicon Macs."""
    found = ['11.0']
    for cmd in (['vtool', '-show-build', binary], ['otool', '-l', binary]):
        try:
            info = subprocess.run(cmd, capture_output=True, text=True).stdout
        except OSError:
            continue
        found += re.findall(r'^\s*minos\s+(\d+(?:\.\d+)*)', info, re.M)
        found += re.findall(r'cmd LC_VERSION_MIN_MACOSX\s+cmdsize \d+\s+version (\d+(?:\.\d+)*)', info)
    return max(found, key=lambda v: [int(x) for x in v.split('.')])


def mac_dmg(version, built):
    """Lux Management.app on a disk image. Needs a Mac: clang, sips, iconutil, codesign and hdiutil."""
    runtime = os.path.join(APP, 'bin', 'neutralino-mac_universal')
    if not os.path.exists(runtime):
        fail('The Mac program file is missing. Run "neu update" in the app folder.')
    stage = tempfile.mkdtemp(prefix='lux-mac-')
    try:
        disk = os.path.join(stage, 'disk')
        app = os.path.join(disk, 'Lux Management.app')
        macos, res = os.path.join(app, 'Contents', 'MacOS'), os.path.join(app, 'Contents', 'Resources')
        os.makedirs(macos)
        os.makedirs(res)
        minos = minimum_macos(runtime)
        shutil.copy(runtime, os.path.join(macos, 'LuxManagement'))
        os.chmod(os.path.join(macos, 'LuxManagement'), 0o755)
        run(['clang', '-Os', '-Wall', '-arch', 'x86_64', '-arch', 'arm64', f'-mmacosx-version-min={minos}',
             '-o', os.path.join(macos, 'Lux Management'), os.path.join(MAC, 'launcher.c')])
        shutil.copy(built, os.path.join(res, 'resources.neu'))
        plist = open(os.path.join(MAC, 'Info.plist'), encoding='utf-8').read()
        open(os.path.join(app, 'Contents', 'Info.plist'), 'w', encoding='utf-8').write(plist.replace('{version}', version).replace('{minimum_macos}', minos))

        iconset = os.path.join(stage, 'AppIcon.iconset')
        os.makedirs(iconset)
        for size in (16, 32, 128, 256, 512):
            for scale in (1, 2):
                name = f'icon_{size}x{size}' + ('@2x' if scale == 2 else '') + '.png'
                run(['sips', '-z', str(size * scale), str(size * scale), os.path.join(RES, 'icons', 'appIcon.png'),
                     '--out', os.path.join(iconset, name)], stdout=subprocess.DEVNULL)
        run(['iconutil', '-c', 'icns', iconset, '-o', os.path.join(res, 'AppIcon.icns')])

        # Not notarized, so signed "ad hoc": enough for Apple Silicon Macs to run it.
        run(['xattr', '-cr', app])
        run(['codesign', '--force', '--sign', '-', os.path.join(macos, 'LuxManagement')])
        run(['codesign', '--force', '--sign', '-', app])
        run(['codesign', '--verify', '--strict', app])

        os.symlink('/Applications', os.path.join(disk, 'Applications'))
        readme = open(os.path.join(MAC, 'README.txt'), encoding='utf-8').read()
        readme = readme.replace('LUX MANAGEMENT FOR MAC', f'LUX MANAGEMENT {version} FOR MAC', 1).replace('LUX MANAGEMENT PARA MAC', f'LUX MANAGEMENT {version} PARA MAC', 1)
        open(os.path.join(disk, 'README.txt'), 'w', encoding='utf-8').write(readme.replace('{minimum_macos}', minos))

        out = os.path.join(DIST, f'Lux-Management-Mac-{version}.dmg')
        for attempt in range(5):  # hdiutil sometimes reports "Resource busy" on GitHub's Macs
            made = subprocess.run(['hdiutil', 'create', '-volname', 'Lux Management', '-srcfolder', disk, '-ov',
                                   '-format', 'UDZO', '-fs', 'HFS+', out]).returncode == 0
            if made:
                return out
            time.sleep(5)
        fail('The Mac disk image could not be made.')
    finally:
        shutil.rmtree(stage, ignore_errors=True)


def release_notes(version, notes):
    return (f'EN: {notes["en"]}\nPT: {notes["pt"]}\n\n'
            '### Download\n'
            f'- **Windows:** `Lux-Management-Windows-{version}.zip`. Unzip it and open `LuxManagement.exe`.\n'
            f'- **Mac:** `Lux-Management-Mac-{version}.dmg`. Open it and drag Lux Management to Applications.\n'
            '- **Already using Lux?** It installs updates itself: **Settings → Program updates**.\n\n'
            '### Baixar\n'
            f'- **Windows:** `Lux-Management-Windows-{version}.zip`. Descompacte e abra o `LuxManagement.exe`.\n'
            f'- **Mac:** `Lux-Management-Mac-{version}.dmg`. Abra e arraste o Lux Management para Aplicativos.\n'
            '- **Já usa o Lux?** Ele instala as atualizações sozinho: **Configurações → Atualizações do programa**.\n')


def main():
    html = open(SRC, encoding='utf-8').read()
    version = read_version(html)
    notes = read_notes(version)
    tag = os.environ.get('RELEASE_TAG', '').strip()
    if tag and tag.lstrip('vV') != version:
        fail(f'The release tag is {tag} but the program says version {version}. Make them match (tag v{version}).')
    on_mac = sys.platform == 'darwin'
    if not on_mac and os.environ.get('LUX_REQUIRE_MAC'):
        fail('The Mac app can only be made on a Mac.')
    print(f'Building Lux Management {version}')

    built = build_program(html, version, notes)
    shutil.rmtree(DIST, ignore_errors=True)
    os.makedirs(DIST)
    shutil.copy(built, os.path.join(DIST, f'Lux-Management-{version}.neu'))
    windows_zip(version, built)
    if on_mac:
        mac_dmg(version, built)
    else:
        print('NOTE: the Mac app is only made on a Mac. GitHub makes it for every release.')
    shutil.copy(SRC, os.path.join(DIST, f'lux-management-web-{version}.html'))

    with open(os.path.join(DIST, 'SHA256SUMS.txt'), 'w') as f:
        for n in sorted(os.listdir(DIST)):
            if n != 'SHA256SUMS.txt':
                f.write(f'{sha256(os.path.join(DIST, n))}  {n}\n')
        f.write(f'{sha256(os.path.join(WIN, "LuxManagement.exe"))}  LuxManagement.exe (inside the Windows zip; the same file every release)\n')
    os.makedirs(os.path.join(ROOT, '.tmp'), exist_ok=True)
    open(os.path.join(ROOT, '.tmp', 'release-notes.md'), 'w', encoding='utf-8').write(release_notes(version, notes))
    print('Done. Files in dist/:')
    for n in sorted(os.listdir(DIST)):
        print('  ' + n)


if __name__ == '__main__':
    main()
