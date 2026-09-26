import { test } from 'node:test';
import assert from 'node:assert/strict';
import { open } from './harness.mjs';

const today = new Date();
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const weekStart = d => { const x = new Date(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return ymd(x); };
const lastYear = new Date(today.getFullYear() - 1, 2, 10);
const daysAgo = n => new Date(today.getFullYear(), today.getMonth(), today.getDate() - n);
const tmOf = i => pad(Math.floor(i / 60)) + ':' + pad(i % 60);
const monthFirst = ymd(new Date(today.getFullYear(), today.getMonth(), 1));
const monthLast = ymd(new Date(today.getFullYear(), today.getMonth() + 1, 0));

const seed = {
  ['posts/' + weekStart(today) + '_local']: { weekStart: weekStart(today), uid: 'local', entries: [
    { id: 'p1', d: ymd(today), tm: '10:00', p: 'Reddit', q: 1, ty: 'Post', sub: 'r/goth', title: 'Today' } ] },
  ['posts/' + weekStart(lastYear) + '_local']: { weekStart: weekStart(lastYear), uid: 'local', entries: [
    { id: 'p2', d: ymd(lastYear), tm: '09:00', p: 'TikTok', q: 1, ty: 'Video', title: 'Last year' } ] }
};

// Posts ({date, ...fields}) stored in weekly documents, the way the program stores them.
function postsSeed(list){
  const out = {};
  list.forEach(({ date, ...e }, i) => {
    const key = 'posts/' + weekStart(date) + '_local';
    out[key] = out[key] || { weekStart: weekStart(date), uid: 'local', entries: [] };
    out[key].entries.push(Object.assign({ id: 'x' + i, d: ymd(date), tm: '12:00', p: 'TikTok', q: 1, ty: 'Video' }, e));
  });
  return out;
}
const days = n => Array.from({ length: n }, (_, i) => ({ date: daysAgo(i) }));
const hasText = (L, text) => L.$$('p').some(p => p.textContent === text);
const mode = (L, label) => L.click([...L.$$('.toolbar-row .seg')[0].querySelectorAll('button')].find(b => b.textContent === label));

test('All time sits right of This month and shows every post', async t => {
  const L = await open({ seed }); t.after(() => L.close());
  await L.go('#posts');
  const labels = L.$$('.toolbar-row .seg')[1].querySelectorAll('button');
  assert.deepEqual([...labels].map(b => b.textContent), ['Today', 'Yesterday', 'This week', 'This month', 'All time']);
  L.click(L.button('This month')); await L.sleep(300);
  assert.equal(L.$$('.entry').length, 1);
  L.click(L.button('All time')); await L.sleep(300);
  assert.equal(L.$$('.entry').length, 2);
  L.click(L.button('This month')); await L.sleep(300);
  assert.deepEqual(L.$$('.entry .etitle').map(x => x.textContent), ['Today']);
  assert.deepEqual(L.errors, []);
});

test('All time is translated', async t => {
  const L = await open({ seed, lang: 'pt' }); t.after(() => L.close());
  await L.go('#posts');
  assert.ok(L.$$('.toolbar-row .seg')[1].textContent.includes('Todo o período'));
});

test('All time lists the latest 120 days and says so', async t => {
  const L = await open({ seed: postsSeed(days(125)) }); t.after(() => L.close());
  await L.go('#posts');
  L.click(L.button('All time')); await L.sleep(300);
  assert.equal(L.$$('.daygroup').length, 120);
  assert.ok(hasText(L, 'Showing the latest 120 days. Export CSV to see everything.'));
  L.click(L.button('This month')); await L.sleep(300);
  assert.ok(!L.$$('p').some(p => p.textContent.startsWith('Showing the latest')));
  assert.deepEqual(L.errors, []);
});

test('exactly 120 days need no note', async t => {
  const L = await open({ seed: postsSeed(days(120)) }); t.after(() => L.close());
  await L.go('#posts');
  L.click(L.button('All time')); await L.sleep(300);
  assert.equal(L.$$('.daygroup').length, 120);
  assert.ok(!L.$$('p').some(p => p.textContent.startsWith('Showing the latest')));
});

test('the 120-day note is translated', async t => {
  const L = await open({ seed: postsSeed(days(121)), lang: 'pt' }); t.after(() => L.close());
  await L.go('#posts');
  L.click(L.button('Todo o período')); await L.sleep(300);
  assert.equal(L.$$('.daygroup').length, 120);
  assert.ok(hasText(L, 'Mostrando os últimos 120 dias. Exporte o CSV para ver tudo.'));
  assert.deepEqual(L.errors, []);
});

test('All time stops the day list at about 2000 posts', async t => {
  const list = [];
  for (let d = 0; d < 3; d++) for (let i = 0; i < 1000; i++) list.push({ date: daysAgo(d), tm: tmOf(i) });
  const L = await open({ seed: postsSeed(list) }); t.after(() => L.close());
  await L.go('#posts');
  L.click(L.button('All time')); await L.sleep(500);
  assert.equal(L.$$('.daygroup').length, 2);
  assert.equal(L.$$('.entry').length, 2000);
  assert.ok(hasText(L, 'Showing the latest 2 days. Export CSV to see everything.'));
  assert.ok(L.$$('.tbl b').some(b => b.textContent === '3000'), 'the summary still counts every post');
  assert.deepEqual(L.errors, []);
});

test('Stats shows the latest 1500 posts, Subreddits still counts every post', async t => {
  // 800 posts today and 800 yesterday; "Post 799" is the newest, "Post 800" the oldest.
  const list = Array.from({ length: 1600 }, (_, i) => ({ date: daysAgo(Math.floor(i / 800)), tm: tmOf(i % 800),
    p: 'Reddit', ty: 'Post', sub: 'r/goth', views: 10, ups: 1, statsAt: 1, title: 'Post ' + i }));
  const L = await open({ seed: postsSeed(list) }); t.after(() => L.close());
  await L.go('#posts');
  L.click(L.button('All time')); await L.sleep(300);
  mode(L, 'Stats'); await L.sleep(500);
  const titles = L.$$('.tbl tbody tr').map(r => r.children[4].firstChild.textContent);
  assert.equal(titles.length, 1500);
  assert.equal(titles[0], 'Post 799');
  assert.ok(titles.includes('Post 900') && !titles.includes('Post 899') && !titles.includes('Post 800'));
  assert.ok(hasText(L, 'Showing the latest 1500 posts. Export CSV to see everything.'));
  mode(L, 'Subreddits'); await L.sleep(300);
  const goth = L.$$('.tbl tbody tr').find(r => r.children[0].textContent === 'r/goth');
  assert.equal(goth.children[1].textContent, '1600');
  assert.ok(!L.$$('p').some(p => p.textContent.startsWith('Showing the latest')));
  assert.deepEqual(L.errors, []);
});

test('the All time CSV is named for all time and logged as such', async t => {
  const L = await open({ seed }); t.after(() => L.close());
  await L.go('#posts');
  // In local preview the file is shown in a text box, titled with its file name.
  const exportCsv = async () => {
    L.click(L.button('Export CSV')); await L.sleep(200);
    const box = L.$('.modal');
    const out = { name: box.querySelector('h2').textContent, lines: box.querySelector('textarea').value.split(/\r?\n/) };
    L.click(box.querySelector('button.primary')); await L.sleep(200);
    return out;
  };
  L.click(L.button('All time')); await L.sleep(300);
  const all = await exportCsv();
  assert.equal(all.name, `lux-posting-log-all-${ymd(today)}.csv`);
  assert.equal(all.lines.length, 3);
  L.click(L.button('This month')); await L.sleep(300);
  const month = await exportCsv();
  assert.equal(month.name, `lux-posting-log-${monthFirst}-to-${monthLast}.csv`);
  assert.equal(month.lines.length, 2);
  const logged = Object.entries(L.stored()).filter(([k]) => k.startsWith('audit/local/m/'))
    .flatMap(([, v]) => v.entries).filter(e => e.a === 'exported').map(e => e.ch[0].to);
  assert.deepEqual(logged.sort(), ['Posting log, all time', `Posting log ${monthFirst} to ${monthLast}`].sort());
  assert.deepEqual(L.errors, []);
});

test('web store: a collection can be read newest first', async t => {
  const L = await open(); t.after(() => L.close());
  const calls = [];
  const query = parts => ({
    orderBy: (f, dir) => query(parts.concat(`orderBy(${f},${dir})`)),
    limit: n => query(parts.concat(`limit(${n})`)),
    onSnapshot: next => { calls.push(parts.join('.')); next({ docs: [] }); return () => {}; }
  });
  const store = L.w.__lux.makeRemoteStore({ collection: c => query([`collection(${c})`]) });
  store.watchCol('posts', () => {}, () => {}, 'weekStart');
  store.watchCol('models', () => {}, () => {});
  assert.deepEqual(calls, ['collection(posts).orderBy(weekStart,desc).limit(1000)', 'collection(models).limit(1000)']);
});

// A stand-in for the web version's database: documents in memory, with where, orderBy and limit applied
// the way the real one does (no orderBy means document id order). It records every live query.
function fakeDb(docs){
  const queries = [];
  const copy = o => JSON.parse(JSON.stringify(o));
  const run = (col, ops) => {
    let list = Object.keys(docs).filter(p => p.slice(0, p.lastIndexOf('/')) === col).sort()
      .map(p => ({ id: p.slice(p.lastIndexOf('/') + 1), body: docs[p] }));
    for (const o of ops){
      if (o.where) list = list.filter(r => o.op === 'in' ? o.v.includes(r.body[o.where]) : o.op === '==' ? r.body[o.where] === o.v : true);
      if (o.orderBy) list = list.slice().sort((a, b) => (a.body[o.orderBy] < b.body[o.orderBy] ? -1 : a.body[o.orderBy] > b.body[o.orderBy] ? 1 : 0) * (o.dir === 'desc' ? -1 : 1));
      if (o.limit) list = list.slice(0, o.limit);
    }
    return { docs: list.map(r => ({ id: r.id, exists: true, data: () => copy(r.body) })) };
  };
  const doc = p => ({
    get: async () => ({ id: p.slice(p.lastIndexOf('/') + 1), exists: p in docs, data: () => (p in docs ? copy(docs[p]) : undefined) }),
    set: async d => { docs[p] = copy(d); },
    update: async d => { Object.assign(docs[p], copy(d)); },
    delete: async () => { delete docs[p]; }
  });
  const query = (col, ops) => ({
    where: (f, op, v) => query(col, ops.concat({ where: f, op, v })),
    orderBy: (f, dir = 'asc') => query(col, ops.concat({ orderBy: f, dir })),
    limit: n => query(col, ops.concat({ limit: n })),
    get: async () => run(col, ops),
    onSnapshot: next => { queries.push({ col, ops }); setTimeout(() => next(run(col, ops)), 0); return () => {}; },
    doc: id => doc(col + '/' + id)
  });
  return { queries, db: { collection: c => query(c, []), doc } };
}

test('web version: All time shows the newest 1000 weeks and says older ones are left out', async t => {
  // 1005 weekly documents with one post each: "Newest" this week, "Oldest" 1004 weeks ago.
  const docs = {};
  for (let i = 0; i < 1005; i++){
    const ws = weekStart(daysAgo(7 * i));
    docs[`posts/${ws}_u1`] = { weekStart: ws, uid: 'u1', entries: [
      { id: 'w' + i, d: ws, tm: '10:00', p: 'TikTok', q: 1, ty: 'Video', title: i === 0 ? 'Newest' : i === 1004 ? 'Oldest' : 'Week ' + i } ] };
  }
  const { db, queries } = fakeDb(docs);
  const L = await open({ claude: { use: async name => name === 'db' ? db : null } }); t.after(() => L.close());
  await L.go('#posts');
  const olderNote = 'Only the most recent weeks are loaded here, so older posts are not shown or exported.';
  L.click(L.button('All time')); await L.sleep(400);
  assert.deepEqual(queries.filter(q => q.col === 'posts').pop().ops, [{ orderBy: 'weekStart', dir: 'desc' }, { limit: 1000 }]);
  assert.equal(L.$('.entry .etitle').textContent, 'Newest');
  assert.ok(L.$$('.tbl b').some(b => b.textContent === '1000'), 'the newest 1000 weeks are loaded');
  assert.ok(hasText(L, olderNote));
  L.click(L.button('This month')); await L.sleep(400);
  assert.equal(queries.filter(q => q.col === 'posts').pop().ops[0].where, 'weekStart');
  assert.ok(!hasText(L, olderNote));
  assert.deepEqual(L.errors, []);
});
