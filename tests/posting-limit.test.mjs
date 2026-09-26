import { test } from 'node:test';
import assert from 'node:assert/strict';
import { open } from './harness.mjs';

const OPTIONS = ['1 post per 24h','2 posts per 24h','3 posts per 24h','4 posts per 24h','5 posts per 24h',
  '1 post per 12h','2 posts per 12h','3 posts per 12h','4 posts per 12h','5 posts per 12h','1 post per week'];
// How Portuguese shows each option. What is stored is always the English one.
const PT_OPTIONS = ['1 post a cada 24h','2 posts a cada 24h','3 posts a cada 24h','4 posts a cada 24h','5 posts a cada 24h',
  '1 post a cada 12h','2 posts a cada 12h','3 posts a cada 12h','4 posts a cada 12h','5 posts a cada 12h','1 post por semana'];

const sub = (name, extra = {}) => Object.assign({ name, kind: 'NSFW', status: 'Active', tags: [] }, extra);
const limitBox = (L, label = 'Posting limit') => L.$$('#peek select').find(s => s.getAttribute('aria-label') === label);
const shown = sel => sel.options[sel.selectedIndex].textContent;
const toasts = L => L.$$('.toast').map(x => x.textContent);
const auditOf = entriesByDoc => entriesByDoc.flatMap(([, v]) => v.entries);
const localAudit = L => auditOf(Object.entries(L.stored()).filter(([k]) => k.startsWith('audit/local/m/')));
const standardized = entries => entries.filter(e => /^Posting limits standardized/.test(e.n));
// One column of the Subreddits table, top to bottom.
function column(L, label){
  const i = L.$$('.tbl thead th').findIndex(th => th.textContent.replace(/[↑↓]/g, '') === label);
  assert.ok(i >= 0, 'column ' + label);
  return L.$$('.tbl tbody tr').map(r => r.children[i].textContent);
}
async function openSub(L, name){
  await L.go('#t/subs');
  L.click(L.$$('.tbl tbody tr').find(r => r.children[0].textContent === name)); await L.sleep(200);
}
// Pastes a CSV on the Import & export page and imports it, the way a person would.
async function importCsv(L, text, added){
  await L.go('#io');
  L.$('textarea[placeholder^="Or paste"]').value = text;
  L.click(L.button('Read pasted text')); await L.sleep(100);
  assert.equal(L.$('.preview select').value, 'subs', 'the CSV is read as subreddits');
  L.click(L.button('Import'));
  const done = `Import finished: ${added} added, 0 updated, 0 skipped`;
  for (let i = 0; i < 60 && !toasts(L).includes(done); i++) await L.sleep(50);
  assert.ok(toasts(L).includes(done), toasts(L).join(' | '));
}

test('dropdown has exactly the 11 options in order', async t => {
  const L = await open({ seed: { 'subs/s1': sub('r/goth') } }); t.after(() => L.close());
  // The list is made inside the page, so compare a copy (deepEqual also checks where an array was made).
  assert.deepEqual([...L.w.__lux.LIMIT_OPTIONS], OPTIONS);
  await openSub(L, 'r/goth');
  const sel = limitBox(L);
  assert.equal(sel.tagName, 'SELECT');
  assert.deepEqual([...sel.options].map(o => o.value), ['', ...OPTIONS]);
  assert.deepEqual([...sel.options].slice(1).map(o => o.textContent), OPTIONS);
  assert.equal(sel.value, '');
  L.set(sel, '2 posts per 12h'); await L.sleep(150);
  assert.equal(L.stored()['subs/s1'].limit, '2 posts per 12h');
  assert.ok(localAudit(L).some(e => e.a === 'updated' && e.ch.some(c => c.f === 'Posting limit' && c.to === '2 posts per 12h')), 'the choice is in the audit log');
  L.click(L.$('.x')); await L.sleep(300);
  assert.deepEqual(column(L, 'Posting limit'), ['2 posts per 12h']);
  assert.deepEqual(L.errors, []);
});

