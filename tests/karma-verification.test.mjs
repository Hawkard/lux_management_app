import { test } from 'node:test';
import assert from 'node:assert/strict';
import { open } from './harness.mjs';

const OPTIONS = ['Required', 'Karma Verification', 'Not required', 'Unknown'];
// How Portuguese shows each option. What is stored is always the English one.
const PT_OPTIONS = ['Obrigatória', 'Verificação por karma', 'Não obrigatória', 'Não sei'];

const sub = (name, extra = {}) => Object.assign({ name, kind: 'NSFW', status: 'Active', tags: [] }, extra);
const ava = (extra = {}) => Object.assign({ name: 'Ava', status: 'Active', niche: ['Goth'], nsfwSubs: [], sfwSubs: [], platforms: ['Reddit'], employees: [] }, extra);
const verificationBox = (L, label = 'Verification') => L.$$('#peek select').find(s => s.getAttribute('aria-label') === label);
const shown = sel => sel.options[sel.selectedIndex].textContent;
const toasts = L => L.$$('.toast').map(x => x.textContent);
const localAudit = L => Object.entries(L.stored()).filter(([k]) => k.startsWith('audit/local/m/')).flatMap(([, v]) => v.entries);
const storedSubs = L => Object.entries(L.stored()).filter(([k]) => k.startsWith('subs/')).map(([, v]) => v);
// The cells of one column of the table, top to bottom.
function cells(L, label){
  const i = L.$$('.tbl thead th').findIndex(th => th.textContent.replace(/[↑↓]/g, '') === label);
  assert.ok(i >= 0, 'column ' + label);
  return L.$$('.tbl tbody tr').map(r => r.children[i]);
}
const column = (L, label) => cells(L, label).map(c => c.textContent);
async function openSub(L, name){
  await L.go('#t/subs');
  L.click(L.$$('.tbl tbody tr').find(r => r.children[0].textContent === name)); await L.sleep(200);
}
async function openModel(L){
  await L.go('#t/models');
  L.click(L.$$('.tbl tbody tr')[0]); await L.sleep(300);
}
const suggestion = (L, name) => L.$$('#peek .suggrow').find(r => r.querySelector('.sublink').textContent === name);
const noteOf = (L, name) => suggestion(L, name).querySelector('.note').textContent;
const savedNotes = L => L.stored()['models/m1'].nsfwSubs.map(x => `${x.n}: ${x.note}`);
// Pastes a CSV on the Import & export page and imports it, the way a person would.
async function importCsv(L, text, done){
  await L.go('#io');
  L.$('textarea[placeholder^="Or paste"]').value = text;
  L.click(L.button('Read pasted text')); await L.sleep(100);
  assert.equal(L.$('.preview select').value, 'subs', 'the CSV is read as subreddits');
  L.click(L.button('Import'));
  for (let i = 0; i < 60 && !toasts(L).includes(done); i++) await L.sleep(50);
  assert.ok(toasts(L).includes(done), toasts(L).join(' | '));
}

test('Karma Verification can be chosen and shows in suggestions', async t => {
  const L = await open({ seed: {
    'subs/s1': sub('r/goth', { tags: ['Goth'], minKarma: 500 }),
    'models/m1': ava()
  } }); t.after(() => L.close());
  await openSub(L, 'r/goth');
  const sel = verificationBox(L);
  assert.deepEqual([...sel.options].map(o => o.value), ['', ...OPTIONS]);
  assert.deepEqual([...sel.options].map(o => o.textContent), ['—', ...OPTIONS]);
  L.set(sel, 'Karma Verification'); await L.sleep(150);
  assert.equal(L.stored()['subs/s1'].verification, 'Karma Verification');
  assert.equal(shown(verificationBox(L)), 'Karma Verification');
  assert.ok(localAudit(L).some(e => e.a === 'updated' && e.ch.some(c => c.f === 'Verification' && c.to === 'Karma Verification')), 'the choice is in the audit log');
  L.click(L.$('.x')); await L.sleep(300);
  // In the table it is a warning, like Required: both ask for something before posting.
  const chip = cells(L, 'Verification')[0].querySelector('.chip');
  assert.equal(chip.textContent, 'Karma Verification');
  assert.ok(chip.classList.contains('t-warn'), chip.className);
  await openModel(L);
  assert.equal(noteOf(L, 'r/goth'), 'Karma verification required · Min. karma 500');
  L.click(suggestion(L, 'r/goth').querySelector('.btn.primary')); await L.sleep(300);
  assert.deepEqual(savedNotes(L), ['r/goth: Karma verification required · Min. karma 500']);
  assert.deepEqual(L.errors, []);
});

