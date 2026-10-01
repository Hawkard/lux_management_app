import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { open, fakeNeutralino } from './harness.mjs';

const oembed = readFileSync(new URL('./fixtures/reddit-oembed.json', import.meta.url), 'utf8');
const TITLE = 'Spooky night 🖤✨ (f) “boo”';
const LINK = 'https://www.reddit.com/r/goth/comments/abc123/spooky_night/';
const OEMBED = id => `https://www.reddit.com/oembed?url=https://www.reddit.com/r/goth/comments/${id}/`;
const LOOKING = '… Looking up post details';
const FOUND = '✓ Details from Reddit';
const FAILED = '! Couldn’t look up this post online. Type the details in.';
const ava = { name: 'Ava', status: 'Active', niche: [], nsfwSubs: [], sfwSubs: [], platforms: ['Reddit'], employees: [] };

const field = (L, lab) => L.$$('.logform label').find(l => l.childNodes[0].textContent === lab).querySelector('select,input');
const chips = L => L.$$('.logform .found .fchip').map(c => c.textContent);
const logged = L => Object.entries(L.stored()).filter(([k]) => k.startsWith('posts/')).flatMap(([, v]) => v.entries);
// Pastes into the Link box the way a browser does: a paste event, then the text, then an input event.
function paste(L, text){
  const link = field(L, 'Link');
  link.dispatchEvent(new L.w.Event('paste', { bubbles: true }));
  link.value = text;
  link.dispatchEvent(new L.w.Event('input', { bubbles: true }));
}
const logPost = async L => { L.click(L.$('.logform button[type=submit]')); await L.sleep(300); };
// Stands in for the lookup's downloads, answering only when the test says so. calls lists every address asked for.
function heldFetcher(){
  const calls = [], waiting = new Map();
  let active = 0, most = 0;
  return {
    calls, most: () => most,
    fetch: url => { calls.push(url); most = Math.max(most, ++active); return new Promise(r => waiting.set(url, r)); },
    answer: (url, text) => { const r = waiting.get(url); assert.ok(r, 'nothing asked for ' + url); waiting.delete(url); active--; r(text); }
  };
}
const DATA = '/app/data';
// The desktop app (Ana on this computer) with these documents in its data folder, and a stand-in for curl.
const desk = (docs, curl, settings = {}, files = {}) => fakeNeutralino(Object.assign({
  '/app/config/settings.json': Object.assign({ userId: 'u1', lastBackup: Date.now(), githubUpdates: false }, settings),
  [DATA + '/people/u1.json']: { name: 'Ana', createdAt: 1 }
}, Object.fromEntries(Object.entries(docs).map(([p, v]) => [DATA + '/' + p + '.json', v])), files), { curl });
const lookupFiles = N => [...N.files.keys()].filter(p => p.startsWith('/app/lookup/'));
// The web version (the Claude artifact): its database holds these documents and answers a one-time read of the posting
// log after slowGet milliseconds. There is no Neutralino.
function webClaude(docs, slowGet = 0){
  const copy = o => JSON.parse(JSON.stringify(o));
  const snap = (col, keep) => ({ docs: Object.keys(docs).filter(p => p.slice(0, p.lastIndexOf('/')) === col && keep(docs[p]))
    .map(p => ({ id: p.slice(p.lastIndexOf('/') + 1), exists: true, data: () => copy(docs[p]) })) });
  const query = (col, keep = () => true) => ({
    where: (f, op, v) => query(col, r => keep(r) && (op === 'in' ? v.includes(r[f]) : op === '==' ? r[f] === v : true)),
    orderBy: () => query(col, keep), limit: () => query(col, keep),
    get: async () => { if (col === 'posts') await new Promise(r => setTimeout(r, slowGet)); return snap(col, keep); },
    onSnapshot: next => { setTimeout(() => next(snap(col, keep)), 0); return () => {}; }
  });
  const doc = p => ({ get: async () => ({ id: p.split('/').pop(), exists: p in docs, data: () => docs[p] && copy(docs[p]) }),
    set: async d => { docs[p] = copy(d); }, update: async d => { Object.assign(docs[p], copy(d)); }, delete: async () => { delete docs[p]; } });
  return { use: async name => name === 'db' ? { collection: c => query(c), doc } : null };
}
const deskErrors = L => L.errors.concat(L.$('.updbar.bad') ? ['crash bar shown'] : []);