test('old free text converts only when certain, otherwise it is kept and shown', async t => {
  const L = await open({ seed: {
    'subs/a': { name: 'r/a', tags: [], limit: '1 post per 24 h' },
    'subs/b': { name: 'r/b', tags: [], limit: '1/day' },
    'subs/c': { name: 'r/c', tags: [], limit: 'once a week' },
    'subs/d': { name: 'r/d', tags: [], limit: 'ask mods first' },
    'subs/e': { name: 'r/e', tags: [], limit: '2 posts per week' },
    'subs/f': { name: 'r/f', tags: [], limit: '3 posts per 12h' },
    'subs/g': { name: 'r/g', tags: [] }
  } }); t.after(() => L.close());
  await L.sleep(300);
  const s = L.stored();
  assert.equal(s['subs/a'].limit, '1 post per 24h');
  assert.equal(s['subs/b'].limit, '1 post per 24h');
  assert.equal(s['subs/c'].limit, '1 post per week');
  assert.equal(s['subs/d'].limit, 'ask mods first');
  assert.equal(s['subs/e'].limit, '2 posts per week', 'there is no such option, so the text stays');
  assert.equal(s['subs/f'].limit, '3 posts per 12h');
  assert.ok(!('limit' in s['subs/g']), 'nothing is added where there was no limit');
  // One audit entry says what changed, and keeps the old text of each subreddit.
  const logged = standardized(localAudit(L));
  assert.equal(logged.length, 1);
  assert.equal(logged[0].n, 'Posting limits standardized: 3 subreddits');
  assert.equal(logged[0].c, 'subs');
  assert.deepEqual(logged[0].ch.map(c => `${c.f}: ${c.from} -> ${c.to}`).sort(),
    ['r/a: 1 post per 24 h -> 1 post per 24h', 'r/b: 1/day -> 1 post per 24h', 'r/c: once a week -> 1 post per week']);
  await L.go('#t/subs');
  assert.deepEqual(column(L, 'Posting limit'), ['1 post per 24h', '1 post per 24h', '1 post per week', 'ask mods first', '2 posts per week', '3 posts per 12h', '']);
  // The panel shows the old text as the chosen value, not an empty box that invites overwriting it.
  await openSub(L, 'r/d');
  const sel = limitBox(L);
  assert.equal(sel.value, 'ask mods first');
  assert.equal(shown(sel), 'ask mods first');
  assert.deepEqual([...sel.options].map(o => o.value), ['', ...OPTIONS, 'ask mods first']);
  // Choosing an option replaces it; the old text then leaves the list.
  L.set(sel, '1 post per 12h'); await L.sleep(150);
  assert.equal(L.stored()['subs/d'].limit, '1 post per 12h');
  assert.deepEqual([...limitBox(L).options].map(o => o.value), ['', ...OPTIONS]);
  assert.deepEqual(L.errors, []);
});

test('a long old text is shortened in the table but kept whole', async t => {
  const long = '1 post per 24 h, but only after the mods approve your verification post, and never on weekends';
  const L = await open({ seed: { 'subs/a': sub('r/a', { limit: long }) } }); t.after(() => L.close());
  await L.go('#t/subs');
  const [cell] = column(L, 'Posting limit');
  assert.ok(cell.length <= 60 && long.startsWith(cell.slice(0, -1)) && cell.endsWith('…'), cell);
  assert.equal(L.stored()['subs/a'].limit, long);
  await openSub(L, 'r/a');
  assert.equal(limitBox(L).value, long);
});

test('the conversion runs once: reopening changes nothing and logs nothing', async t => {
  const A = await open({ seed: { 'subs/a': sub('r/a', { limit: '1/day' }), 'subs/d': sub('r/d', { limit: 'ask mods first' }) } });
  t.after(() => A.close());
  await A.sleep(300);
  assert.equal(A.stored()['subs/a'].limit, '1 post per 24h');
  assert.equal(standardized(localAudit(A)).length, 1);
  assert.equal(standardized(localAudit(A))[0].n, 'Posting limits standardized: 1 subreddit');
  const before = A.stored();
  // The same data opened again, as on the next start or on a second computer.
  const B = await open({ seed: before }); t.after(() => B.close());
  await B.sleep(300);
  assert.deepEqual(B.stored(), before);
  assert.deepEqual(A.errors, []); assert.deepEqual(B.errors, []);
});

test('nothing to convert: nothing is written, not even an audit entry', async t => {
  const seed = { 'subs/a': sub('r/a', { limit: '1 post per 24h' }), 'subs/b': sub('r/b', { limit: 'ask mods first' }), 'subs/c': sub('r/c'),
    'subs/d': sub('r/d', { limit: '' }) };
  const L = await open({ seed }); t.after(() => L.close());
  await L.sleep(300);
  assert.deepEqual(L.stored(), seed);
});