test('in Portuguese it is shown translated, and what is saved stays in English', async t => {
  const seed = {
    'subs/s1': sub('r/goth', { tags: ['Goth'], verification: 'Karma Verification', minKarma: 500 }),
    'subs/s2': sub('r/alt', { tags: ['Goth'], verification: 'Required' }),
    'subs/s3': sub('r/emo', { tags: ['Goth'], verification: 'Not required' }),
    'subs/s4': sub('r/dark', { tags: ['Goth'], verification: 'Karma Verification' }),
    'models/m1': ava()
  };
  const L = await open({ seed, lang: 'pt' }); t.after(() => L.close());
  await L.go('#t/subs');
  assert.deepEqual(column(L, 'Verificação'), ['Obrigatória', 'Verificação por karma', 'Não obrigatória', 'Verificação por karma']);
  // The filter shows Portuguese and filters by the stored English value.
  const filter = L.$$('.toolbar-row select').find(s => s.getAttribute('aria-label') === 'Verificação');
  assert.deepEqual([...filter.options].map(o => o.textContent), ['Verificação: qualquer', ...PT_OPTIONS]);
  assert.deepEqual([...filter.options].map(o => o.value), ['', ...OPTIONS]);
  L.set(filter, 'Karma Verification'); await L.sleep(100);
  assert.deepEqual(L.$$('.tbl tbody tr').map(r => r.children[0].textContent), ['r/dark', 'r/goth']);
  L.set(filter, ''); await L.sleep(100);
  // The panel: Portuguese labels, English values.
  await openSub(L, 'r/goth');
  const sel = verificationBox(L, 'Verificação');
  assert.equal(sel.value, 'Karma Verification');
  assert.equal(shown(sel), 'Verificação por karma');
  assert.deepEqual([...sel.options].map(o => o.textContent), ['—', ...PT_OPTIONS]);
  L.click(L.$('.x')); await L.sleep(300);
  // Her suggestions say it in Portuguese.
  await openModel(L);
  assert.equal(noteOf(L, 'r/goth'), 'Verificação por karma obrigatória · Karma mín. 500');
  assert.equal(noteOf(L, 'r/alt'), 'Verificação obrigatória');
  assert.equal(noteOf(L, 'r/emo'), '');
  // Adding them to her list saves the notes in English, like every saved note.
  L.click(suggestion(L, 'r/goth').querySelector('.btn.primary')); await L.sleep(300);
  L.click(suggestion(L, 'r/alt').querySelector('.btn.primary')); await L.sleep(300);
  assert.deepEqual(savedNotes(L), ['r/goth: Karma verification required · Min. karma 500', 'r/alt: Verification required']);
  L.click(L.$('.x')); await L.sleep(300);
  // Assigning her from the subreddit's own panel saves the same English note.
  await openSub(L, 'r/dark');
  L.click(L.$$('#peek button').find(b => b.textContent === 'Atribuir')); await L.sleep(300);
  assert.deepEqual(savedNotes(L), ['r/goth: Karma verification required · Min. karma 500', 'r/alt: Verification required', 'r/dark: Karma verification required']);
  assert.deepEqual(L.errors, []);
});