test('parseRedditOembed keeps emojis and punctuation exactly', async t => {
  const L = await open(); t.after(() => L.close());
  const { parseRedditOembed } = L.w.__lux;
  const r = parseRedditOembed(oembed);
  assert.ok(r && r.title.length > 0);
  assert.equal(r.title, TITLE);
  assert.equal(parseRedditOembed('<html>blocked</html>'), null);
  assert.equal(parseRedditOembed('{"title":""}'), null);
  for (const bad of ['', 'null', '[]', '"title"', '{"title":42}', '{"title":"   "}', '{"error":403,"message":"Forbidden"}', '{"title":"Spooky'])
    assert.equal(parseRedditOembed(bad), null, bad);
  // Escaped characters come back as themselves, and a title is one line of at most 300 characters.
  assert.equal(parseRedditOembed('{"title":"Tom &amp; Jerry &lt;3 &quot;hi&quot; &#x2728; &#128420;"}').title, 'Tom & Jerry <3 "hi" ✨ 🖤');
  assert.equal(parseRedditOembed('{"title":"  Two\\nlines  "}').title, 'Two lines');
  const long = parseRedditOembed(JSON.stringify({ title: 'a'.repeat(299) + '🖤🖤' })).title;
  assert.equal(long, 'a'.repeat(299) + '🖤');
});

test('LOOKUP_URL_RE only allows safe platform URLs', async t => {
  const L = await open(); t.after(() => L.close());
  const re = L.w.__lux.LOOKUP_URL_RE;
  assert.ok(re.test('https://www.reddit.com/oembed?url=https://www.reddit.com/r/goth/comments/abc123/'));
  for (const good of ['https://www.tiktok.com/oembed?url=https://www.tiktok.com/@ava.rose_x/video/7231338487075638570',
    'https://www.tiktok.com/@ava.rose_x/video/7231338487075638570', 'https://www.instagram.com/p/C9x-Ab_12/'])
    assert.ok(re.test(good), good);
  for (const bad of ['https://evil.com/x', 'https://www.reddit.com/a b', 'https://www.reddit.com/%2F', 'https://www.reddit.com/x"&calc', 'https://www.reddit.com/x&y',
    'http://www.reddit.com/r/goth/', 'https://reddit.com/r/goth/', 'https://www.reddit.com.evil.com/x', 'https://www.reddit.com', 'https://www.youtube.com/watch?v=x',
    'https://www.reddit.com/x\nurl = "https://evil.com/"', 'https://www.reddit.com/x\\', "https://www.reddit.com/x'", 'https://www.reddit.com/x#y',
    'https://www.reddit.com/x;calc', 'https://www.reddit.com/x|calc', 'https://www.reddit.com/$(calc)', 'https://www.reddit.com/`calc`',
    'https://www.reddit.com/{a,b}', 'https://www.reddit.com/[1-9]', 'https://www.reddit.com/x<y>', 'https://www.reddit.com/x\ty', 'https://www.reddit.com/é', ' https://www.reddit.com/x'])
    assert.equal(re.test(bad), false, bad);
});

test('slug titles keep accented letters and pasted titles keep emojis', async t => {
  const L = await open({ seed: { 'models/m1': { name: 'Ava', status: 'Active', niche: [], nsfwSubs: [], sfwSubs: [], platforms: ['Reddit'], employees: [] } } });
  t.after(() => L.close());
  assert.equal(L.w.__lux.slugTitle('caf%C3%A9_na_praia'), 'Café na praia');
  await L.go('#posts');
  const field = lab => L.$$('.logform label').find(l => l.childNodes[0].textContent === lab).querySelector('select,input');
  L.set(field('Link'), 'https://www.reddit.com/r/goth/comments/abc123/spooky_night/', 'input'); await L.sleep(150);
  L.set(field('Post Title'), 'Spooky night 🖤✨ “boo”', 'input');
  L.set(field('Model'), 'm1');
  L.click(L.$('.logform button[type=submit]')); await L.sleep(300);
  assert.ok(L.$('.entry .etitle').textContent.includes('🖤✨ “boo”'));
  assert.equal(logged(L)[0].title, 'Spooky night 🖤✨ “boo”');
  assert.deepEqual(L.errors, []);
});

test('a long title is shortened in the list without cutting an emoji in half', async t => {
  const L = await open({ seed: { 'models/m1': ava } }); t.after(() => L.close());
  await L.go('#posts');
  const long = 'x'.repeat(78) + '🖤🖤 and more';
  L.set(field(L, 'Post Title'), long, 'input');
  L.set(field(L, 'Model'), 'm1');
  L.set(L.$('.logform input[placeholder="r/subreddit"]'), 'r/goth', 'input');
  await logPost(L);
  assert.equal(logged(L)[0].title, long);
  assert.equal(L.$('.entry .etitle').textContent, 'x'.repeat(78) + '…');
  assert.deepEqual(L.errors, []);
});