test('a limit damaged by an old import is repaired first, then converted', async t => {
  const L = await open({ seed: { 'subs/a': sub('r/a', { limit: ['1/day'] }) } }); t.after(() => L.close());
  await L.sleep(400);
  assert.equal(L.stored()['subs/a'].limit, '1 post per 24h');
  assert.deepEqual(L.errors, []);
});

// A stand-in for the web version's database. `slow` delays the first snapshot of some collections.
function webDb(docs, slow = {}){
  const copy = o => JSON.parse(JSON.stringify(o));
  const parent = p => p.slice(0, p.lastIndexOf('/'));
  const run = (col, ops) => ({ docs: Object.keys(docs).filter(p => parent(p) === col).sort()
    .filter(p => ops.every(o => o.op === '==' ? docs[p][o.f] === o.v : o.op === 'in' ? o.v.includes(docs[p][o.f]) : true))
    .map(p => ({ id: p.slice(p.lastIndexOf('/') + 1), exists: true, data: () => copy(docs[p]) })) });
  const doc = p => ({
    get: async () => ({ id: p.slice(p.lastIndexOf('/') + 1), exists: p in docs, data: () => (p in docs ? copy(docs[p]) : undefined) }),
    set: async d => { docs[p] = copy(d); },
    update: async d => { if (!(p in docs)) throw { code: 'not_found', message: 'missing' }; Object.assign(docs[p], copy(d)); },
    delete: async () => { delete docs[p]; }
  });
  const query = (col, ops) => ({
    where: (f, op, v) => query(col, ops.concat({ f, op, v })),
    orderBy: () => query(col, ops),
    limit: () => query(col, ops),
    get: async () => run(col, ops),
    onSnapshot: next => { setTimeout(() => next(run(col, ops)), slow[col] || 0); return () => {}; }
  });
  return { collection: c => query(c, []), doc };
}
const webUser = canWrite => ({ me: async () => ({ id: 'u1', name: 'Ana' }), can: async () => canWrite, profiles: async () => ({}), search: async () => [] });
const webClaude = (db, canWrite = true) => ({ use: async name => name === 'db' ? db : name === 'user' ? webUser(canWrite) : null });

test('web version: the conversion waits for subreddits, and the older migrations do not wait for it', async t => {
  const docs = {
    'employees/e1': { name: 'Bea', role: 'Assistant', status: 'Active' },
    'subs/a': sub('r/a', { limit: '1/day' }),
    'subs/d': sub('r/d', { limit: 'ask mods first' })
  };
  const L = await open({ claude: webClaude(webDb(docs, { subs: 1200 })) }); t.after(() => L.close());
  // open() waited 400 ms: the team has loaded and been updated; subreddits have not arrived yet.
  assert.equal(docs['employees/e1'].role, 'Reliever');
  assert.equal(docs['subs/a'].limit, '1/day');
  await L.sleep(1200);
  assert.equal(docs['subs/a'].limit, '1 post per 24h');
  assert.equal(docs['subs/d'].limit, 'ask mods first');
  const entries = auditOf(Object.entries(docs).filter(([k]) => k.startsWith('audit/u1/m/')));
  assert.deepEqual(entries.map(e => e.n), ['Posting limits standardized: 1 subreddit']);
  assert.deepEqual(L.errors, []);
});

test('web version: a view-only person converts nothing', async t => {
  const docs = { 'subs/a': sub('r/a', { limit: '1/day' }) };
  const L = await open({ claude: webClaude(webDb(docs), false) }); t.after(() => L.close());
  await L.sleep(300);
  assert.deepEqual(Object.keys(docs), ['subs/a']);
  assert.equal(docs['subs/a'].limit, '1/day');
  await L.go('#t/subs');
  assert.deepEqual(column(L, 'Posting limit'), ['1/day']);
  assert.deepEqual(L.errors, []);
});

