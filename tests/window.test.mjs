import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { open, fakeNeutralino } from './harness.mjs';

const plain = o => JSON.parse(JSON.stringify(o));
// Where Neutralino up to 2.9.0 kept the window's last spot and opened it there, unchecked.
const OLD_FILE = '/app/.tmp/window_state.config.json';
// Ana's desktop app, with these settings, a window that starts like win, and these other files.
const desk = (settings = {}, win = {}, files = {}) => fakeNeutralino(Object.assign({
  '/app/config/settings.json': Object.assign({ userId: 'u1', lastBackup: Date.now(), githubUpdates: false }, settings),
  '/app/data/people/u1.json': { name: 'Ana', createdAt: 1 }
}, files), { win });
// A 1920x1080 screen with a 40-pixel taskbar at the bottom.
const FULL_HD = { availLeft: 0, availTop: 0, availWidth: 1920, availHeight: 1040 };
const kept = N => N.read('/app/config/settings.json').window;
// The person closes the window (the X button, ⌘Q, or Close window in the Mac menu).
const close = async (L, N) => { N.emit('windowClose'); await L.sleep(300); };

test('Neutralino never puts the window back by itself, and allows every window call Lux makes', () => {
  const cfg = JSON.parse(readFileSync(new URL('../app/neutralino.config.json', import.meta.url), 'utf8'));
  assert.equal(cfg.modes.window.useSavedState, false);
  const src = readFileSync(new URL('../src/lux-management.html', import.meta.url), 'utf8');
  const used = new Set([...src.matchAll(/\bW\.(\w+)\(|Neutralino\.window\.(\w+)/g)].map(m => 'window.' + (m[1] || m[2])));
  assert.ok(used.size >= 9, [...used].join(' '));
  for (const m of used) assert.ok(cfg.nativeAllowList.includes(m), m + ' is not in nativeAllowList');
  // Neutralino's own setSize asks for the size first.
  if (used.has('window.setSize')) assert.ok(cfg.nativeAllowList.includes('window.getSize'));
});

test('Lux knows the window’s starting size from the Neutralino settings', async t => {
  const cfg = JSON.parse(readFileSync(new URL('../app/neutralino.config.json', import.meta.url), 'utf8'));
  const L = await open(); t.after(() => L.close());
  assert.deepEqual(plain(L.w.__lux.START_SIZE), { width: cfg.modes.window.width, height: cfg.modes.window.height });
});

test('windowFit leaves a window that fits, and brings back one that is too big or out of view', async t => {
  const L = await open(); t.after(() => L.close());
  const fit = (...a) => plain(L.w.__lux.windowFit(...a));
  const area = { x: 0, y: 0, w: 1920, h: 1040 }, size = { width: 1320, height: 860 }, middle = { width: 1320, height: 860, x: 300, y: 90 };
  // Inside the screen, nothing saved: left where it is.
  assert.equal(L.w.__lux.windowFit(size, { x: 300, y: 110 }, {}, area), null);
  // On a screen that is no longer there, minimized off the screen, or with its title bar above the screen: the middle.
  assert.deepEqual(fit(size, { x: 2900, y: 200 }, {}, area), middle);
  assert.deepEqual(fit(size, { x: -32000, y: -32000 }, {}, area), middle);
  assert.deepEqual(fit(size, { x: 300, y: -46 }, {}, area), middle);
  assert.deepEqual(fit(size, { x: 1000, y: 110 }, {}, area), middle);
  // The saved size, never bigger than the screen.
  assert.deepEqual(fit(size, { x: 300, y: 110 }, { width: 1000, height: 700 }, area), { width: 1000, height: 700, x: 460, y: 170 });
  assert.deepEqual(fit(size, { x: 300, y: 110 }, { width: 3000, height: 2000 }, area), { width: 1920, height: 1040, x: 0, y: 0 });
  assert.deepEqual(fit({ width: 2500, height: 1400 }, { x: 0, y: 0 }, {}, area), { width: 1920, height: 1040, x: 0, y: 0 });
  // Saved sizes that make no sense are ignored.
  for (const bad of [{ width: 0, height: -5 }, { width: 'big', height: null }, { width: NaN, height: Infinity }, { width: 50, height: 99 }])
    assert.equal(L.w.__lux.windowFit(size, { x: 300, y: 110 }, bad, area), null, JSON.stringify(bad));
  // Never smaller than the window's minimum size (a Mac does not hold a window to it when Lux sets the size).
  const withMin = { width: 1320, height: 860, minWidth: 480, minHeight: 560 };
  assert.deepEqual(fit(withMin, { x: 300, y: 110 }, { width: 300, height: 200 }, area), { width: 480, height: 560, x: 720, y: 240 });
  // ...unless the screen is smaller still.
  assert.deepEqual(fit(withMin, { x: 0, y: 0 }, {}, { x: 0, y: 0, w: 800, h: 500 }), { width: 800, height: 500, x: 0, y: 0 });
  // An area that does not start at the corner (a Mac's menu bar, a taskbar at the top or on the left).
  assert.deepEqual(fit(size, { x: 60, y: 20 }, {}, { x: 0, y: 25, w: 1440, h: 805 }), { width: 1320, height: 805, x: 60, y: 25 });
  assert.deepEqual(fit(size, { x: 0, y: 110 }, {}, { x: 62, y: 0, w: 1858, h: 1080 }), { width: 1320, height: 860, x: 331, y: 110 });
});

test('screenArea is in screen pixels on Windows, whatever the page zoom, and in points on a Mac', async t => {
  // Where Neutralino has just put its 1320x860 window: in the middle of a 1920x1080 main screen (in screen pixels).
  const centered = { x: 300, y: 110 };
  // That screen at 150%, as the page sees it in CSS pixels, with a taskbar at the top.
  const scaled = { width: 1280, height: 720, availLeft: 0, availTop: 25, availWidth: 1280, availHeight: 672 };
  const area = async (os, dpr, sc, pos = centered) => {
    const L = await open({ neutralino: desk(), os, dpr, screen: sc });
    try { return plain(L.w.__lux.screenArea(pos)); } finally { L.close(); }
  };
  // Windows at 150%: 1280 CSS pixels are 1920 screen pixels...
  assert.deepEqual(await area('Windows', 1.5, scaled), { x: 0, y: 38, w: 1920, h: 1008 });
  // ...also when the page is zoomed to 150% with Ctrl and +, which makes devicePixelRatio 2.25.
  assert.deepEqual(await area('Windows', 2.25, scaled), { x: 0, y: 38, w: 1920, h: 1008 });
  // Windows at 100%.
  assert.deepEqual(await area('Windows', 1, { width: 1920, height: 1080, availLeft: 0, availTop: 0, availWidth: 1920, availHeight: 1040 }), { x: 0, y: 0, w: 1920, h: 1040 });
  // A scale that makes no sense (a page that reports another screen): never beyond the main screen.
  assert.deepEqual(await area('Windows', 1, { width: 640, height: 400, availLeft: 0, availTop: 0, availWidth: 640, availHeight: 400 }), { x: 0, y: 0, w: 1920, h: 1080 });
  // No screen width to work from: devicePixelRatio it is.
  assert.deepEqual(await area('Windows', 1.5, { availLeft: 0, availTop: 0, availWidth: 1280, availHeight: 672 }), { x: 0, y: 0, w: 1920, h: 1008 });
  // A 1024x768 screen, smaller than the starting size: Neutralino centers the window as if it were 1320x860, at
  // (-148, -46), though Windows made it smaller.
  assert.deepEqual(await area('Windows', 1, { width: 1024, height: 768, availLeft: 0, availTop: 0, availWidth: 1024, availHeight: 720 }, { x: -148, y: -46 }), { x: 0, y: 0, w: 1024, h: 720 });
  // A Mac: Neutralino and the page both count in points, whatever the Retina scale.
  assert.deepEqual(await area('Darwin', 2, scaled, { x: 60, y: 20 }), { x: 0, y: 25, w: 1280, h: 672 });
  // No usable size (jsdom's screen, or a broken one): no area, so the window is left alone.
  assert.equal(await area('Windows', 1, {}), null);
  assert.equal(await area('Windows', 1, { availWidth: 200, availHeight: 100 }), null);
});

test('desktop: a window that would open out of view comes back to the middle of the screen', async t => {
  const N = desk({}, { x: 2900, y: 200 }, { [OLD_FILE]: { x: 2900, y: 200, width: 1320, height: 860, maximize: false } });
  const L = await open({ neutralino: N, screen: FULL_HD }); t.after(() => L.close());
  assert.deepEqual(N.winCalls, [['move', 300, 90]]);
  // Neutralino's own saved spot is gone, so even going back to an older version opens the window in view.
  assert.equal(N.files.has(OLD_FILE), false);
  assert.deepEqual(L.errors, []);
});

test('desktop: a window that fits is left where it is', async t => {
  const N = desk({ window: { width: 1320, height: 860, maximized: false } });
  const L = await open({ neutralino: N, screen: FULL_HD }); t.after(() => L.close());
  assert.deepEqual(N.winCalls, []);
  assert.deepEqual(L.errors, []);
});

test('desktop: the saved size is used but never bigger than the screen, and a maximized window opens maximized', async t => {
  const N = desk({ window: { width: 3000, height: 2000, maximized: true } }, { x: 23, y: -46 });
  const L = await open({ neutralino: N, screen: { availLeft: 0, availTop: 0, availWidth: 1366, availHeight: 728 } }); t.after(() => L.close());
  assert.deepEqual(N.winCalls, [['setSize', 1366, 728], ['move', 0, 0], ['maximize']]);
  assert.deepEqual(L.errors, []);
});

test('desktop: a Windows screen at 150% (zoomed or not) and a Mac with a menu bar', async t => {
  // Windows at 150%: the area is 1920x1008 screen pixels, so a saved 1600x1000 window fits and goes in the middle,
  // also when the page was left zoomed in.
  const win150 = { width: 1280, height: 720, availLeft: 0, availTop: 0, availWidth: 1280, availHeight: 672 };
  let N, L;
  for (const dpr of [1.5, 2.25, 4.5]){
    N = desk({ window: { width: 1600, height: 1000, maximized: false } });
    L = await open({ neutralino: N, os: 'Windows', dpr, screen: win150 });
    assert.deepEqual(N.winCalls, [['setSize', 1600, 1000], ['move', 160, 4]], 'devicePixelRatio ' + dpr);
    L.close();
  }
  // A Mac's 1440x900 screen with a 25-point menu bar and the Dock: a window too tall for it gets the height there is,
  // and the Mac centers it below the menu bar when its size is set.
  N = desk({}, { x: 60, y: 20 });
  L = await open({ neutralino: N, os: 'Darwin', dpr: 2, screen: { availLeft: 0, availTop: 25, availWidth: 1440, availHeight: 805 } });
  assert.deepEqual(N.winCalls, [['setSize', 1320, 805]]);
  L.close();
  // A Mac window out of view at its saved size: the size is set again, which brings it back to the middle.
  N = desk({ window: { width: 1000, height: 700 } }, { x: 2900, y: 200, width: 1000, height: 700 });
  L = await open({ neutralino: N, os: 'Darwin', dpr: 2, screen: { availLeft: 0, availTop: 25, availWidth: 1440, availHeight: 805 } });
  assert.deepEqual(N.winCalls, [['setSize', 1000, 700]]);
  // In view at its saved size: left alone.
  L.close();
  N = desk({ window: { width: 1000, height: 700 } }, { x: 220, y: 100, width: 1000, height: 700 });
  L = await open({ neutralino: N, os: 'Darwin', dpr: 2, screen: { availLeft: 0, availTop: 25, availWidth: 1440, availHeight: 805 } });
  assert.deepEqual(N.winCalls, []);
  assert.deepEqual(L.errors, []);
  L.close();
});

test('desktop: closing Lux keeps the window size for next time, but not a minimized or full-screen window’s', async t => {
  const N = desk({ window: { width: 1000, height: 700, maximized: false } });
  const L = await open({ neutralino: N, screen: FULL_HD }); t.after(() => L.close());
  assert.deepEqual(N.winCalls, [['setSize', 1000, 700], ['move', 460, 170]]);
  // Ana makes the window bigger, then closes Lux.
  Object.assign(N.win, { width: 1500, height: 900 });
  await close(L, N);
  assert.deepEqual(kept(N), { width: 1500, height: 900, maximized: false });
  assert.equal(N.exited, 1);
  // Maximized: the size from before stays, for when she un-maximizes it.
  Object.assign(N.win, { maximized: true, width: 1920, height: 1040 });
  await close(L, N);
  assert.deepEqual(kept(N), { width: 1500, height: 900, maximized: true });
  // Minimized, or full screen on a Mac: what was kept before stays.
  Object.assign(N.win, { maximized: false, minimized: true, width: 160, height: 28 });
  await close(L, N);
  Object.assign(N.win, { minimized: false, fullScreen: true, width: 1920, height: 1080 });
  await close(L, N);
  assert.deepEqual(kept(N), { width: 1500, height: 900, maximized: true });
  assert.equal(N.exited, 4);
  assert.deepEqual(L.errors, []);
});

test('desktop: a Windows screen smaller than the starting size gets a window as big as the screen allows', async t => {
  // What GitHub's Windows computer showed: a 1024x768 screen with a 48-pixel taskbar. Neutralino centered the window
  // as if it were 1320x860, at (-148, -46); Windows made it 1044x788, the most it allows there.
  const N = desk({ window: { width: 5000, height: 4000, maximized: false } }, { x: -148, y: -46, width: 1044, height: 788 });
  const L = await open({ neutralino: N, os: 'Windows', dpr: 1, screen: { width: 1024, height: 768, availLeft: 0, availTop: 0, availWidth: 1024, availHeight: 720 } });
  t.after(() => L.close());
  assert.deepEqual(N.winCalls, [['setSize', 1024, 720], ['move', 0, 0]]);
});

test('desktop: closing Lux writes only the window entry, into the settings as they are now, and only when it changed', async t => {
  const CFG = '/app/config/settings.json';
  const N = desk({ window: { width: 1000, height: 700, maximized: false } });
  const L = await open({ neutralino: N, screen: FULL_HD }); t.after(() => L.close());
  // Another Lux window on this computer moves the data folder and switches user while this one is open.
  N.write(CFG, Object.assign(N.read(CFG), { dataDir: '/shared/drive', userId: 'u9' }));
  Object.assign(N.win, { width: 1200, height: 800 });
  await close(L, N);
  assert.equal(N.read(CFG).dataDir, '/shared/drive');
  assert.equal(N.read(CFG).userId, 'u9');
  assert.deepEqual(kept(N), { width: 1200, height: 800, maximized: false });
  assert.equal(N.files.has(CFG + '.tmp'), false);
  // The same size again: the file is not touched.
  const at = N.mtime.get(CFG);
  await close(L, N);
  assert.equal(N.mtime.get(CFG), at);
  assert.equal(N.exited, 2);
});

test('desktop: switching user (Lux restarts) keeps the window size too', async t => {
  const CFG = '/app/config/settings.json';
  const N = desk({ window: { width: 1000, height: 700, maximized: false } });
  const L = await open({ neutralino: N, screen: FULL_HD }); t.after(() => L.close());
  Object.assign(N.win, { width: 1100, height: 750 });
  await L.go('#settings');
  L.click(L.button('Switch user'));
  await L.sleep(100);
  L.click(L.$$('.modal button').find(b => b.textContent === 'Switch user'));
  await L.sleep(400);
  assert.equal(N.restarted, 1);
  assert.equal(N.read(CFG).userId, '');
  assert.deepEqual(kept(N), { width: 1100, height: 750, maximized: false });
  assert.deepEqual(L.errors, []);
});

test('desktop: coming from 2.9.0, the size and maximized state Neutralino kept are used once, never its spot', async t => {
  const N = desk({}, {}, { [OLD_FILE]: { x: 6000, y: 4000, width: 1000, height: 700, maximize: true } });
  const L = await open({ neutralino: N, screen: FULL_HD }); t.after(() => L.close());
  assert.deepEqual(N.winCalls, [['setSize', 1000, 700], ['move', 460, 170], ['maximize']]);
  assert.equal(N.files.has(OLD_FILE), false);
  // Lux's own entry wins over an old file.
  const N2 = desk({ window: { width: 1320, height: 860, maximized: false } }, {}, { [OLD_FILE]: { x: 0, y: 0, width: 1000, height: 700, maximize: true } });
  const L2 = await open({ neutralino: N2, screen: FULL_HD }); t.after(() => L2.close());
  assert.deepEqual(N2.winCalls, []);
  assert.equal(N2.files.has(OLD_FILE), false);
});

test('desktop: a window that opens maximized is left maximized', async t => {
  const N = desk({ window: { width: 1000, height: 700, maximized: false } }, { maximized: true, x: -8, y: -8, width: 1936, height: 1056 });
  const L = await open({ neutralino: N, screen: FULL_HD }); t.after(() => L.close());
  assert.deepEqual(N.winCalls, []);
});

test('desktop: Lux opens even if the window never answers when it starts', async t => {
  const N = desk();
  N.window.getSize = () => new Promise(() => {});
  const L = await open({ neutralino: N, screen: FULL_HD }); t.after(() => L.close());
  // Lux waits for the window for 2 seconds at most, then carries on, and handles closing.
  await L.sleep(2200);
  N.emit('windowClose');
  await L.sleep(2000);
  assert.equal(N.exited, 1);
});

test('desktop: a damaged window entry in the settings file is ignored', async t => {
  for (const bad of ['big', 7, null, [1, 2]]){
    const N = desk({ window: bad });
    const L = await open({ neutralino: N, screen: FULL_HD });
    assert.deepEqual(N.winCalls, [], JSON.stringify(bad));
    N.win.maximized = true;
    await close(L, N);
    assert.deepEqual(kept(N), { maximized: true }, JSON.stringify(bad));
    assert.deepEqual(L.errors, []);
    L.close();
  }
});

test('desktop: Lux still opens and closes when the window can’t be measured', async t => {
  const N = desk({ window: { width: 1000, height: 700, maximized: true } }, { fail: true });
  const L = await open({ neutralino: N, screen: FULL_HD }); t.after(() => L.close());
  assert.ok(L.$('#side .navi'), 'the workspace opened');
  await close(L, N);
  assert.equal(N.exited, 1);
  assert.deepEqual(kept(N), { width: 1000, height: 700, maximized: true });
  assert.deepEqual(L.errors, []);
});

test('desktop: Lux closes even if the window never answers', async t => {
  const N = desk();
  const L = await open({ neutralino: N, screen: FULL_HD }); t.after(() => L.close());
  N.window.isMinimized = () => new Promise(() => {});
  N.emit('windowClose');
  await L.sleep(800);
  assert.equal(N.exited, 0);
  await L.sleep(1200);
  assert.equal(N.exited, 1);
  assert.equal(kept(N), undefined);
});