test('emojis show in the app\'s own font, and CSV exports start with a UTF-8 marker so Excel shows them', async t => {
  const L = await open({ seed: { 'models/m1': ava } }); t.after(() => L.close());
  const { w } = L;
  const sans = L.$('style').textContent.match(/--sans:([^;]*);/)[1];
  assert.equal(sans, '"Hanken Grotesk", "Helvetica Neue", Arial, "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif');
  assert.equal(w.__lux.toCsv([['a', '🖤']]).charCodeAt(0), 0xFEFF);
  assert.equal(w.__lux.toCsv([['a', '🖤'], ['“b”', 'c,d']]), '﻿a,🖤\r\n“b”,"c,d"');
  // The Posting log export: the marker, then the title with its emojis.
  await L.go('#posts');
  L.set(field(L, 'Post Title'), TITLE, 'input');
  L.set(L.$('.logform input[placeholder="r/subreddit"]'), 'r/goth', 'input');
  await logPost(L);
  L.click(L.button('Export CSV')); await L.sleep(200);
  const csv = L.$('.modal textarea').value;
  assert.equal(csv.charCodeAt(0), 0xFEFF);
  assert.ok(csv.slice(1).startsWith('Date,Post time,Platform'));
  assert.ok(csv.includes(TITLE));
  L.click(L.$('.modal button.primary')); await L.sleep(200);
  // Lux's own import reads such a file back: the marker is not part of the first column's name.
  const subs = w.__lux.toCsv([['Subreddit', 'Notes'], ['r/goth', 'Spooky 🖤 “night”']]);
  await L.go('#io');
  L.$('textarea[placeholder^="Or paste"]').value = subs;
  L.click(L.button('Read pasted text')); await L.sleep(100);
  assert.equal(L.$('.preview select').value, 'subs', 'the CSV is read as subreddits');
  L.click(L.button('Import'));
  for (let i = 0; i < 60 && !L.$$('.toast').some(x => /Import finished/.test(x.textContent)); i++) await L.sleep(50);
  const added = Object.entries(L.stored()).filter(([k]) => k.startsWith('subs/')).map(([, v]) => v);
  assert.equal(added.length, 1);
  assert.equal(added[0].name, 'r/goth');
  assert.ok(added[0].notes.includes('Spooky 🖤 “night”'), added[0].notes);
  assert.deepEqual(L.errors, []);
});

test('desktop lookup fills a Reddit title from oEmbed but never overwrites a typed one', async t => {
  const L = await open({ seed: {} }); t.after(() => L.close());
  const calls = [];
  L.w.__lux.setFetcherForTests(async url => { calls.push(url); return oembed; });
  const r = await L.w.__lux.lookupPostDetails({ ok: true, p: 'Reddit', sub: 'r/goth', pid: 'abc123' });
  assert.ok(r.title && r.source === 'Reddit');
  assert.equal(r.title, TITLE);
  assert.equal(calls[0], 'https://www.reddit.com/oembed?url=https://www.reddit.com/r/goth/comments/abc123/');
  L.w.__lux.setFetcherForTests(async () => null);
  assert.equal(await L.w.__lux.lookupPostDetails({ ok: true, p: 'Reddit', sub: 'r/goth', pid: 'abc123' }), null);
  // Comments, posts on a profile and links without the subreddit have nothing to look up, so nothing is asked.
  calls.length = 0;
  L.w.__lux.setFetcherForTests(async url => { calls.push(url); return oembed; });
  for (const r of [{ ok: true, p: 'Reddit', sub: 'r/goth', pid: 'c_xyz789' }, { ok: true, p: 'Reddit', sub: 'u/ava_x', pid: 'abc123' },
    { ok: true, p: 'Reddit', pid: 'abc123' }, { ok: true, p: 'Reddit', sub: 'r/goth' }, { ok: false, p: 'Reddit', sub: 'r/goth', pid: 'abc123' }, null])
    assert.equal(await L.w.__lux.lookupPostDetails(r), null, JSON.stringify(r));
  assert.deepEqual(calls, []);
  // A download that fails with an error is a lookup that found nothing.
  L.w.__lux.setFetcherForTests(async () => { throw new Error('offline'); });
  assert.equal(await L.w.__lux.lookupPostDetails({ ok: true, p: 'Reddit', sub: 'r/goth', pid: 'abc123' }), null);
});

test('pasting a Reddit link fills the real title with its emojis, and the looking-up chip goes away when done', async t => {
  const L = await open({ seed: { 'models/m1': ava } }); t.after(() => L.close());
  const F = heldFetcher();
  L.w.__lux.setFetcherForTests(F.fetch);
  await L.go('#posts');
  paste(L, LINK); await L.sleep(100);
  // A paste is both a paste and an input event: still one request.
  assert.deepEqual(F.calls, [OEMBED('abc123')]);
  assert.deepEqual(chips(L), ['✓ Reddit', LOOKING, '✓ Subreddit r/goth', '✓ Title from link']);
  assert.equal(field(L, 'Post Title').value, 'Spooky night');
  F.answer(OEMBED('abc123'), oembed); await L.sleep(100);
  assert.equal(field(L, 'Post Title').value, TITLE);
  assert.deepEqual(chips(L), ['✓ Reddit', FOUND, '✓ Subreddit r/goth']);
  L.set(field(L, 'Model'), 'm1');
  await logPost(L);
  assert.equal(logged(L)[0].title, TITLE);
  assert.equal(L.$('.entry .etitle').textContent, TITLE);
  assert.deepEqual(F.calls, [OEMBED('abc123')]);
  assert.deepEqual(L.errors, []);
});

