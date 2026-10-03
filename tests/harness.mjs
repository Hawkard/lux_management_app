import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';

const SRC = new URL('../src/lux-management.html', import.meta.url);
export const sleep = ms => new Promise(r => setTimeout(r, ms));

// claude: optional stand-in for the Claude artifact runtime (window.claude), to run the web version.
// neutralino: optional stand-in for Neutralino (window.Neutralino), to run the desktop version with its program
// folder at /app (so its data folder is /app/data unless the settings file says otherwise), on the system os
// ('Linux', 'Windows' or 'Darwin' for a Mac).
// screen: optional part of the screen a window can use ({availLeft, availTop, availWidth, availHeight} in CSS pixels;
// jsdom's are all 0), and dpr the screen's scale (window.devicePixelRatio, 1.5 for a Windows screen at 150%).
export async function open({ seed = {}, lang, claude, neutralino, os = 'Linux', screen, dpr } = {}) {
  const html = readFileSync(SRC, 'utf8');
  const errors = [];
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://lux.test/',
    beforeParse(w) {
      w.addEventListener('error', e => errors.push(e.message));
      w.localStorage.setItem('lux-local-v1', JSON.stringify(seed));
      if (lang) w.localStorage.setItem('lux-lang', lang);
      if (claude) w.claude = claude;
      // The desktop app's WebView has TextDecoder and TextEncoder; jsdom's window does not.
      if (neutralino){ w.NL_OS = os; w.NL_PATH = '/app'; w.Neutralino = neutralino; w.TextDecoder = TextDecoder; w.TextEncoder = TextEncoder; }
      for (const [k, v] of Object.entries(screen || {})) Object.defineProperty(w.screen, k, { value: v, configurable: true });
      if (dpr) Object.defineProperty(w, 'devicePixelRatio', { value: dpr, configurable: true });
    }
  });
  const w = dom.window;
  w.document.execCommand = () => true;
  await sleep(400);
  const $ = s => w.document.querySelector(s);
  const $$ = s => [...w.document.querySelectorAll(s)];
  return {
    w, errors, $, $$, sleep,
    click: el => el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })),
    set: (el, v, ev = 'change') => { el.value = v; el.dispatchEvent(new w.Event(ev, { bubbles: true })); },
    button: text => $$('button').find(b => b.textContent === text),
    go: async hash => { w.location.hash = hash; await sleep(250); },
    stored: () => JSON.parse(w.localStorage.getItem('lux-local-v1')),
    close: () => w.close()
  };
}