test('CSV import reads Karma Verification, and every other cell as before', async t => {
  const L = await open(); t.after(() => L.close());
  // [cell, what 2.8.1 read, what is read now]. A cell Lux can't read leaves the default, Unknown.
  const cases = [
    // Read as before.
    ['Required', 'Required', 'Required'], ['required', 'Required', 'Required'], ['yes', 'Required', 'Required'], ['Y', 'Required', 'Required'],
    ['sim', 'Required', 'Required'], ['Obrigatória', 'Required', 'Required'],
    ['Not required', 'Not required', 'Not required'], ['not required', 'Not required', 'Not required'], ['no', 'Not required', 'Not required'],
    ['None', 'Not required', 'Not required'], ['não', 'Not required', 'Not required'], ['Não obrigatória', 'Not required', 'Not required'],
    ['Unknown', 'Unknown', 'Unknown'], ['Não sei', 'Unknown', 'Unknown'], ['', 'Unknown', 'Unknown'], ['ask the mods', 'Unknown', 'Unknown'],
    ['photo verification', 'Unknown', 'Unknown'],
    // Any mention of karma is karma verification now.
    ['Karma Verification', 'Unknown', 'Karma Verification'], ['karma verification', 'Unknown', 'Karma Verification'],
    ['karma', 'Unknown', 'Karma Verification'], ['KARMA', 'Unknown', 'Karma Verification'],
    ['Verificação por karma', 'Unknown', 'Karma Verification'], ['verificação por karma obrigatória', 'Unknown', 'Karma Verification'],
    ['Karma verification required', 'Unknown', 'Karma Verification'], ['required (karma 500+)', 'Unknown', 'Karma Verification'],
    ['500+ karma', 'Unknown', 'Karma Verification'], ['karma (no mínimo 500)', 'Unknown', 'Karma Verification'],
    // Unless it also says no, never or optional: that is unclear, so it is left out as before.
    ['no karma verification', 'Unknown', 'Unknown'], ['karma not required', 'Unknown', 'Unknown'],
    ['not required (karma 500+)', 'Unknown', 'Unknown'], ['No (karma 100+)', 'Unknown', 'Unknown'], ['none, karma only', 'Unknown', 'Unknown'],
    ['without karma check', 'Unknown', 'Unknown'], ['karma: n/a', 'Unknown', 'Unknown'], ['sem verificação por karma', 'Unknown', 'Unknown'],
    ['karma: não', 'Unknown', 'Unknown'], ['KARMA: NÃO', 'Unknown', 'Unknown'],
    ['Nenhuma verificação de karma', 'Unknown', 'Unknown'], ['Karma: nenhum', 'Unknown', 'Unknown'], ['Karma: opcional', 'Unknown', 'Unknown'],
    ['Karma: nunca', 'Unknown', 'Unknown'], ['Karma dispensado', 'Unknown', 'Unknown'], ['Verificação por karma dispensada', 'Unknown', 'Unknown'],
    ['Isento de karma', 'Unknown', 'Unknown'], ['Isenta de karma', 'Unknown', 'Unknown'],
    ["Karma isn't required", 'Unknown', 'Unknown'], ['Karma isn’t required', 'Unknown', 'Unknown'], ["Doesn't need karma", 'Unknown', 'Unknown'],
    ["Karma doesn't matter", 'Unknown', 'Unknown'], ['Karma optional', 'Unknown', 'Unknown'], ['Karma: never', 'Unknown', 'Unknown'],
    // Or it also asks for a photo or selfie, which Karma Verification would lose.
    ['Photo verification required (min karma 100)', 'Unknown', 'Unknown'], ['Selfie verification, karma 50', 'Unknown', 'Unknown'],
    ['Obrigatória (foto), karma 100+', 'Unknown', 'Unknown'], ['Verificação com foto + karma 100', 'Unknown', 'Unknown']
  ];
  const csv = ['Subreddit,Verification', ...cases.map(([c], i) => `r/n${i},${/,/.test(c) ? `"${c}"` : c}`)].join('\n');
  await importCsv(L, csv, `Import finished: ${cases.length} added, 0 updated, 0 skipped`);
  const subs = storedSubs(L);
  cases.forEach(([c, , now], i) => assert.equal(subs.find(r => r.name === 'r/n' + i).verification, now, JSON.stringify(c)));
  assert.deepEqual(L.errors, []);
});

