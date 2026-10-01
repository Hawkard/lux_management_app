import { test } from 'node:test';
import assert from 'node:assert/strict';
import { open } from './harness.mjs';

const sub = (name, extra = {}) => Object.assign({ name, kind: 'NSFW', status: 'Active', tags: [] }, extra);
const box = (L, label) => L.$$('#peek input').find(i => i.getAttribute('aria-label') === label);
const toasts = L => L.$$('.toast').map(x => x.textContent);
const storedIn = (L, col) => Object.entries(L.stored()).filter(([k]) => k.startsWith(col + '/')).map(([, v]) => v);
const byName = (list, key, name) => list.find(r => r[key] === name);

async function openSub(L){
  await L.go('#t/subs');
  L.click(L.$$('.tbl tbody tr')[0]); await L.sleep(200);
}
// Pastes a CSV on the Import & export page and imports it, the way a person would.
async function importCsv(L, text, col, added){
  await L.go('#io');
  L.$('textarea[placeholder^="Or paste"]').value = text;
  L.click(L.button('Read pasted text')); await L.sleep(100);
  assert.equal(L.$('.preview select').value, col, 'the CSV is read as ' + col);
  L.click(L.button('Import'));
  const done = `Import finished: ${added} added, 0 updated, 0 skipped`;
  for (let i = 0; i < 60 && !toasts(L).includes(done); i++) await L.sleep(50);
  assert.ok(toasts(L).includes(done), toasts(L).join(' | '));
}

test('parseShortNumber understands letters, separators and decimals', async t => {
  const L = await open(); t.after(() => L.close());
  const p = L.w.__lux.parseShortNumber;
  // The result is made inside the page, so compare a copy (deepEqual also checks where an object was made).
  const ok = (raw, value) => assert.deepEqual({ ...p(raw) }, { ok: true, value }, JSON.stringify(raw));
  const bad = raw => assert.deepEqual({ ...p(raw) }, { ok: false, value: null }, JSON.stringify(raw));
  ok('100k', 100000); ok('100K', 100000); ok('520k', 520000); ok('1.2m', 1200000); ok('1.2M', 1200000); ok('8.2m', 8200000);
  ok('1,5k', 1500); ok('100,000', 100000); ok('100.000', 100000); ok('520000', 520000);
  ok('+50', 50); ok(' 2.5 K ', 2500); ok('0', 0); ok('1,000,000', 1000000); ok('1.000.000', 1000000); ok('0.5k', 500);
  ok('', null); ok('   ', null); ok(null, null); ok(undefined, null);
  bad('abc'); bad('1.2.3k'); bad('-5'); bad('+'); bad('5k+'); bad('1,000.000'); bad('k'); bad('1e6'); bad('1,2,3');
  // 1,500k could be 1.5k or 1500k, so it is refused. 1,500m can only be 1.5m.
  bad('1,500k'); bad('1.500k'); bad('4,300K'); ok('1,50k', 1500); ok('1,500m', 1500000);
});

test('formatting: short for tables, exact for editing', async t => {
  const L = await open(); t.after(() => L.close());
  const { formatShortNumber: f, editShortNumber: e, parseShortNumber: p } = L.w.__lux;
  assert.equal(f(100000), '100k'); assert.equal(f(520000), '520k'); assert.equal(f(1250), '1.3k'); assert.equal(f(1150), '1.2k');
  assert.equal(f(1200000), '1.2m'); assert.equal(f(999), '999'); assert.equal(f(0), '0'); assert.equal(f(1000), '1k');
  assert.equal(f(999949), '999.9k'); assert.equal(f(999950), '1m'); assert.equal(f(999999), '1m'); assert.equal(f(null), '');
  assert.equal(e(520000), '520k'); assert.equal(e(1500), '1.5k'); assert.equal(e(1200000), '1.2m');
  assert.equal(e(123456), '123,456'); assert.equal(e(1250), '1,250'); assert.equal(e(999), '999'); assert.equal(e(0), '0');
  assert.equal(e(1250000), '1,250,000'); assert.equal(e(1234500), '1,234,500'); assert.equal(e(2500000), '2.5m');
  assert.equal(e(null), ''); assert.equal(e(''), '');
  // What the box shows always reads back as the same number.
  for (const n of [0, 7, 999, 1000, 1100, 1250, 1500, 2300, 10050, 123456, 520000, 999999, 1000000, 1200000, 1250000, 1234500, 8200000, 25000000])
    assert.deepEqual({ ...p(e(n)) }, { ok: true, value: n }, `${n} is shown as ${e(n)}`);
});

