import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';

const SRC = new URL('../src/lux-management.html', import.meta.url);
export const sleep = ms => new Promise(r => setTimeout(r, ms));

export async function open({ seed = {}, lang } = {}) {
  const html = readFileSync(SRC, 'utf8');
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://lux.test/',
    beforeParse(w) {
      w.localStorage.setItem('lux-local-v1', JSON.stringify(seed));
      if (lang) w.localStorage.setItem('lux-lang', lang);
    }
  });
  const w = dom.window;
  const errors = [];
  w.addEventListener('error', e => errors.push(e.message));
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
    stored: () => JSON.parse(w.localStorage.getItem('lux-local-v1'))
  };
}
