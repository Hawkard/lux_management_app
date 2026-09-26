import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';

const SRC = new URL('../src/lux-management.html', import.meta.url);
export const sleep = ms => new Promise(r => setTimeout(r, ms));

// claude: optional stand-in for the Claude artifact runtime (window.claude), to run the web version.
// neutralino: optional stand-in for Neutralino (window.Neutralino), to run the desktop version with its program
// folder at /app (so its data folder is /app/data unless the settings file says otherwise).
export async function open({ seed = {}, lang, claude, neutralino } = {}) {
  const html = readFileSync(SRC, 'utf8');
  const errors = [];
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://lux.test/',
    beforeParse(w) {
      w.addEventListener('error', e => errors.push(e.message));
      w.localStorage.setItem('lux-local-v1', JSON.stringify(seed));
      if (lang) w.localStorage.setItem('lux-lang', lang);
      if (claude) w.claude = claude;
      if (neutralino){ w.NL_OS = 'Linux'; w.NL_PATH = '/app'; w.Neutralino = neutralino; }
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
