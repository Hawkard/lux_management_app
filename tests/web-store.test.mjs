import { test } from 'node:test';
import assert from 'node:assert/strict';
import { open, sleep } from './harness.mjs';

// A stand-in for the Claude artifact database that keeps its rules: a query returns at most 1000 documents
// (limit 1-1000), in document id order unless ordered by a field (documents without the field last); an "in" filter
// takes at most 30 values; at most 10 filters and one orderBy. Every read gives a fresh copy. Subscriptions hear about
// every change. queries counts the reads and subscriptions opened, and live the subscriptions still open.
function fakeDb(start = {}){
  const docs = new Map(Object.entries(start).map(([p, d]) => [p, JSON.parse(JSON.stringify(d))]));
  const subs = new Set();
  const stats = { queries: 0, live: 0, writes: [] };
  const bad = m => Object.assign(new Error(m), { code: 'invalid_argument' });
  const cmp = (a, b) => a < b ? -1 : a > b ? 1 : 0;
  const parent = p => p.slice(0, p.lastIndexOf('/'));
  const snapDoc = p => ({ id: p.slice(p.lastIndexOf('/') + 1), exists: docs.has(p), data: () => docs.has(p) ? JSON.parse(JSON.stringify(docs.get(p))) : undefined });
  const test1 = (d, [f, op, v]) => {
    const x = d[f];
    if (op === '==') return x === v;
    if (op === 'in') return v.includes(x);
    if (x === undefined) return false;
    return op === '>' ? x > v : op === '>=' ? x >= v : op === '<' ? x < v : op === '<=' ? x <= v : op === '!=' ? x !== v : false;
  };
  const query = (col, wh = [], ord = null, lim = null) => {
    const run = () => {
      if (lim === null || lim < 1 || lim > 1000) throw bad('limit must be 1-1000');
      if (wh.length > 10) throw bad('too many filters');
      for (const w of wh) if (w[1] === 'in' && (!Array.isArray(w[2]) || w[2].length > 30)) throw bad('in takes at most 30 values');
      stats.queries++;
      let ps = [...docs.keys()].filter(p => parent(p) === col && wh.every(w => test1(docs.get(p), w))).sort(cmp);
      if (ord){
        const has = ps.filter(p => docs.get(p)[ord] !== undefined), not = ps.filter(p => docs.get(p)[ord] === undefined);
        ps = has.sort((a, b) => cmp(docs.get(a)[ord], docs.get(b)[ord]) || cmp(a, b)).concat(not);
      }
      return { docs: ps.slice(0, lim).map(snapDoc), metadata: { fromCache: false } };
    };
    return {
      where: (f, op, v) => query(col, wh.concat([[f, op, v]]), ord, lim),
      orderBy: f => { if (ord) throw bad('one orderBy'); return query(col, wh, f, lim); },
      limit: n => query(col, wh, ord, n),
      get: async () => run(),
      onSnapshot: (next, err) => {
        const sub = () => { try { next(run()); } catch (e){ if (err) err(e); } };
        subs.add(sub); stats.live++;
        setTimeout(() => subs.has(sub) && sub(), 0);
        return () => { if (subs.delete(sub)) stats.live--; };
      }
    };
  };
  const changed = () => setTimeout(() => [...subs].forEach(s => s()), 0);
  const db = {
    collection: c => query(c),
    doc: p => ({
      get: async () => snapDoc(p),
      set: async d => { docs.set(p, JSON.parse(JSON.stringify(d))); stats.writes.push(p); changed(); },
      update: async d => { if (!docs.has(p)) throw Object.assign(new Error('missing'), { code: 'invalid_argument' }); Object.assign(docs.get(p), JSON.parse(JSON.stringify(d))); stats.writes.push(p); changed(); },
      delete: async () => { docs.delete(p); changed(); }
    })
  };
  return { db, docs, stats };
}
const plain = o => JSON.parse(JSON.stringify(o));
const pad = n => String(n).padStart(5, '0');
// n documents in col, with the key field newer versions of Lux write, or without it (written before 2.9.3).
const many = (col, n, make, { keyed = true, from = 0 } = {}) => Object.fromEntries(Array.from({ length: n }, (_, i) => {
  const id = 'r' + pad(from + i);
  return [col + '/' + id, Object.assign(make(i), keyed ? { _k: id } : {})];
}));
async function store(start, canWrite = true){
  const L = await open();
  const F = fakeDb(start);
  return { L, F, S: L.w.__lux.makeRemoteStore(F.db, () => canWrite) };
}