test('a title typed before or during the lookup is kept', async t => {
  const L = await open({ seed: { 'models/m1': ava } }); t.after(() => L.close());
  const F = heldFetcher();
  L.w.__lux.setFetcherForTests(F.fetch);
  await L.go('#posts');
  // Typed first, then the link pasted.
  L.set(field(L, 'Post Title'), 'My own title ✨', 'input');
  paste(L, LINK); await L.sleep(100);
  F.answer(OEMBED('abc123'), oembed); await L.sleep(100);
  assert.equal(field(L, 'Post Title').value, 'My own title ✨');
  assert.ok(chips(L).includes(FOUND));
  await logPost(L);
  assert.equal(logged(L)[0].title, 'My own title ✨');
  // The link pasted first, then the title typed while Lux looks it up.
  paste(L, 'https://www.reddit.com/r/goth/comments/def456/other_post/'); await L.sleep(100);
  assert.equal(field(L, 'Post Title').value, 'Other post');
  L.set(field(L, 'Post Title'), 'Typed while waiting', 'input');
  F.answer(OEMBED('def456'), oembed); await L.sleep(100);
  assert.equal(field(L, 'Post Title').value, 'Typed while waiting');
  assert.deepEqual(L.errors, []);
});

test('Log post during a slow lookup logs at once with what was typed, and the late answer never fills the next post', async t => {
  const L = await open({ seed: { 'models/m1': ava } }); t.after(() => L.close());
  const F = heldFetcher();
  L.w.__lux.setFetcherForTests(F.fetch);
  await L.go('#posts');
  paste(L, LINK); await L.sleep(100);
  assert.ok(chips(L).includes(LOOKING));
  L.set(field(L, 'Model'), 'm1');
  L.set(field(L, 'Views'), '120');
  await logPost(L);
  // Logged right away, with the title from the link, and the form is ready for the next post.
  assert.equal(logged(L).length, 1);
  assert.deepEqual([logged(L)[0].title, logged(L)[0].sub, logged(L)[0].views], ['Spooky night', 'r/goth', 120]);
  assert.deepEqual(['Link', 'Post Title', 'Views'].map(f => field(L, f).value), ['', '', '']);
  assert.deepEqual(chips(L), []);
  // The answer comes late: nothing changes in the empty form, and the logged post keeps what was typed.
  F.answer(OEMBED('abc123'), oembed); await L.sleep(150);
  assert.deepEqual(['Link', 'Post Title', 'Views'].map(f => field(L, f).value), ['', '', '']);
  assert.deepEqual(chips(L), []);
  assert.equal(logged(L)[0].title, 'Spooky night');
  // The next post is looked up as usual.
  L.set(field(L, 'Post Title'), 'Next one', 'input');
  paste(L, 'https://www.reddit.com/r/goth/comments/def456/'); await L.sleep(100);
  F.answer(OEMBED('def456'), JSON.stringify({ title: 'Other night 🌙' })); await L.sleep(100);
  assert.equal(field(L, 'Post Title').value, 'Next one');
  assert.ok(chips(L).includes(FOUND));
  assert.deepEqual(L.errors, []);
});

