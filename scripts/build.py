#!/usr/bin/env python3
"""Build Lux Management from src/lux-management.html.

Produces, in dist/:
  Lux-Management-<version>.neu          program update (publish it from Settings, or sign it)
  Lux-Management-Windows-<version>.zip  full download for new computers
  lux-management-web-<version>.html     the Claude web version
  SHA256SUMS.txt                        fingerprints of everything above

Needs Python 3 and Node.js with the Neutralino CLI:  npm install -g @neutralinojs/neu
"""
import hashlib, json, os, re, shutil, subprocess, sys, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'src', 'lux-management.html')
APP = os.path.join(ROOT, 'app')
RES = os.path.join(APP, 'resources')
DIST = os.path.join(ROOT, 'dist')
FONTS = [('Bodoni Moda', 'bodoni-moda-latin-400-normal', 400, 'normal'), ('Bodoni Moda', 'bodoni-moda-latin-500-normal', 500, 'normal'),
         ('Bodoni Moda', 'bodoni-moda-latin-600-normal', 600, 'normal'), ('Bodoni Moda', 'bodoni-moda-latin-400-italic', 400, 'italic'),
         ('Hanken Grotesk', 'hanken-grotesk-latin-400-normal', 400, 'normal'), ('Hanken Grotesk', 'hanken-grotesk-latin-500-normal', 500, 'normal'),
         ('Hanken Grotesk', 'hanken-grotesk-latin-600-normal', 600, 'normal'), ('Hanken Grotesk', 'hanken-grotesk-latin-700-normal', 700, 'normal')]
CSP = ('<meta http-equiv="Content-Security-Policy" content="default-src \'self\'; script-src \'self\' \'unsafe-inline\'; '
       'style-src \'self\' \'unsafe-inline\'; img-src \'self\' data:; font-src \'self\'; '
       'connect-src \'self\' ws://127.0.0.1:* ws://localhost:* http://127.0.0.1:* http://localhost:*">\n')


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


def main():
    html = open(SRC, encoding='utf-8').read()
    version = read_version(html)
    notes = read_notes(version)
    tag = os.environ.get('RELEASE_TAG', '').strip()
    if tag and tag.lstrip('vV') != version:
        fail(f'The release tag is {tag} but the program says version {version}. Make them match (tag v{version}).')
    print(f'Building Lux Management {version}')

    open(os.path.join(RES, 'index.html'), 'w', encoding='utf-8').write(desktop_page(html))
    json.dump({'version': version, 'notes': notes}, open(os.path.join(RES, 'release.json'), 'w', encoding='utf-8'), ensure_ascii=False)
    cfg_path = os.path.join(APP, 'neutralino.config.json')
    cfg = json.load(open(cfg_path, encoding='utf-8'))
    cfg['version'] = version
    json.dump(cfg, open(cfg_path, 'w', encoding='utf-8'), indent=2)

    neu = shutil.which('neu') or fail('The Neutralino CLI is missing. Install it with: npm install -g @neutralinojs/neu')
    if not os.path.exists(os.path.join(RES, 'js', 'neutralino.js')) or not os.path.isdir(os.path.join(APP, 'bin')):
        subprocess.run([neu, 'update'], cwd=APP, check=True)
    shutil.rmtree(os.path.join(APP, 'dist'), ignore_errors=True)
    subprocess.run([neu, 'build', '--release'], cwd=APP, check=True)
    built = os.path.join(APP, 'dist', 'LuxManagement', 'resources.neu')
    if not os.path.exists(built):
        fail('The build did not produce resources.neu.')

    shutil.rmtree(DIST, ignore_errors=True)
    os.makedirs(DIST)
    neu_out = os.path.join(DIST, f'Lux-Management-{version}.neu')
    shutil.copy(built, neu_out)

    zip_out = os.path.join(DIST, f'Lux-Management-Windows-{version}.zip')
    readme = open(os.path.join(ROOT, 'release', 'README.txt'), encoding='utf-8').read()
    readme = readme.replace('LUX MANAGEMENT DESKTOP APP', f'LUX MANAGEMENT {version} — DESKTOP APP', 1).replace('LUX MANAGEMENT APP PARA DESKTOP', f'LUX MANAGEMENT {version} — APP PARA DESKTOP', 1)
    with zipfile.ZipFile(zip_out, 'w', zipfile.ZIP_DEFLATED) as z:
        z.write(os.path.join(ROOT, 'release', 'LuxManagement.exe'), 'Lux Management/LuxManagement.exe')
        z.write(built, 'Lux Management/resources.neu')
        z.writestr('Lux Management/README.txt', readme.replace('\r\n', '\n').replace('\n', '\r\n'))

    web_out = os.path.join(DIST, f'lux-management-web-{version}.html')
    shutil.copy(SRC, web_out)

    exe_sha = sha256(os.path.join(ROOT, 'release', 'LuxManagement.exe'))
    with open(os.path.join(DIST, 'SHA256SUMS.txt'), 'w') as f:
        for p in (neu_out, zip_out, web_out):
            f.write(f'{sha256(p)}  {os.path.basename(p)}\n')
        f.write(f'{exe_sha}  LuxManagement.exe (inside the zip; the same file every release)\n')
    print('Done. Files in dist/:')
    for n in sorted(os.listdir(DIST)):
        print('  ' + n)


if __name__ == '__main__':
    main()