test('web store: a collection of more than 1000 documents is read whole, each document once', async t => {
  const { L, F, S } = await store(many('subs', 2600, i => ({ name: 'r/s' + i })));
  t.after(() => L.close());
  const rows = await S.getCol('subs');
  assert.equal(rows.length, 2600);
  assert.equal(new Set(rows.map(r => r.id)).size, 2600);
  assert.ok(rows.every(r => !('_k' in r)), 'the key field stays inside the store');
  // A small collection still takes a single query.
  const before = F.stats.queries;
  F.docs.set('people/u1', { name: 'Ana' });
  assert.equal((await S.getCol('people')).length, 1);
  assert.equal(F.stats.queries - before, 1);
});

test('web store: "in" with more than 30 values and more than 1000 matches', async t => {
  const weeks = Array.from({ length: 45 }, (_, i) => 'w' + pad(i));
  // 45 weeks x 30 people = 1350 weekly documents, plus some outside the weeks asked for.
  const start = {};
  for (let w = 0; w < 50; w++) for (let u = 0; u < 30; u++){ const id = 'w' + pad(w) + '_u' + u; start['posts/' + id] = { weekStart: 'w' + pad(w), uid: 'u' + u, entries: [], _k: id }; }
  const { L, S } = await store(start);
  t.after(() => L.close());
  const rows = await S.getWhere('posts', 'weekStart', 'in', weeks);
  assert.equal(rows.length, 1350);
  assert.ok(rows.every(r => weeks.includes(r.weekStart)));
  assert.deepEqual(plain(await S.getWhere('posts', 'weekStart', 'in', [])), []);
});

test('web store: writes carry the key field, reads never show it', async t => {
  const { L, F, S } = await store({});
  t.after(() => L.close());
  await S.set('models/m1', { name: 'Ava' });
  await S.update('models/m1', { status: 'Active' });
  await S.mutate('posts/w1_u1', d => { assert.equal(d, null); return { weekStart: 'w1', entries: [1] }; });
  await S.mutate('posts/w1_u1', d => { assert.deepEqual(plain(d), { weekStart: 'w1', entries: [1] }); return Object.assign(d, { entries: [1, 2] }); });
  assert.deepEqual(F.docs.get('models/m1'), { name: 'Ava', status: 'Active', _k: 'm1' });
  assert.equal(F.docs.get('posts/w1_u1')._k, 'w1_u1');
  assert.deepEqual(plain(await S.get('models/m1')), { id: 'm1', name: 'Ava', status: 'Active' });
});

test('web store: documents written before 2.9.3 are still found, and get the key field from someone who can write', async t => {
  // The first 1000 by id have no key field; 300 newer ones do.
  const start = Object.assign(many('accounts', 1000, i => ({ username: 'a' + i }), { keyed: false }), many('accounts', 300, i => ({ username: 'b' + i }), { from: 1000 }));
  const { L, F, S } = await store(start);
  t.after(() => L.close());
  assert.equal((await S.getCol('accounts')).length, 1300);
  for (let i = 0; i < 1200 && [...F.docs.values()].some(d => !d._k); i++) await sleep(50);
  assert.ok([...F.docs.entries()].every(([p, d]) => d._k === p.split('/')[1]), 'every older document got its key');
  // Now more than 1000 of them, out of the first page, are found by key too.
  F.docs.set('accounts/a00000', { username: 'first', _k: 'a00000' });
  assert.equal((await S.getCol('accounts')).length, 1301);
  // Someone who can only view never writes.
  const v = await store(many('accounts', 5, i => ({ username: 'c' + i }), { keyed: false }), false);
  t.after(() => v.L.close());
  assert.equal((await v.S.getCol('accounts')).length, 5);
  await sleep(300);
  assert.deepEqual(v.F.stats.writes, []);
});