// A stand-in for the desktop app's Neutralino: files in memory by path, and the events Lux listens to.
// write() changes a file the way the sync of a shared data folder does; emit() fires an event such as watchFile.
// curl: optional stand-in for the curl program, run as `curl -K <config file>`: (url, config) => {code, body} or a
// promise of it, where config holds the config file's settings ('user-agent', 'max-time', ...) and body, when given, is
// written to the config's output file. It can be changed later (N.curl = ...); without it no program runs. Every program
// started is recorded in spawned ({id, command, cwd, config, text}), and every one stopped in killed.
// mtime holds each file's modification time in milliseconds, like Neutralino's getStats; a test may set it.
// win: how the window starts (size and position in Neutralino's units, maximized, minimized, fullScreen); win.fail makes
// every window call fail, as when it is not allowed. winCalls lists every change Lux makes to the window; exited and
// restarted count the times Lux closed or restarted itself.
export function fakeNeutralino(start, { curl, win: winStart } = {}){
  const files = new Map(), dirs = new Set(), mtime = new Map(), handlers = {};
  const spawned = [], killed = [];
  let clock = Date.now(), pids = 0;
  const addDirs = p => { const a = p.split('/'); for (let i = 2; i < a.length; i++) dirs.add(a.slice(0, i).join('/')); };
  // Every write gets a later time than the one before, even within the same millisecond.
  const put = (p, text) => { addDirs(p); files.set(p, text); mtime.set(p, clock = Math.max(clock + 1, Date.now())); };
  for (const [p, v] of Object.entries(start)) put(p, typeof v === 'string' ? v : JSON.stringify(v));
  const missing = () => Promise.reject({ code: 'NE_FS_NOPATHE', message: 'no such file or folder' });
  const emit = (name, detail) => (handlers[name] || []).slice().forEach(fn => fn({ detail }));
  const win = Object.assign({ width: 1320, height: 860, x: 300, y: 110, maximized: false, minimized: false, fullScreen: false, fail: false }, winStart);
  const winCalls = [];
  const winApi = fn => async (...a) => { if (win.fail) throw { code: 'NE_RT_NATPRME', message: 'not allowed' }; return fn(...a); };
  const N = {
    files, mtime, emit, curl, spawned, killed, win, winCalls, exited: 0, restarted: 0,
    read: p => files.has(p) ? JSON.parse(files.get(p)) : undefined,
    write: (p, v) => put(p, JSON.stringify(v)),
    init: () => { setTimeout(() => emit('ready'), 0); },
    events: {
      on: async (name, fn) => { (handlers[name] = handlers[name] || []).push(fn); },
      off: async (name, fn) => { handlers[name] = (handlers[name] || []).filter(x => x !== fn); }
    },
    filesystem: {
      readFile: async p => files.has(p) ? files.get(p) : missing(),
      readBinaryFile: async p => files.has(p) ? new TextEncoder().encode(files.get(p)).buffer : missing(),
      writeFile: async (p, text) => put(p, String(text)),
      writeBinaryFile: async (p, buf) => put(p, new TextDecoder().decode(buf)),
      readDirectory: async p => {
        if (!dirs.has(p)) return missing();
        const names = new Set([...files.keys(), ...dirs].filter(x => x.startsWith(p + '/')).map(x => x.slice(p.length + 1).split('/')[0]));
        return [...names].map(entry => ({ entry, type: dirs.has(p + '/' + entry) ? 'DIRECTORY' : 'FILE' }));
      },
      getStats: async p => files.has(p) ? { size: files.get(p).length, isFile: true, isDirectory: false, modifiedAt: mtime.get(p) }
        : dirs.has(p) ? { size: 0, isFile: false, isDirectory: true, modifiedAt: 0 } : missing(),
      createDirectory: async p => { addDirs(p); dirs.add(p); },
      move: async (a, b) => { if (!files.has(a)) return missing(); put(b, files.get(a)); files.delete(a); },
      copy: async (a, b) => { if (!files.has(a)) return missing(); put(b, files.get(a)); },
      remove: async p => { if (files.has(p)) files.delete(p); else if (dirs.has(p)) dirs.delete(p); else return missing(); },
      getAbsolutePath: async p => p,
      createWatcher: async () => 1
    },
    os: {
      open: async () => {}, showSaveDialog: async (title, o) => o && o.defaultPath, showOpenDialog: async () => [], showFolderDialog: async () => '',
      spawnProcess: async (command, opt = {}) => {
        const m = /^curl -K ([\w.-]+)$/.exec(command);
        if (!N.curl || !m) throw new Error('no programs run in tests');
        const id = ++pids, cwd = opt.cwd, text = files.get(cwd + '/' + m[1]);
        const config = text == null ? null : curlConfig(text);
        spawned.push({ id, command, cwd, config, text });
        Promise.resolve(config ? N.curl(config.url, config) : { code: 26 }).then(res => {
          if (killed.includes(id)) return;
          if (res && typeof res.body === 'string' && config.output) put(cwd + '/' + config.output, res.body);
          emit('spawnedProcess', { id, pid: id, action: 'exit', data: res ? res.code : 0 });
        });
        return { id, pid: id };
      },
      updateSpawnedProcess: async (id, action) => { if (action === 'exit') killed.push(id); }
    },
    app: { exit: async () => { N.exited++; }, restartProcess: async () => { N.restarted++; } },
    window: {
      setMainMenu: async () => {},
      getSize: winApi(() => ({ width: win.width, height: win.height, minWidth: 480, minHeight: 560, maxWidth: -1, maxHeight: -1, resizable: true })),
      setSize: winApi(o => { winCalls.push(['setSize', o.width, o.height]); win.width = o.width; win.height = o.height; }),
      getPosition: winApi(() => ({ x: win.x, y: win.y })),
      move: winApi((x, y) => { winCalls.push(['move', x, y]); win.x = x; win.y = y; }),
      isMaximized: winApi(() => win.maximized),
      maximize: winApi(() => { winCalls.push(['maximize']); win.maximized = true; }),
      isMinimized: winApi(() => win.minimized),
      isFullScreen: winApi(() => win.fullScreen)
    }
  };
  return N;
}
// Reads a curl config file the way curl does: "name = value", "name = \"quoted value\"" or just "name".
function curlConfig(text){
  const out = { header: [] };
  for (const line of text.split('\n')){
    const m = /^([\w-]+)(?:\s*[=:]\s*(?:"((?:[^"\\]|\\.)*)"|(\S.*)))?$/.exec(line.trim());
    if (!m) continue;
    const v = m[2] != null ? m[2].replace(/\\(.)/g, '$1') : m[3] != null ? m[3] : true;
    if (m[1] === 'header') out.header.push(v); else out[m[1]] = v;
  }
  return out;
}