test('typing 520k in Members saves 520000 and shows 520k', async t => {
  const L = await open({ seed: { 'subs/s1': sub('r/goth') } }); t.after(() => L.close());
  await openSub(L);
  const members = () => box(L, 'Members');
  assert.equal(members().type, 'text');
  assert.equal(members().getAttribute('inputmode'), null, 'phones keep the letter keys for k and m');
  assert.equal(members().placeholder, 'e.g. 520k');
  L.set(members(), '520k'); await L.sleep(150);
  assert.equal(L.stored()['subs/s1'].members, 520000);
  assert.equal(members().value, '520k');
  for (const typo of ['abc', '1.2.3k', '-5']){
    L.set(members(), typo); await L.sleep(150);
    assert.equal(L.stored()['subs/s1'].members, 520000, typo + ' is refused');
    assert.equal(members().value, '520k', typo + ' is replaced by the saved value');
  }
  assert.equal(toasts(L).filter(x => x === 'Type a number like 520k, 1.2m or 100000. Kept 520k.').length, 3);
  L.set(members(), '1,5k'); await L.sleep(150);
  assert.equal(L.stored()['subs/s1'].members, 1500);
  assert.equal(members().value, '1.5k');
  L.set(members(), '123456'); await L.sleep(150);
  assert.equal(L.stored()['subs/s1'].members, 123456);
  assert.equal(members().value, '123,456', 'the box shows the exact number');
  L.set(members(), '520000'); await L.sleep(150);
  assert.equal(L.stored()['subs/s1'].members, 520000);
  assert.equal(members().value, '520k');
  L.set(box(L, 'Minimum karma'), '100.000'); await L.sleep(150);
  assert.equal(L.stored()['subs/s1'].minKarma, 100000);
  assert.equal(box(L, 'Minimum karma').value, '100k');
  L.click(L.$('.x')); await L.sleep(300);
  const row = L.$('.tbl tbody tr').textContent;
  assert.ok(row.includes('520k') && row.includes('100k'), row);
  assert.deepEqual(L.errors, []);
});

test('an empty box clears the number, and a typo on an empty one says so', async t => {
  const L = await open({ seed: { 'subs/s1': sub('r/goth', { members: 1000 }) } }); t.after(() => L.close());
  await openSub(L);
  assert.equal(box(L, 'Members').value, '1k');
  L.set(box(L, 'Members'), '   '); await L.sleep(150);
  assert.equal(L.stored()['subs/s1'].members, null);
  assert.equal(box(L, 'Members').value, '');
  L.set(box(L, 'Minimum karma'), 'lots'); await L.sleep(150);
  assert.ok(!('minKarma' in L.stored()['subs/s1']), 'nothing is saved');
  assert.equal(box(L, 'Minimum karma').value, '');
  assert.ok(toasts(L).includes('Type a number like 520k, 1.2m or 100000. Kept empty.'));
});

test('a refused number keeps the value saved last, even before the panel redraws', async t => {
  const L = await open({ seed: { 'subs/s1': sub('r/goth', { members: 1000 }) } }); t.after(() => L.close());
  await openSub(L);
  // While someone types in the panel it is not redrawn, so the same box takes the next entry too.
  const members = box(L, 'Members');
  members.focus();
  L.set(members, '520,000'); await L.sleep(150);
  assert.equal(L.stored()['subs/s1'].members, 520000);
  assert.equal(box(L, 'Members'), members, 'the panel was not redrawn');
  assert.equal(members.value, '520k', 'the box shows how the number was read');
  L.set(members, 'abc'); await L.sleep(150);
  assert.equal(L.stored()['subs/s1'].members, 520000);
  assert.equal(members.value, '520k');
  assert.ok(toasts(L).includes('Type a number like 520k, 1.2m or 100000. Kept 520k.'), toasts(L).join(' | '));
  L.set(members, '123456'); await L.sleep(150);
  assert.equal(L.stored()['subs/s1'].members, 123456);
  assert.equal(members.value, '123,456', 'after saving, the box shows the exact number');
});

test('the box opens with the exact number', async t => {
  const L = await open({ seed: { 'subs/s1': sub('r/goth', { members: 123456, minKarma: 1240 }) } }); t.after(() => L.close());
  await openSub(L);
  assert.equal(box(L, 'Members').value, '123,456');
  assert.equal(box(L, 'Minimum karma').value, '1,240');
});