test('a link changed while it is being looked up never gets the old answer', async t => {
  const L = await open({ seed: { 'models/m1': ava } }); t.after(() => L.close());
  const F = heldFetcher();
  L.w.__lux.setFetcherForTests(F.fetch);
  await L.go('#posts');
  paste(L, LINK); await L.sleep(100);
  paste(L, 'https://www.reddit.com/r/goth/comments/def456/other_post/'); await L.sleep(100);
  // One lookup at a time: the new link waits for its turn.
  assert.deepEqual(F.calls, [OEMBED('abc123')]);
  assert.equal(field(L, 'Post Title').value, 'Other post');
  F.answer(OEMBED('abc123'), oembed); await L.sleep(100);
  assert.equal(field(L, 'Post Title').value, 'Other post', 'the answer for the old link is dropped');
  assert.ok(chips(L).includes(LOOKING));
  assert.deepEqual(F.calls, [OEMBED('abc123'), OEMBED('def456')]);
  F.answer(OEMBED('def456'), JSON.stringify({ title: 'Other night 🌙' })); await L.sleep(100);
  assert.equal(field(L, 'Post Title').value, 'Other night 🌙');
  assert.deepEqual(chips(L), ['✓ Reddit', FOUND, '✓ Subreddit r/goth']);
  // Changed while waiting for its turn: a link that was only waiting is never asked for.
  paste(L, 'https://www.reddit.com/r/goth/comments/ghi111/'); await L.sleep(50);
  paste(L, 'https://www.reddit.com/r/goth/comments/ghi222/'); await L.sleep(50);
  paste(L, 'https://www.reddit.com/r/goth/comments/ghi333/'); await L.sleep(50);
  F.answer(OEMBED('ghi111'), oembed); await L.sleep(100);
  assert.deepEqual(F.calls.slice(2), [OEMBED('ghi111'), OEMBED('ghi333')]);
  F.answer(OEMBED('ghi333'), JSON.stringify({ title: 'Third 🕯️' })); await L.sleep(100);
  assert.equal(field(L, 'Post Title').value, 'Third 🕯️');
  assert.equal(F.most(), 1, 'never two lookups at once');
  assert.deepEqual(L.errors, []);
});

test('when the lookup fails in any way, the post is typed in and logged as before', async t => {
  const L = await open({ seed: { 'models/m1': ava } }); t.after(() => L.close());
  await L.go('#posts');
  const failures = [
    ['no answer (offline, blocked, timed out)', async () => null],
    ['an error', async () => { throw new Error('offline'); }],
    ['a login page', async () => '<!doctype html><html><head><title>Log in • Reddit</title></head><body>Sign in to continue</body></html>'],
    ['malformed JSON', async () => '{"title":"Spooky'],
    ['JSON without a title', async () => '{"error":403,"message":"Forbidden"}'],
    ['an empty title', async () => '{"title":"   "}'],
    ['an empty answer', async () => ''],
    ['a number', async () => 403]
  ];
  for (const [i, [kind, fetcher]] of failures.entries()){
    L.w.__lux.setFetcherForTests(fetcher);
    L.set(field(L, 'Views'), String(100 + i));
    paste(L, `https://www.reddit.com/r/goth/comments/abc${100 + i}/spooky_night/`); await L.sleep(100);
    assert.deepEqual(chips(L), ['✓ Reddit', FAILED, '✓ Subreddit r/goth', '✓ Title from link'], kind);
    assert.equal(field(L, 'Post Title').value, 'Spooky night', kind);
    assert.equal(field(L, 'Views').value, String(100 + i), kind);
    await logPost(L);
    assert.equal(logged(L).length, i + 1, kind);
    assert.deepEqual([logged(L)[i].title, logged(L)[i].views], ['Spooky night', 100 + i], kind);
  }
  assert.deepEqual(L.errors, []);
});

test('one request per pasted link, and never a lookup without a link', async t => {
  const L = await open({ seed: { 'models/m1': ava } }); t.after(() => L.close());
  const calls = [];
  L.w.__lux.setFetcherForTests(async url => { calls.push(url); return oembed; });
  await L.go('#posts'); await L.sleep(300);
  // Filling in the rest of the form, switching platforms or pages: nothing is asked.
  L.set(field(L, 'Post Title'), 'Hello', 'input');
  L.set(field(L, 'Model'), 'm1');
  L.set(field(L, 'Views'), '5');
  for (const p of ['TikTok', 'Instagram', 'Reddit']){ L.click(L.$$('.logform .seg button').find(b => b.textContent === p)); await L.sleep(50); }
  await L.go('#home'); await L.go('#posts'); await L.sleep(300);
  assert.deepEqual(calls, []);
  paste(L, LINK); await L.sleep(100);
  assert.deepEqual(calls, [OEMBED('abc123')]);
  // The same post again, pasted or with something added to its link: nothing new is asked, and the answer stays.
  paste(L, LINK); await L.sleep(100);
  L.set(field(L, 'Link'), LINK + '?utm_source=share&utm_medium=web', 'input'); await L.sleep(100);
  assert.deepEqual(calls, [OEMBED('abc123')]);
  assert.ok(chips(L).includes(FOUND));
  // Comments, posts on a profile and share links have nothing to look up.
  for (const other of ['https://www.reddit.com/r/goth/comments/abc123/comment/xyz789/', 'https://www.reddit.com/user/ava_x/comments/def456/hi/',
    'https://www.reddit.com/r/goth/s/AbCdEf123', 'https://redd.it/abc123']){
    paste(L, other); await L.sleep(100);
    assert.ok(!chips(L).some(c => c === LOOKING || c === FOUND || c === FAILED), other);
  }
  assert.deepEqual(calls, [OEMBED('abc123')]);
  // Emptying the link and pasting it again asks again.
  L.set(field(L, 'Link'), '', 'input'); await L.sleep(50);
  paste(L, LINK); await L.sleep(100);
  assert.deepEqual(calls, [OEMBED('abc123'), OEMBED('abc123')]);
  // So does pasting it again once the post is logged: its numbers may have changed since.
  await logPost(L);
  paste(L, LINK); await L.sleep(100);
  assert.equal(calls.length, 3);
  assert.equal(L.$('.logform button[type=submit]').textContent, 'Update post');
  assert.deepEqual(L.errors, []);
});