test('web store: a live collection of more than 1000 documents stays whole as documents come and go', async t => {
  const { L, F, S } = await store(many('subs', 2500, i => ({ name: 'r/s' + i })));
  t.after(() => L.close());
  const seen = [];
  const stop = S.watchCol('subs', (rows, fin) => seen.push({ n: rows.length, fin, ids: new Set(rows.map(r => r.id)) }));
  for (let i = 0; i < 100 && !(seen.length && seen.at(-1).fin && seen.at(-1).n === 2500); i++) await sleep(20);
  assert.equal(seen.at(-1).n, 2500);
  assert.ok(seen.at(-1).fin);
  assert.ok(seen.filter(s => s.fin).every(s => s.n === 2500), 'a list marked final is never short');
  // A teammate adds one that sorts first (every page boundary moves) and deletes one from the last page.
  const mark = seen.length;
  await S.set('subs/a0', { name: 'r/first' });
  await F.db.doc('subs/r02499').delete();
  for (let i = 0; i < 100 && !(seen.length > mark && seen.at(-1).ids.has('a0') && !seen.at(-1).ids.has('r02499') && seen.at(-1).n === 2500); i++) await sleep(20);
  const last = seen.at(-1);
  assert.equal(last.n, 2500);
  assert.ok(last.ids.has('a0') && !last.ids.has('r02499'));
  assert.ok(seen.slice(mark).every(s => s.n >= 2499), 'nothing seems to disappear while pages move');
  assert.ok(F.stats.live <= 4, 'one subscription per page of 1000: ' + F.stats.live);
  stop();
  await sleep(50);
  assert.equal(F.stats.live, 0);
  // A small live collection is a single subscription, final from its first answer.
  const one = [];
  const stop2 = S.watchCol('people', (rows, fin) => one.push(fin));
  await sleep(50);
  assert.deepEqual(one, [true]);
  assert.equal(F.stats.live, 1);
  stop2();
});

test('web version: a workspace with 1500 subreddits and 1100 posting-log weeks shows and exports everything', async t => {
  const subs = many('subs', 1500, i => ({ name: 'r/sub' + i, kind: 'SFW', tags: [], createdAt: 1, updatedAt: 1 }));
  const posts = {};
  for (let i = 0; i < 1100; i++){
    const id = '2020-01-06_u' + i;
    posts['posts/' + id] = { weekStart: '2020-01-06', uid: 'u' + i, entries: [{ id: 'e' + i, d: '2020-01-06', p: 'Reddit', url: 'https://www.reddit.com/r/a/comments/' + i + '/' }], _k: id };
  }
  const F = fakeDb(Object.assign(subs, posts));
  const user = { me: async () => ({ id: 'u0', name: 'Ana', isOwner: true }), can: async () => true, profiles: async () => ({}) };
  const claude = { use: async n => n === 'db' ? F.db : n === 'user' ? user : null };
  const L = await open({ claude });
  t.after(() => L.close());
  const st = L.w.__lux.state;
  for (let i = 0; i < 100 && st().data.subs.size !== 1500; i++) await sleep(50);
  const navCount = L.$$('#side .navi').find(b => /Subreddits/.test(b.textContent));
  assert.match(navCount.textContent, /1500/);
  await L.go('#posts');
  L.click(L.button('All time'));
  for (let i = 0; i < 100 && (st().posts || []).length !== 1100; i++) await sleep(50);
  assert.equal(st().posts.length, 1100);
  assert.equal(L.$('#page').textContent.includes('Only the most recent weeks are loaded'), false);
  assert.deepEqual(L.errors, []);
});