test('normalizeLimit is strict', async t => {
  const L = await open(); t.after(() => L.close());
  const n = L.w.__lux.normalizeLimit;
  const is = (raw, want) => assert.equal(n(raw), want, JSON.stringify(raw));
  is('3 posts / 12 hours', '3 posts per 12h');
  is('2 per day', '2 posts per 24h');
  is('1 post every 7 days', '1 post per week');
  is('6 posts per 24h', null);
  is('sometimes', null);
  // The examples in the plan's review notes.
  is('1 post per 24 h', '1 post per 24h'); is('1/day', '1 post per 24h'); is('once a week', '1 post per week'); is('ask mods first', null);
  // Every option reads as itself, in any case and in Portuguese.
  OPTIONS.forEach((o, i) => { is(o, o); is(o.toUpperCase(), o); is(' ' + o + ' ', o); is(PT_OPTIONS[i], o); });
  // Other ways people write the same limits.
  for (const [raw, want] of [
    ['1 post / 24 hrs', '1 post per 24h'], ['1 post per 24 hours.', '1 post per 24h'], ['1 Post Per 24H', '1 post per 24h'],
    ['1 post per 24 hour period', '1 post per 24h'], ['One post per day', '1 post per 24h'], ['once a day', '1 post per 24h'],
    ['once every 24 hours', '1 post per 24h'], ['1x per day', '1 post per 24h'], ['1 post daily', '1 post per 24h'], ['1/24h', '1 post per 24h'],
    ['twice a day', '2 posts per 24h'], ['2 times a day', '2 posts per 24h'], ['2x/day', '2 posts per 24h'], ['2/12h', '2 posts per 12h'],
    ['5 posts every 12 hours', '5 posts per 12h'], ['1 post every 12h', '1 post per 12h'], ['once per 12 hrs', '1 post per 12h'],
    ['Max 2 posts per day', '2 posts per 24h'], ['max. 3 posts per 24h', '3 posts per 24h'], ['Limit: 1 post per 24 hours', '1 post per 24h'],
    ['limit of 1 post per day', '1 post per 24h'], ['no more than 3 posts per day', '3 posts per 24h'], ['up to 4 posts per 12h', '4 posts per 12h'],
    ['1/week', '1 post per week'], ['once weekly', '1 post per week'], ['one post a week', '1 post per week'], ['1 per 7 days', '1 post per week'],
    // Portuguese
    ['1 post por dia', '1 post per 24h'], ['2 posts por dia', '2 posts per 24h'], ['1 post a cada 24 horas', '1 post per 24h'],
    ['1 post a cada 24hs', '1 post per 24h'], ['1 post/dia', '1 post per 24h'], ['1x ao dia', '1 post per 24h'], ['uma vez por dia', '1 post per 24h'],
    ['duas vezes por dia', '2 posts per 24h'], ['3 postagens a cada 12h', '3 posts per 12h'], ['1 postagem por semana', '1 post per week'],
    ['uma vez por semana', '1 post per week'], ['1 post a cada 7 dias', '1 post per week'], ['máx. 2 posts por dia', '2 posts per 24h'],
    ['no máximo 1 post a cada 12 horas', '1 post per 12h'], ['até 5 posts por dia', '5 posts per 24h']
  ]) is(raw, want);
  // Unsure, or no such option: left alone.
  for (const raw of ['2 posts per week', 'twice a week', '1 post per 48h', '1 post per 2 days', '1 post per month', '3 posts por semana',
    '0 posts per day', '10 posts per day', '12 posts per day', '6/12h', '1-2 posts per day', '1.5 posts per day', '1 or 2 posts per day',
    '1 post per day per account', '1 post per 24h, no selling', '1 post per 24h?', '1 post per 24h (strict)', 'at least 1 post per day',
    'min 1 post per day', '17 days', '1 week', '24h', '1 post', 'daily', 'weekly', 'every 24 hours', '1 per 24', '1 comment per day',
    '1 post and 1 comment per day', 'a post a day', 'no limit', 'none', 'unlimited', 'ask mods first', 'wait 24h between posts',
    '', '   ', null, undefined, 1]) is(raw, null);
});