test('in Portuguese the box groups digits the Brazilian way and reads them back', async t => {
  const L = await open({ seed: { 'subs/s1': sub('r/goth', { members: 123456, minKarma: 1240 }) }, lang: 'pt' }); t.after(() => L.close());
  const { editShortNumber: e, parseShortNumber: p } = L.w.__lux;
  for (const n of [1250, 10050, 123456, 999999, 1250000, 1234500])
    assert.deepEqual({ ...p(e(n)) }, { ok: true, value: n }, `${n} is shown as ${e(n)}`);
  await openSub(L);
  assert.equal(box(L, 'Membros').value, '123.456');
  assert.equal(box(L, 'Karma mínimo').value, '1.240');
  L.set(box(L, 'Membros'), '654.321'); await L.sleep(150);
  assert.equal(L.stored()['subs/s1'].members, 654321);
  assert.equal(box(L, 'Membros').value, '654.321');
  // Letters keep the dot in both languages.
  L.set(box(L, 'Membros'), '1,5k'); await L.sleep(150);
  assert.equal(L.stored()['subs/s1'].members, 1500);
  assert.equal(box(L, 'Membros').value, '1.5k');
  L.click(L.$('.x')); await L.sleep(300);
  const row = L.$('.tbl tbody tr').textContent;
  assert.ok(row.includes('1.240') && row.includes('1.5k'), row);
  assert.deepEqual(L.errors, []);
});

test('the number box and its message are translated', async t => {
  const L = await open({ seed: { 'subs/s1': sub('r/goth', { members: 520000 }) }, lang: 'pt' }); t.after(() => L.close());
  await openSub(L);
  const members = box(L, 'Membros');
  assert.equal(members.placeholder, 'ex.: 520k');
  L.set(members, 'abc'); await L.sleep(150);
  assert.ok(toasts(L).includes('Digite um número como 520k, 1.2m ou 100000. Mantido: 520k.'), toasts(L).join(' | '));
  L.set(box(L, 'Karma mínimo'), 'abc'); await L.sleep(150);
  assert.ok(toasts(L).includes('Digite um número como 520k, 1.2m ou 100000. Mantido: vazio.'), toasts(L).join(' | '));
});

test('Subreddits shows 520k-style numbers and still sorts by the real number', async t => {
  const seed = {
    'subs/a': sub('r/a', { members: 999, minKarma: 100 }),
    'subs/b': sub('r/b', { members: 1000, minKarma: 5000 }),
    'subs/c': sub('r/c', { members: 520000, minKarma: 1250 }),
    'subs/d': sub('r/d', { members: 1200000 }),
    'subs/e': sub('r/e', { members: 90000, minKarma: 0 }),
    'subs/f': sub('r/f', { members: 1150, minKarma: 1240 })
  };
  const L = await open({ seed }); t.after(() => L.close());
  await L.go('#t/subs');
  const heads = () => L.$$('.tbl thead th');
  const at = label => heads().findIndex(th => th.textContent.replace(/[↑↓]/g, '') === label);
  const column = label => L.$$('.tbl tbody tr').map(r => r.children[at(label)].textContent);
  // Members are rounded; a minimum karma is a threshold, so it is exact.
  assert.deepEqual(column('Minimum karma'), ['100', '5k', '1,250', '', '0', '1,240']);
  L.click(heads()[at('Members')]); await L.sleep(100);
  assert.deepEqual(column('Members'), ['999', '1k', '1.2k', '90k', '520k', '1.2m']);
  L.click(heads()[at('Members')]); await L.sleep(100);
  assert.deepEqual(column('Members'), ['1.2m', '520k', '90k', '1.2k', '1k', '999']);
  L.click(heads()[at('Minimum karma')]); await L.sleep(100);
  assert.deepEqual(column('Minimum karma'), ['0', '100', '1,240', '1,250', '5k', '']);
  assert.deepEqual(L.errors, []);
});