test('the web version: a slow duplicate check for an earlier link never fills in the next one', async t => {
  // Logged months ago, so finding it means reading the whole posting log, which takes a moment on the web.
  const docs = { 'models/m1': ava, 'posts/2025-01-06_u9': { weekStart: '2025-01-06', uid: 'u9', entries: [
    { id: 'p1', d: '2025-01-06', tm: '', p: 'Reddit', ty: 'Post', q: 1, pid: 'abc123', sub: 'r/goth', title: 'Old one', views: 999, ups: 50 }] } };
  const L = await open({ claude: webClaude(docs, 300) }); t.after(() => L.close());
  await L.go('#posts');
  paste(L, LINK); await L.sleep(50);
  paste(L, 'https://www.reddit.com/r/goth/comments/def456/other_post/'); await L.sleep(800);
  assert.deepEqual(['Post Title', 'Views', 'Likes/Upvotes'].map(f => field(L, f).value), ['Other post', '', '']);
  assert.equal(L.$('.logform button[type=submit]').textContent, 'Log post');
  assert.ok(!chips(L).some(c => /Already logged/.test(c)), chips(L).join(' | '));
  // The earlier link itself is still recognized.
  paste(L, LINK); await L.sleep(800);
  assert.deepEqual(['Views', 'Likes/Upvotes'].map(f => field(L, f).value), ['999', '50']);
  assert.equal(L.$('.logform button[type=submit]').textContent, 'Update post');
  assert.deepEqual(L.errors, []);
});

test('the web version never looks anything up', async t => {
  const docs = { 'models/m1': ava };
  const L = await open({ claude: webClaude(docs) }); t.after(() => L.close());
  const net = [];
  L.w.fetch = async url => { net.push(String(url)); throw new Error('no network in tests'); };
  const xhrOpen = L.w.XMLHttpRequest.prototype.open;
  L.w.XMLHttpRequest.prototype.open = function (m, url){ net.push(String(url)); return xhrOpen.apply(this, arguments); };
  assert.equal(L.w.Neutralino, undefined);
  assert.equal(L.w.__lux.lookupEnabled(), false);
  assert.equal(await L.w.__lux.fetchText(OEMBED('abc123')), null);
  await L.go('#posts');
  paste(L, LINK); await L.sleep(300);
  assert.deepEqual(chips(L), ['✓ Reddit', '✓ Subreddit r/goth', '✓ Title from link']);
  assert.equal(field(L, 'Post Title').value, 'Spooky night');
  await logPost(L);
  const entries = Object.keys(docs).filter(p => p.startsWith('posts/')).flatMap(p => docs[p].entries);
  assert.deepEqual(entries.map(e => e.title), ['Spooky night']);
  assert.deepEqual(net, []);
  assert.deepEqual(L.errors, []);
});