test('in Portuguese every place that shows a limit translates it, and English is stored', async t => {
  const seed = {
    'subs/s1': sub('r/goth', { tags: ['Goth'], limit: '1 post per 24h', minKarma: 50 }),
    'subs/s2': sub('r/alt', { tags: ['Goth'], limit: 'ask mods first' }),
    'models/m1': { name: 'Ava', status: 'Active', niche: ['Goth'], nsfwSubs: [], sfwSubs: [], platforms: ['Reddit'], employees: [] }
  };
  const L = await open({ seed, lang: 'pt' }); t.after(() => L.close());
  await L.go('#t/subs');
  assert.deepEqual(column(L, 'Limite de postagem'), ['ask mods first', '1 post a cada 24h']);
  // The filter shows Portuguese and filters by the stored English value.
  const filter = L.$$('.toolbar-row select').find(s => s.getAttribute('aria-label') === 'Limite de postagem');
  assert.deepEqual([...filter.options].map(o => o.textContent), ['Limite de postagem: qualquer', ...PT_OPTIONS]);
  assert.deepEqual([...filter.options].map(o => o.value), ['', ...OPTIONS]);
  L.set(filter, '1 post per 24h'); await L.sleep(100);
  assert.deepEqual(L.$$('.tbl tbody tr').map(r => r.children[0].textContent), ['r/goth']);
  L.set(filter, ''); await L.sleep(100);
  // The panel: Portuguese labels, English values, and old text as it is.
  await openSub(L, 'r/goth');
  const sel = limitBox(L, 'Limite de postagem');
  assert.equal(sel.value, '1 post per 24h');
  assert.equal(shown(sel), '1 post a cada 24h');
  assert.deepEqual([...sel.options].slice(1).map(o => o.textContent), PT_OPTIONS);
  L.set(sel, '3 posts per 12h'); await L.sleep(150);
  assert.equal(L.stored()['subs/s1'].limit, '3 posts per 12h');
  L.click(L.$('.x')); await L.sleep(300);
  await openSub(L, 'r/alt');
  assert.equal(shown(limitBox(L, 'Limite de postagem')), 'ask mods first');
  L.click(L.$('.x')); await L.sleep(300);
  // Her subreddit suggestions show the limit in Portuguese too.
  await L.go('#t/models');
  L.click(L.$$('.tbl tbody tr')[0]); await L.sleep(300);
  const note = name => L.$$('#peek .suggrow').find(r => r.textContent.includes(name)).querySelector('.note').textContent;
  assert.ok(note('r/goth').includes('3 posts a cada 12h'), note('r/goth'));
  assert.ok(note('r/alt').includes('ask mods first'), note('r/alt'));
  // Adding it to her list saves the note in English, like every saved note.
  L.click(L.$$('#peek .suggrow').find(r => r.textContent.includes('r/goth')).querySelector('.btn.primary')); await L.sleep(300);
  const saved = L.stored()['models/m1'].nsfwSubs;
  assert.equal(saved.length, 1);
  assert.equal(saved[0].note, 'Min. karma 50 · 3 posts per 12h');
  assert.deepEqual(L.errors, []);
});

test('sorting by posting limit follows the dropdown, then old text from A to Z', async t => {
  const seed = {
    'subs/a': sub('r/a', { limit: 'wait for approval' }), 'subs/b': sub('r/b', { limit: '1 post per week' }),
    'subs/c': sub('r/c', { limit: '2 posts per 12h' }), 'subs/d': sub('r/d'), 'subs/e': sub('r/e', { limit: '1 post per 24h' }),
    'subs/f': sub('r/f', { limit: 'ask mods first' }), 'subs/g': sub('r/g', { limit: '5 posts per 24h' }), 'subs/h': sub('r/h', { limit: 'Mods decide' })
  };
  const L = await open({ seed }); t.after(() => L.close());
  await L.go('#t/subs');
  const head = () => L.$$('.tbl thead th').find(th => th.textContent.replace(/[↑↓]/g, '') === 'Posting limit');
  L.click(head()); await L.sleep(100);
  assert.deepEqual(column(L, 'Posting limit'),
    ['1 post per 24h', '5 posts per 24h', '2 posts per 12h', '1 post per week', 'ask mods first', 'Mods decide', 'wait for approval', '']);
  L.click(head()); await L.sleep(100);
  assert.deepEqual(column(L, 'Posting limit'),
    ['wait for approval', 'Mods decide', 'ask mods first', '1 post per week', '2 posts per 12h', '5 posts per 24h', '1 post per 24h', '']);
  assert.deepEqual(L.errors, []);
});

test('CSV import turns certain limits into options and keeps any other text', async t => {
  const L = await open(); t.after(() => L.close());
  const cells = [
    ['1 post per 24h', '1 post per 24h'], ['1/day', '1 post per 24h'], ['2 POSTS PER 12 HOURS', '2 posts per 12h'],
    ['1 post a cada 24h', '1 post per 24h'], ['1 post por semana', '1 post per week'], ['ask mods first', 'ask mods first'],
    ['2 posts per week', '2 posts per week'], ['', '']
  ];
  await importCsv(L, ['Subreddit,Posting limit', ...cells.map(([c], i) => `r/n${i},${c}`)].join('\n'), cells.length);
  const subs = Object.entries(L.stored()).filter(([k]) => k.startsWith('subs/')).map(([, v]) => v);
  cells.forEach(([c, want], i) => assert.equal(subs.find(r => r.name === 'r/n' + i).limit || '', want, c));
  assert.deepEqual(L.errors, []);
});