test('a CSV export keeps Karma Verification, and importing it back or updating the subreddit keeps it too', async t => {
  const A = await open({ seed: { 'subs/s1': sub('r/goth', { verification: 'Karma Verification' }), 'subs/s2': sub('r/alt', { verification: 'Required' }) } });
  t.after(() => A.close());
  await A.go('#t/subs');
  A.click(A.button('Export CSV')); await A.sleep(200);
  const csv = A.$('.modal textarea').value;
  const [head, ...lines] = csv.split(/\r?\n/).map(x => x.split(','));
  assert.equal(lines.find(r => r[0] === 's1')[head.indexOf('Verification')], 'Karma Verification');
  const B = await open(); t.after(() => B.close());
  await importCsv(B, csv, 'Import finished: 2 added, 0 updated, 0 skipped');
  assert.equal(B.stored()['subs/s1'].verification, 'Karma Verification');
  assert.equal(B.stored()['subs/s2'].verification, 'Required');
  // An import that updates the subreddit rewrites the whole record: a file without a Verification column leaves it as it is.
  await B.go('#t/subs');
  await importCsv(B, 'Subreddit,Members\nr/goth,520k', 'Import finished: 0 added, 1 updated, 0 skipped');
  assert.equal(B.stored()['subs/s1'].members, 520000);
  assert.equal(B.stored()['subs/s1'].verification, 'Karma Verification');
  assert.deepEqual(A.errors, []); assert.deepEqual(B.errors, []);
});

test('an unclear verification cell leaves the saved value alone when an import updates the subreddit', async t => {
  const L = await open({ seed: {
    'subs/a': sub('r/a', { verification: 'Not required' }), 'subs/b': sub('r/b', { verification: 'Required' }),
    'subs/c': sub('r/c', { verification: 'Karma Verification' }), 'subs/d': sub('r/d', { verification: 'Unknown' })
  } }); t.after(() => L.close());
  await importCsv(L, [
    'Subreddit,Verification',
    "r/a,Karma isn't required",
    'r/b,Photo verification required (min karma 100)',
    'r/c,Karma: opcional',
    'r/d,karma'
  ].join('\n'), 'Import finished: 0 added, 4 updated, 0 skipped');
  assert.deepEqual(['a', 'b', 'c', 'd'].map(k => L.stored()['subs/' + k].verification), ['Not required', 'Required', 'Karma Verification', 'Karma Verification']);
  assert.deepEqual(L.errors, []);
});

test('sorting by verification follows the dropdown', async t => {
  const L = await open({ seed: {
    'subs/a': sub('r/a', { verification: 'Unknown' }), 'subs/b': sub('r/b', { verification: 'Not required' }),
    'subs/c': sub('r/c', { verification: 'Karma Verification' }), 'subs/d': sub('r/d', { verification: 'Required' }), 'subs/e': sub('r/e')
  } }); t.after(() => L.close());
  await L.go('#t/subs');
  const head = () => L.$$('.tbl thead th').find(th => th.textContent.replace(/[↑↓]/g, '') === 'Verification');
  L.click(head()); await L.sleep(100);
  assert.deepEqual(column(L, 'Verification'), [...OPTIONS, '']);
  L.click(head()); await L.sleep(100);
  assert.deepEqual(column(L, 'Verification'), [...OPTIONS.slice().reverse(), '']);
  assert.deepEqual(L.errors, []);
});

test('the AI briefing says what Karma Verification means', async t => {
  const L = await open({ seed: {
    'subs/s1': sub('r/goth', { tags: ['Goth'], verification: 'Karma Verification', minKarma: 500 }),
    'models/m1': ava({ nsfwSubs: [{ n: 'r/goth', u: 'https://www.reddit.com/r/goth', note: 'Karma verification required · Min. karma 500' }] })
  } }); t.after(() => L.close());
  await L.go('#ai');
  L.click(L.button('Build briefing'));
  const out = L.$('textarea[aria-label="Briefing"]');
  for (let i = 0; i < 40 && !out.value; i++) await L.sleep(50);
  const text = out.value;
  assert.ok(text.includes('Verification is Required (verification required before posting), Karma Verification (karma verification required before posting), Not required or Unknown.'), 'explained');
  assert.ok(text.includes('| r/goth | NSFW | Active | Goth | Karma Verification | 500 |'), 'in the Subreddits table');
  assert.ok(text.includes('r/goth — Karma verification required · Min. karma 500'), 'in her list');
  assert.deepEqual(L.errors, []);
});