test('Accounts karma and followers keep the plain number box and full numbers', async t => {
  const seed = { 'accounts/a1': { username: 'alice', platform: 'Reddit', status: 'Active', karma: 12345, followers: 520000 } };
  const L = await open({ seed }); t.after(() => L.close());
  await L.go('#t/accounts');
  // In English, other numbers follow the computer's own number format, as before.
  const row = L.$('.tbl tbody tr').textContent;
  assert.ok(row.includes((12345).toLocaleString()) && row.includes((520000).toLocaleString()), row);
  L.click(L.$('.tbl tbody tr')); await L.sleep(200);
  const karma = box(L, 'Karma');
  assert.equal(karma.type, 'number');
  assert.equal(karma.value, '12345');
  assert.equal(karma.placeholder, 'Empty');
  assert.equal(box(L, 'Followers').type, 'number');
  L.set(karma, '777'); await L.sleep(150);
  assert.equal(L.stored()['accounts/a1'].karma, 777);
  L.set(box(L, 'Karma'), ''); await L.sleep(150);
  assert.equal(L.stored()['accounts/a1'].karma, null);
  assert.deepEqual(L.errors, []);
});

test('CSV import reads 100k, 1,5k and 100.000, in every number field', async t => {
  const L = await open(); t.after(() => L.close());
  // [cell, what 2.8.1 read, what is read now]
  const cells = [
    ['1234', 1234, 1234], ['', null, null], ['"100,000"', 100000, 100000], ['100k members', 100000, 100000], ['500+', 500, 500],
    ['-5', -5, -5], ['abc', null, null], ['1.2M', 1200000, 1200000],
    // 1,500k and 1.500k are refused as typed numbers, so the import reads them the way 2.8.1 did.
    ['"4,300K"', 4300000, 4300000], ['1.500k', 1500, 1500],
    // Read differently now: a Portuguese decimal comma or thousands dot, and a leading +.
    ['"1,5k"', 15000, 1500], ['"10,5k"', 105000, 10500], ['"1,2m"', 12000000, 1200000], ['100.000', 100, 100000],
    ['1.000', 1, 1000], ['12.345', 12, 12345], ['"12,5"', 125, 13], ['"1,5"', 15, 2], ['"0,5"', 5, 1], ['"12,34"', 1234, 12],
    ['+50', null, 50]
  ];
  await importCsv(L, ['Subreddit,Members,Minimum karma', ...cells.map(([c], i) => `r/n${i},${c},${c}`)].join('\n'), 'subs', cells.length);
  const subs = storedIn(L, 'subs');
  cells.forEach(([c, , now], i) => {
    const r = byName(subs, 'name', 'r/n' + i);
    assert.deepEqual([r.members, r.minKarma], [now, now], c);
  });
  // Every number field reads the same way, not only the Subreddits ones.
  await importCsv(L, [
    'Username,Platform,Karma,Followers',
    'alice,Reddit,"12,345",1.2k',
    'bob,TikTok,,3.4m',
    'carol,Instagram,7,"1.234.567"'
  ].join('\n'), 'accounts', 3);
  const accs = storedIn(L, 'accounts');
  const acc = name => { const r = byName(accs, 'username', name); return [r.karma, r.followers]; };
  assert.deepEqual(acc('alice'), [12345, 1200]);
  assert.deepEqual(acc('bob'), [null, 3400000]);
  assert.deepEqual(acc('carol'), [7, 1234567]);
  assert.deepEqual(L.errors, []);
});

test('a Subreddits CSV export has the exact numbers and imports back unchanged', async t => {
  const values = [[520000, 1250], [1200000, 0], [123456, 999999], [7, null], [null, 100000], [1234500, 5000]];
  const seed = {};
  values.forEach(([members, minKarma], i) => { seed['subs/s' + i] = sub('r/sub' + i, { members, minKarma, verification: 'Required', limit: '1 post per 24 h' }); });
  const A = await open({ seed }); t.after(() => A.close());
  await A.go('#t/subs');
  A.click(A.button('Export CSV')); await A.sleep(200);
  const csv = A.$('.modal textarea').value;
  const [head, ...lines] = csv.split(/\r?\n/).map(x => x.split(','));
  const cell = (i, label) => lines.find(r => r[0] === 's' + i)[head.indexOf(label)];
  values.forEach(([members, minKarma], i) => {
    assert.equal(cell(i, 'Members'), members == null ? '' : String(members));
    assert.equal(cell(i, 'Minimum karma'), minKarma == null ? '' : String(minKarma));
  });
  const B = await open(); t.after(() => B.close());
  await importCsv(B, csv, 'subs', values.length);
  values.forEach(([members, minKarma], i) => {
    const r = B.stored()['subs/s' + i];
    assert.equal(r.members, members, 'members of r/sub' + i);
    assert.equal(r.minKarma, minKarma, 'minimum karma of r/sub' + i);
  });
  assert.deepEqual(A.errors, []); assert.deepEqual(B.errors, []);
});