test('desktop: fetchText runs curl with a config file, never the address on a command line, and keeps emojis', async t => {
  // Files left by a Lux closed during a lookup are removed; anything else in the folder is kept.
  const N = desk({}, async () => ({ code: 0, body: oembed }), {}, { '/app/lookup/lux-lookup-7.out': 'old page',
    '/app/lookup/lux-lookup-7.curl': 'url = "https://www.reddit.com/old"', '/app/lookup/notes.txt': 'mine' });
  const L = await open({ neutralino: N }); t.after(() => L.close());
  assert.equal(L.w.__lux.lookupEnabled(), true);
  const text = await L.w.__lux.fetchText(OEMBED('abc123'));
  assert.equal(text, oembed);
  assert.equal(JSON.parse(text).title, TITLE);
  assert.equal(N.spawned.length, 1);
  const run = N.spawned[0];
  assert.match(run.command, /^curl -K lux-lookup-\d+\.curl$/);
  assert.equal(run.cwd, '/app/lookup');
  assert.ok(run.text.includes(`url = "${OEMBED('abc123')}"\n`), run.text);
  assert.deepEqual(Object.assign({}, run.config, { header: [...run.config.header] }), {
    url: OEMBED('abc123'), output: run.command.slice(8).replace(/\.curl$/, '.out'), 'user-agent': 'Mozilla/5.0',
    header: ['Accept-Language: en-US,en;q=0.9'], silent: true, fail: true, globoff: true, location: true, 'max-redirs': '5',
    'proto-redir': '=https', 'connect-timeout': '5', 'max-time': '8', 'max-filesize': '5242880' });
  // Pages are asked for with a browser's user agent.
  await L.w.__lux.fetchText('https://www.instagram.com/p/C9xAb12/');
  assert.equal(N.spawned[1].config['user-agent'], 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
  assert.notEqual(N.spawned[1].command, run.command, 'every download has its own files');
  // Nothing is left behind, and the updater's files are never used.
  assert.deepEqual(lookupFiles(N), ['/app/lookup/notes.txt']);
  assert.ok(N.spawned.every(r => !/lux-dl/.test(r.command + r.text)));
  assert.deepEqual(N.killed, []);
  assert.deepEqual(deskErrors(L), []);
});

test('desktop: fetchText answers null for every kind of failure, and cleans up', async t => {
  const N = desk({}, null);
  const L = await open({ neutralino: N }); t.after(() => L.close());
  const fetchText = L.w.__lux.fetchText;
  // curl missing, or Lux not allowed to run it.
  assert.equal(await fetchText(OEMBED('abc123')), null);
  const kinds = [
    ['offline: the name can’t be found', { code: 6 }], ['the connection is refused', { code: 7 }],
    ['blocked: HTTP 403 or 429 (curl --fail)', { code: 22, body: '<html>Blocked</html>' }], ['timed out after 8 seconds', { code: 28 }],
    ['a secure connection fails', { code: 35 }], ['larger than 5 MB', { code: 63 }], ['curl not found on Windows', { code: 9009 }],
    ['curl not found on a Mac', { code: 127 }], ['an empty answer', { code: 0, body: '' }], ['only spaces', { code: 0, body: ' \r\n ' }],
    ['no file written', { code: 0 }]
  ];
  for (const [kind, res] of kinds){
    N.curl = async () => res;
    assert.equal(await fetchText(OEMBED('abc123')), null, kind);
    assert.deepEqual(lookupFiles(N), [], kind);
  }
  assert.equal(N.spawned.length, kinds.length);
  // A login page or broken JSON is downloaded fine, but a lookup reads nothing from it.
  for (const body of ['<html><title>Log in • Reddit</title></html>', '{"title":"Spooky']){
    N.curl = async () => ({ code: 0, body });
    assert.equal(await fetchText(OEMBED('abc123')), body);
    assert.equal(await L.w.__lux.lookupPostDetails({ ok: true, p: 'Reddit', sub: 'r/goth', pid: 'abc123' }), null);
  }
  assert.deepEqual(lookupFiles(N), []);
  assert.deepEqual(deskErrors(L), []);
});

test('desktop: addresses outside the three platforms, or with unsafe characters, are never asked for', async t => {
  const N = desk({}, async () => ({ code: 0, body: oembed }));
  const L = await open({ neutralino: N }); t.after(() => L.close());
  for (const bad of ['https://evil.com/x', 'https://www.reddit.com/x" & calc', 'https://www.reddit.com/x\nurl = "https://evil.com/"', 'file:///etc/passwd',
    'https://www.reddit.com/%22', 'http://www.reddit.com/r/goth/'])
    assert.equal(await L.w.__lux.fetchText(bad), null, bad);
  assert.deepEqual(N.spawned, []);
  assert.deepEqual(deskErrors(L), []);
});

test('desktop: Settings → Post lookup is on by default; turned off, pasting a link asks nothing', async t => {
  const N = desk({ 'models/m1': ava }, async () => ({ code: 0, body: oembed }));
  const L = await open({ neutralino: N }); t.after(() => L.close());
  const box = () => L.$$('section.panel').find(s => s.querySelector('h2').textContent === 'Post lookup').querySelector('input[type=checkbox]');
  await L.go('#settings');
  assert.equal(box().checked, true);
  assert.ok(L.$$('section.panel p').some(p => p.textContent === 'Lux asks the platform’s public page for the title and numbers, signed out, from this computer only. It never uses AdsPower or any account.'));
  L.click(box()); await L.sleep(200);
  assert.equal(N.read('/app/config/settings.json').lookup, false);
  assert.equal(L.w.__lux.lookupEnabled(), false);
  await L.go('#posts');
  paste(L, LINK); await L.sleep(300);
  assert.deepEqual(chips(L), ['✓ Reddit', '✓ Subreddit r/goth', '✓ Title from link']);
  assert.equal(field(L, 'Post Title').value, 'Spooky night');
  assert.equal(await L.w.__lux.fetchText(OEMBED('abc123')), null);
  assert.deepEqual(N.spawned, []);
  // Turned on again, the next pasted link is looked up.
  await L.go('#settings');
  L.click(box()); await L.sleep(200);
  assert.equal(N.read('/app/config/settings.json').lookup, true);
  await L.go('#posts');
  paste(L, 'https://www.reddit.com/r/goth/comments/def456/other_post/'); await L.sleep(300);
  assert.equal(N.spawned.length, 1);
  assert.equal(N.spawned[0].config.url, OEMBED('def456'));
  assert.equal(field(L, 'Post Title').value, TITLE);
  assert.deepEqual(chips(L), ['✓ Reddit', FOUND, '✓ Subreddit r/goth']);
  assert.deepEqual(lookupFiles(N), []);
  assert.deepEqual(deskErrors(L), []);
});

test('desktop: a computer where Post lookup was turned off asks nothing', async t => {
  const N = desk({ 'models/m1': ava }, async () => ({ code: 0, body: oembed }), { lookup: false });
  const L = await open({ neutralino: N }); t.after(() => L.close());
  await L.go('#settings');
  assert.equal(L.$$('section.panel').find(s => s.querySelector('h2').textContent === 'Post lookup').querySelector('input[type=checkbox]').checked, false);
  await L.go('#posts');
  paste(L, LINK); await L.sleep(300);
  assert.ok(!chips(L).some(c => c === LOOKING || c === FOUND || c === FAILED));
  assert.deepEqual(N.spawned, []);
  assert.deepEqual(deskErrors(L), []);
});

test('Portuguese: the lookup chips and the Settings section are translated', async t => {
  const N = desk({ 'models/m1': ava }, async () => ({ code: 0, body: oembed }), { lang: 'pt' });
  const L = await open({ neutralino: N, lang: 'pt' }); t.after(() => L.close());
  await L.go('#settings');
  const sec = L.$$('section.panel').find(s => s.querySelector('h2').textContent === 'Busca de posts');
  assert.ok(sec, 'Settings has the Busca de posts section');
  assert.ok(sec.textContent.includes('Buscar detalhes do post online ao colar um link'));
  assert.ok(sec.textContent.includes('Nunca usa o AdsPower nem nenhuma conta.'));
  await L.go('#posts');
  const link = L.$('.logform input[autocomplete=off]:not([list])');
  N.curl = () => new Promise(() => {});
  link.value = LINK; link.dispatchEvent(new L.w.Event('input', { bubbles: true })); await L.sleep(200);
  assert.ok(chips(L).includes('… Buscando detalhes do post'), chips(L).join(' | '));
  const L2 = await open({ seed: { 'models/m1': ava }, lang: 'pt' }); t.after(() => L2.close());
  await L2.go('#posts');
  const link2 = L2.$('.logform input[autocomplete=off]:not([list])');
  L2.w.__lux.setFetcherForTests(async () => oembed);
  link2.value = LINK; link2.dispatchEvent(new L2.w.Event('input', { bubbles: true })); await L2.sleep(200);
  assert.ok(chips(L2).includes('✓ Detalhes do Reddit'), chips(L2).join(' | '));
  L2.w.__lux.setFetcherForTests(async () => null);
  link2.value = 'https://www.reddit.com/r/goth/comments/def456/'; link2.dispatchEvent(new L2.w.Event('input', { bubbles: true })); await L2.sleep(200);
  assert.ok(chips(L2).includes('! Não foi possível buscar este post online. Digite os detalhes.'), chips(L2).join(' | '));
  assert.deepEqual(L.errors.concat(L2.errors), []);
});

test('desktop: a curl that never finishes is stopped, logging never waits for it, and the next link is looked up', async t => {
  const N = desk({ 'models/m1': ava }, url => url === OEMBED('abc123') ? new Promise(() => {}) : { code: 0, body: JSON.stringify({ title: 'Next 🌙' }) });
  const L = await open({ neutralino: N }); t.after(() => L.close());
  await L.go('#posts');
  paste(L, LINK); await L.sleep(200);
  assert.ok(chips(L).includes(LOOKING));
  await logPost(L);
  const week = [...N.files.keys()].filter(p => p.startsWith(DATA + '/posts/'));
  assert.equal(week.length, 1);
  assert.deepEqual(JSON.parse(N.files.get(week[0])).entries.map(e => e.title), ['Spooky night']);
  paste(L, 'https://www.reddit.com/r/goth/comments/def456/'); await L.sleep(200);
  assert.equal(N.spawned.length, 1, 'the next link waits for its turn');
  assert.ok(chips(L).includes(LOOKING));
  // curl has 8 seconds; Lux stops a curl still running after 15.
  await L.sleep(15500);
  assert.deepEqual(N.killed, [N.spawned[0].id]);
  assert.equal(N.spawned.length, 2);
  assert.equal(field(L, 'Post Title').value, 'Next 🌙');
  assert.deepEqual(lookupFiles(N), []);
  assert.deepEqual(deskErrors(L), []);
});
