import { test } from 'node:test';
import assert from 'node:assert/strict';
import { open } from './harness.mjs';

const sub = (name, extra = {}) => Object.assign({ name, kind: 'NSFW', status: 'Active', tags: ['Goth'] }, extra);
const model = (name, extra = {}) => Object.assign({ name, status: 'Active', niche: ['Goth'], nsfwSubs: [], sfwSubs: [], platforms: ['Reddit'], employees: [] }, extra);
const listed = n => ({ n, u: 'https://www.reddit.com/' + n, note: '' });

const seed = {
  'subs/s1': sub('r/goth'),
  'subs/s2': sub('r/AltGoneWild'),
  'models/m1': model('Ava', { bannedSubs: [{ n: 'goth', u: 'https://www.reddit.com/r/goth', note: 'Sep 2026, spam filter' }] }),
  'models/m2': model('Bea'),
  'accounts/a1': { username: 'ava_x', platform: 'Reddit', status: 'Active', model: 'm1' }
};

const WARN = 'She is banned in this subreddit.';
const AGAIN = 'She is banned in this subreddit. Select Log post again to log it anyway.';
const NO_SUB = 'Add the subreddit, or select Log post again to log without one.';
// Every way of writing r/goth that must count as r/goth.
const GOTH = ['r/Goth', 'R/GOTH', 'goth', 'https://www.reddit.com/r/goth/', 'https://www.reddit.com/r/goth', 'http://reddit.com/r/goth',
  'https://reddit.com/r/goth?utm=x', 'https://reddit.com/r/goth/?utm_source=share&utm_medium=web', 'https://old.reddit.com/r/goth',
  'https://new.reddit.com/r/goth/top/', 'https://www.reddit.com/r/goth/comments/abc123/some_title/', 'https://www.reddit.com/r/goth#rules',
  'HTTPS://WWW.REDDIT.COM/R/GOTH/', 'reddit.com/r/goth', 'www.reddit.com/r/goth', 'old.reddit.com/r/goth/', 'm.reddit.com/r/goth',
  'np.reddit.com/r/goth', 'https://m.reddit.com/r/goth/', 'https://np.reddit.com/r/goth', '/r/goth', 'r/goth/', '  r/goth  ', ' goth ',
  'r/ goth', 'r / goth', '\tR/Goth\n', '  https://www.reddit.com/r/goth/  '];

const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const weekStart = d => { const x = new Date(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return ymd(x); };

// Her profile and the subreddit's panel.
async function openModel(L, name){
  await L.go('#t/models');
  L.click(L.$$('.tbl tbody tr').find(r => r.children[0].textContent === name)); await L.sleep(300);
}
async function openSub(L, name){
  await L.go('#t/subs');
  L.click(L.$$('.tbl tbody tr').find(r => r.children[0].textContent === name)); await L.sleep(300);
}
const closePeek = async L => { L.click(L.$('.x')); await L.sleep(300); };
const list = (L, title) => L.$$('#peek details.group').find(d => d.querySelector('summary span').textContent === title);
// Each row of one of her lists: [name, the chips on the row].
const rows = (L, title) => [...list(L, title).querySelectorAll('.subrow')].map(r => [r.querySelector('input').value, [...r.querySelectorAll('.chip')].map(c => c.textContent)]);
const suggested = L => L.$$('#peek .suggrow .sublink').map(a => a.textContent);
// Types into the "Add subreddits" box of one of her lists and selects Add. The box is focused first, as a click
// into it would: the panel doesn't redraw while another box in it has focus.
async function addTo(L, key, text){
  const input = L.$(`#peek [data-fk="add-${key}"]`);
  input.focus();
  input.value = text;
  L.click(input.parentElement.querySelector('button')); await L.sleep(300);
}
const section = (L, title) => L.$$('#peek .sect').find(s => s.querySelector('h3') && s.querySelector('h3').textContent.startsWith(title));
const names = s => [...s.querySelectorAll('li .linkbtn')].map(b => b.textContent);
const localAudit = L => Object.entries(L.stored()).filter(([k]) => k.startsWith('audit/local/m/')).flatMap(([, v]) => v.entries);

// The Posting log form.
const label = (L, text) => L.$$('.logform label').find(l => l.childNodes[0].textContent === text);
const field = (L, text) => label(L, text).querySelector('select,input');
const hint = L => label(L, 'Subreddit').querySelector('span');
const logged = L => Object.entries(L.stored()).filter(([k]) => k.startsWith('posts/')).flatMap(([, v]) => v.entries);
async function choose(L, modelId, subText){
  L.set(field(L, 'Model'), modelId); await L.sleep(100);
  if (subText !== undefined){ L.set(field(L, 'Subreddit'), subText, 'input'); await L.sleep(100); }
}
async function logIt(L){ L.click(L.$('.logform button[type=submit]')); await L.sleep(300); }

test('isBanned ignores how the name is written', async t => {
  const L = await open({ seed }); t.after(() => L.close());
  const { isBanned, bannedKeys } = L.w.__lux;
  const m = { bannedSubs: [{ n: 'goth' }] };
  for (const v of GOTH) assert.equal(isBanned(m, v), true, JSON.stringify(v));
  for (const v of ['r/gothstyle', 'gothgirls', 'r/goths', 'r/got', 'u/goth', '', '   ', null, undefined, 'https://www.reddit.com/', 'reddit.com', 'https://www.reddit.com/user/goth'])
    assert.equal(isBanned(m, v), false, JSON.stringify(v));
  // The ban itself can be written any of these ways too.
  for (const n of GOTH) assert.equal(isBanned({ bannedSubs: [{ n }] }, 'r/goth'), true, JSON.stringify(n));
  assert.deepEqual([...bannedKeys({ bannedSubs: [{ n: 'Goth' }, { n: 'old.reddit.com/r/AltGoneWild/' }, { n: 'r/goth' }] })], ['r/goth', 'r/altgonewild']);
  // Nothing banned, or damaged data: nothing matches and nothing breaks.
  for (const x of [undefined, null, {}, { bannedSubs: [] }, { bannedSubs: 'goth' }, { bannedSubs: [null, {}, { n: '' }, { n: 42 }] }])
    assert.equal(isBanned(x, 'r/goth'), false, JSON.stringify(x));
  assert.deepEqual(L.errors, []);
});

test('banned subreddits are listed on her profile, never suggested, and shown on the subreddit', async t => {
  const L = await open({ seed }); t.after(() => L.close());
  await openModel(L, 'Ava');
  assert.deepEqual(L.$$('#peek details.group summary').map(s => s.textContent), ['NSFW subreddits0', 'SFW persona subreddits0', 'Banned subreddits1']);
  const banned = list(L, 'Banned subreddits');
  assert.equal(banned.querySelector('p.faint').textContent, 'Subreddits where she is banned. They are never suggested, and the posting log warns before logging there.');
  const inputs = [...banned.querySelectorAll('.subrow input')];
  assert.deepEqual(inputs.map(i => i.value), ['goth', 'https://www.reddit.com/r/goth', 'Sep 2026, spam filter']);
  assert.equal(inputs[2].placeholder, 'Reason and date');
  assert.equal(inputs[2].getAttribute('aria-label'), 'Reason and date');
  assert.deepEqual(rows(L, 'Banned subreddits'), [['goth', []]], 'the banned list itself has no Banned chips');
  assert.deepEqual(suggested(L), ['r/AltGoneWild']);
  await closePeek(L);
  await openSub(L, 'r/goth');
  assert.equal(section(L, 'Banned for').querySelector('h3').textContent, 'Banned for (1)');
  assert.deepEqual(names(section(L, 'Banned for')), ['Ava']);
  assert.deepEqual(names(section(L, 'Suggested for')), ['Bea']);
  assert.deepEqual(names(section(L, 'Assigned to')), []);
  await closePeek(L);
  await openSub(L, 'r/AltGoneWild');
  assert.equal(section(L, 'Banned for').textContent, 'Banned for (0)No model is banned here.');
  assert.deepEqual(names(section(L, 'Suggested for')).sort(), ['Ava', 'Bea']);
  assert.deepEqual(L.errors, []);
});

test('a subreddit on her NSFW or SFW list that she is banned in is marked Banned', async t => {
  const L = await open({ seed: {
    'subs/s1': sub('r/goth'), 'subs/s2': sub('r/AltGoneWild'),
    'models/m1': model('Ava', { nsfwSubs: [listed('r/Goth')], sfwSubs: [listed('r/AltGoneWild')],
      bannedSubs: [{ n: 'https://www.reddit.com/r/goth/', u: '', note: 'Sep 2026' }] })
  } }); t.after(() => L.close());
  await openModel(L, 'Ava');
  assert.deepEqual(rows(L, 'NSFW subreddits'), [['r/Goth', ['Banned']]]);
  assert.deepEqual(rows(L, 'SFW persona subreddits'), [['r/AltGoneWild', []]]);
  assert.deepEqual(rows(L, 'Banned subreddits'), [['https://www.reddit.com/r/goth/', []]]);
  const chip = list(L, 'NSFW subreddits').querySelector('.subrow .chip');
  assert.ok(chip.classList.contains('t-bad'), chip.className);
  assert.equal(chip.title, WARN);
  assert.equal(list(L, 'NSFW subreddits').querySelectorAll('.subrow input')[2].placeholder, 'Rules and notes');
  // Typed into her lists by hand, in either order: marked as soon as both are there.
  await addTo(L, 'bannedSubs', 'reddit.com/r/emo');
  await addTo(L, 'sfwSubs', 'R/Emo');
  assert.deepEqual(rows(L, 'SFW persona subreddits'), [['r/AltGoneWild', []], ['r/Emo', ['Banned']]]);
  await addTo(L, 'nsfwSubs', 'https://old.reddit.com/r/Pale/');
  assert.deepEqual(rows(L, 'NSFW subreddits'), [['r/Goth', ['Banned']], ['r/Pale', []]]);
  await addTo(L, 'bannedSubs', 'R/PALE');
  assert.deepEqual(rows(L, 'NSFW subreddits'), [['r/Goth', ['Banned']], ['r/Pale', ['Banned']]]);
  assert.deepEqual(L.stored()['models/m1'].bannedSubs.map(x => x.n), ['https://www.reddit.com/r/goth/', 'r/emo', 'r/PALE']);
  // The subreddit still shows her on its list, where it can be removed, and also as banned.
  await closePeek(L);
  await openSub(L, 'r/goth');
  assert.deepEqual(names(section(L, 'Assigned to')), ['Ava']);
  assert.deepEqual(names(section(L, 'Banned for')), ['Ava']);
  assert.deepEqual(names(section(L, 'Suggested for')), []);
  assert.deepEqual(L.errors, []);
});

test('the subreddit panel shows Remove and Assign at once, never Assign for a banned model, and waits while a box in it has focus', async t => {
  const L = await open({ seed: {
    'subs/s1': sub('r/goth'),
    'models/m1': model('Ava', { nsfwSubs: [listed('r/goth')] }), 'models/m2': model('Bea'), 'models/m3': model('Cleo', { bannedSubs: [{ n: 'goth' }] })
  } }); t.after(() => L.close());
  await openSub(L, 'r/goth');
  const press = (title, name, text) => L.click([...[...section(L, title).querySelectorAll('li')].find(li => li.querySelector('.linkbtn').textContent === name)
    .querySelectorAll('button')].find(b => b.textContent === text));
  assert.deepEqual(['Assigned to', 'Suggested for', 'Banned for'].map(s => names(section(L, s))), [['Ava'], ['Bea'], ['Cleo']]);
  press('Assigned to', 'Ava', 'Remove'); await L.sleep(300);
  assert.deepEqual(L.stored()['models/m1'].nsfwSubs, []);
  assert.deepEqual(['Assigned to', 'Suggested for', 'Banned for'].map(s => names(section(L, s))), [[], ['Ava', 'Bea'], ['Cleo']]);
  press('Suggested for', 'Bea', 'Assign'); await L.sleep(300);
  assert.deepEqual(L.stored()['models/m2'].nsfwSubs.map(x => x.n), ['r/goth']);
  assert.deepEqual(['Assigned to', 'Suggested for', 'Banned for'].map(s => names(section(L, s))), [['Bea'], ['Ava'], ['Cleo']]);
  // Typing in the Rules box: the panel isn't redrawn under the cursor, and catches up when the box is left.
  const rules = L.$('#peek textarea');
  rules.focus();
  press('Suggested for', 'Ava', 'Assign'); await L.sleep(300);
  assert.deepEqual(L.stored()['models/m1'].nsfwSubs.map(x => x.n), ['r/goth']);
  assert.equal(L.$('#peek textarea'), rules);
  assert.deepEqual(names(section(L, 'Assigned to')), ['Bea']);
  rules.blur(); await L.sleep(100);
  assert.deepEqual(['Assigned to', 'Suggested for', 'Banned for'].map(s => names(section(L, s))), [['Ava', 'Bea'], [], ['Cleo']]);
  assert.deepEqual(L.errors, []);
});

test('the banned list is edited like her other lists, and each change is in the audit log', async t => {
  const L = await open({ seed: { 'subs/s1': sub('r/goth'), 'subs/s2': sub('r/AltGoneWild'), 'models/m1': model('Ava') } }); t.after(() => L.close());
  await openModel(L, 'Ava');
  assert.deepEqual(suggested(L), ['r/AltGoneWild', 'r/goth']);
  await addTo(L, 'bannedSubs', ' old.reddit.com/r/Goth,  https://m.reddit.com/r/emo/ ');
  assert.deepEqual(L.stored()['models/m1'].bannedSubs, [
    { n: 'r/Goth', u: 'https://www.reddit.com/r/Goth', note: '' }, { n: 'r/emo', u: 'https://www.reddit.com/r/emo', note: '' }]);
  assert.deepEqual(suggested(L), ['r/AltGoneWild'], 'no longer suggested');
  L.set(list(L, 'Banned subreddits').querySelectorAll('.subrow')[0].querySelectorAll('input')[2], ' Sep 2026, spam filter '); await L.sleep(300);
  assert.equal(L.stored()['models/m1'].bannedSubs[0].note, 'Sep 2026, spam filter');
  L.click(list(L, 'Banned subreddits').querySelectorAll('.subrow')[1].querySelector('.del')); await L.sleep(300);
  assert.deepEqual(L.stored()['models/m1'].bannedSubs.map(x => x.n), ['r/Goth']);
  const entries = localAudit(L).filter(e => e.a === 'updated' && e.c === 'models' && e.ch.some(c => c.f === 'Banned subreddits'));
  assert.deepEqual(entries.map(e => e.n), ['Ava', 'Ava', 'Ava']);
  assert.deepEqual(entries.flatMap(e => e.ch).map(c => `${c.from} -> ${c.to}`).sort(),
    [' -> r/Goth, r/emo', 'r/Goth, r/emo -> r/Goth', 'r/Goth, r/emo -> r/Goth, r/emo']);
  assert.deepEqual(L.errors, []);
});

test('subreddits written differently still match on her lists and in suggestions (nothing marked Banned), and Reddit links without https:// are read', async t => {
  const L = await open({ seed: {
    'subs/s1': sub('r/goth'), 'subs/s2': sub('r/AltGoneWild'), 'subs/s3': sub('r/emo'), 'subs/s4': sub('r/alt'),
    'models/m1': model('Ava', { nsfwSubs: [{ n: 'https://www.reddit.com/r/Goth/' }], sfwSubs: [{ n: 'R/EMO' }] })
  } }); t.after(() => L.close());
  await openModel(L, 'Ava');
  assert.deepEqual(suggested(L), ['r/alt', 'r/AltGoneWild']);
  await addTo(L, 'nsfwSubs', 'reddit.com/r/AltGoneWild, old.reddit.com/r/alt/');
  assert.deepEqual(L.stored()['models/m1'].nsfwSubs.map(x => x.n), ['https://www.reddit.com/r/Goth/', 'r/AltGoneWild', 'r/alt']);
  assert.deepEqual(suggested(L), []);
  // Nothing on her lists is banned, so nothing is marked.
  assert.deepEqual(rows(L, 'NSFW subreddits').flatMap(([, c]) => c), []);
  assert.deepEqual(L.errors, []);
});

test('text that only looks like reddit.com is not read as a banned subreddit, and a subreddit named reddit.com keeps its name', async t => {
  const L = await open({ seed: { 'subs/s1': sub('reddit.com'), 'subs/s2': sub('www.reddit.com'), 'subs/s3': sub(''), 'subs/s4': sub('r/goth') } });
  t.after(() => L.close());
  const { isBanned, bannedKeys } = L.w.__lux;
  // reddit.com must be a whole host: what follows it is not cut off and read as a subreddit.
  const m = { bannedSubs: [{ n: 'munity' }, { n: 'r/.br' }, { n: 'ics' }, { n: 'goth' }] };
  for (const v of ['reddit.community', 'reddit.com.br', 'reddit.comics', 'reddit.com.br/r/goth', 'https://reddit.community/r/goth', 'https://www.reddit.com.br/r/goth', 'https://www.reddit.comics/r/x'])
    assert.equal(isBanned(m, v), false, v);
  // Without https:// only a link is read as one; the text on its own stays as it was.
  assert.deepEqual([...bannedKeys({ bannedSubs: ['reddit.com', 'www.reddit.com', 'reddit.community', 'reddit.com.br', 'reddit.com/r/Goth'].map(n => ({ n })) })],
    ['r/reddit.com', 'r/www.reddit.com', 'r/reddit.community', 'r/reddit.com.br', 'r/goth']);
  // So only the subreddit with no name at all is offered for removal.
  await L.go('#t/subs');
  assert.equal(L.$('.banner span').textContent, '1 subreddits have no name, probably from an import that could not read the names.');
  assert.deepEqual(L.errors, []);
});

test('the posting log warns before logging to a banned subreddit, and logs on the second click', async t => {
  const L = await open({ seed }); t.after(() => L.close());
  await L.go('#posts');
  L.set(field(L, 'Model'), 'm1'); await L.sleep(100);
  L.set(field(L, 'Subreddit'), 'r/Goth', 'input'); await L.sleep(100);
  assert.equal(hint(L).textContent, WARN);
  assert.equal(hint(L).className, 'due-bad');
  await logIt(L);
  assert.equal(L.$$('.entry').length, 0);
  assert.equal(hint(L).textContent, AGAIN);
  await logIt(L);
  assert.equal(L.$$('.entry').length, 1);
  assert.deepEqual(logged(L).map(e => [e.m, e.sub]), [['m1', 'r/Goth']]);
  assert.equal(field(L, 'Subreddit').value, '');
  assert.equal(hint(L).textContent, '');
  // Once logged, the next post there is warned about again.
  L.set(field(L, 'Subreddit'), 'https://www.reddit.com/r/goth/', 'input'); await L.sleep(100);
  assert.equal(hint(L).textContent, WARN);
  await logIt(L);
  assert.equal(logged(L).length, 1);
  await logIt(L);
  assert.deepEqual(logged(L).map(e => e.sub), ['r/Goth', 'r/goth']);
  assert.deepEqual(L.errors, []);
});

test('after a banned warning, another subreddit or another model logs at once, and coming back warns again', async t => {
  const L = await open({ seed }); t.after(() => L.close());
  await L.go('#posts');
  await choose(L, 'm1', 'R/GOTH');
  await logIt(L);
  assert.equal(hint(L).textContent, AGAIN);
  L.set(field(L, 'Subreddit'), 'r/AltGoneWild', 'input'); await L.sleep(100);
  assert.equal(hint(L).textContent, 'Not on her subreddit lists');
  assert.equal(hint(L).className, 'faint');
  await logIt(L);
  assert.deepEqual(logged(L).map(e => [e.m, e.sub]), [['m1', 'r/AltGoneWild']]);
  await choose(L, 'm1', 'goth');
  await logIt(L);
  assert.equal(logged(L).length, 1);
  L.set(field(L, 'Model'), 'm2'); await L.sleep(100);
  assert.equal(hint(L).textContent, 'Not on her subreddit lists');
  await logIt(L);
  assert.deepEqual(logged(L).map(e => [e.m, e.sub]), [['m1', 'r/AltGoneWild'], ['m2', 'r/goth']]);
  // Warned, then another subreddit and back: warned again.
  await choose(L, 'm1', 'r/goth');
  await logIt(L);
  L.set(field(L, 'Subreddit'), 'r/goths', 'input'); await L.sleep(100);
  L.set(field(L, 'Subreddit'), 'r/goth', 'input'); await L.sleep(100);
  await logIt(L);
  assert.equal(logged(L).length, 2);
  assert.equal(hint(L).textContent, AGAIN);
  // Warned, then another model and back: warned again.
  L.set(field(L, 'Model'), 'm2'); await L.sleep(100);
  L.set(field(L, 'Model'), 'm1'); await L.sleep(100);
  await logIt(L);
  assert.equal(logged(L).length, 2);
  await logIt(L);
  assert.deepEqual(logged(L).map(e => [e.m, e.sub]), [['m1', 'r/AltGoneWild'], ['m2', 'r/goth'], ['m1', 'r/goth']]);
  assert.deepEqual(L.errors, []);
});

test('the banned warning and the missing subreddit question each need their own second click', async t => {
  const L = await open({ seed }); t.after(() => L.close());
  await L.go('#posts');
  await choose(L, 'm1');
  await logIt(L);
  assert.equal(hint(L).textContent, NO_SUB);
  L.set(field(L, 'Subreddit'), 'r/goth', 'input'); await L.sleep(100);
  await logIt(L);
  assert.equal(hint(L).textContent, AGAIN);
  assert.equal(logged(L).length, 0);
  await logIt(L);
  assert.deepEqual(logged(L).map(e => e.sub), ['r/goth']);
  // Warned about the ban, then the subreddit is cleared: it asks about the missing subreddit first.
  L.set(field(L, 'Subreddit'), 'r/goth', 'input'); await L.sleep(100);
  await logIt(L);
  assert.equal(hint(L).textContent, AGAIN);
  L.set(field(L, 'Subreddit'), '', 'input'); await L.sleep(100);
  await logIt(L);
  assert.equal(hint(L).textContent, NO_SUB);
  assert.equal(logged(L).length, 1);
  await logIt(L);
  assert.deepEqual(logged(L).map(e => e.sub), ['r/goth', '']);
  // Asked about the missing subreddit, then a pasted link fills in a banned one: warned about the ban all the same.
  await logIt(L);
  assert.equal(hint(L).textContent, NO_SUB);
  L.set(field(L, 'Link'), 'https://www.reddit.com/r/goth/comments/xyz789/a_post/', 'input'); await L.sleep(300);
  assert.equal(field(L, 'Subreddit').value, 'r/goth');
  await logIt(L);
  assert.equal(hint(L).textContent, AGAIN);
  assert.equal(logged(L).length, 2);
  await logIt(L);
  assert.deepEqual(logged(L).map(e => e.sub), ['r/goth', '', 'r/goth']);
  assert.deepEqual(L.errors, []);
});

test('a pasted link to a banned subreddit is warned about, even right after a warning about another one', async t => {
  const L = await open({ seed: Object.assign({}, seed, {
    'models/m1': model('Ava', { bannedSubs: [{ n: 'goth', u: '', note: '' }, { n: 'r/emo', u: '', note: '' }] }) }) });
  t.after(() => L.close());
  await L.go('#posts');
  await choose(L, 'm1');
  L.set(field(L, 'Link'), 'https://www.reddit.com/r/Goth/comments/abc123/my_first_post/', 'input'); await L.sleep(300);
  assert.equal(field(L, 'Subreddit').value, 'r/Goth');
  assert.equal(hint(L).textContent, WARN);
  await logIt(L);
  assert.equal(hint(L).textContent, AGAIN);
  L.set(field(L, 'Link'), 'https://www.reddit.com/r/emo/comments/def456/another_post/', 'input'); await L.sleep(300);
  assert.equal(field(L, 'Subreddit').value, 'r/emo');
  await logIt(L);
  assert.equal(logged(L).length, 0, 'the warning was about r/Goth, not r/emo');
  assert.equal(hint(L).textContent, AGAIN);
  await logIt(L);
  assert.deepEqual(logged(L).map(e => [e.m, e.sub, e.pid]), [['m1', 'r/emo', 'def456']]);
  // The next link there, once that one is logged, is warned about again.
  L.set(field(L, 'Link'), 'https://www.reddit.com/r/emo/comments/ghi789/third_post/', 'input'); await L.sleep(300);
  await logIt(L);
  assert.equal(logged(L).length, 1);
  assert.equal(hint(L).textContent, AGAIN);
  await logIt(L);
  assert.deepEqual(logged(L).map(e => e.pid), ['def456', 'ghi789']);
  assert.deepEqual(L.errors, []);
});

test('a banned warning for one model does not let another banned model log there without her own warning', async t => {
  // Ava and Bea are both banned in r/goth. Warned for Ava, then a TikTok link from Bea's account switches the model
  // to Bea without a change event; back on Reddit the post would go to Bea, so she is warned about too.
  const L = await open({ seed: {
    'subs/s1': sub('r/goth'),
    'models/m1': model('Ava', { platforms: ['Reddit', 'TikTok'], bannedSubs: [{ n: 'goth' }] }),
    'models/m2': model('Bea', { platforms: ['Reddit', 'TikTok'], bannedSubs: [{ n: 'r/goth' }] }),
    'accounts/t2': { username: 'bea_tt', platform: 'TikTok', status: 'Active', model: 'm2' }
  } }); t.after(() => L.close());
  await L.go('#posts');
  await choose(L, 'm1', 'r/goth');
  await logIt(L);
  assert.equal(hint(L).textContent, AGAIN);
  L.set(field(L, 'Link'), 'https://www.tiktok.com/@bea_tt/video/7300000000000000000', 'input'); await L.sleep(300);
  assert.equal(field(L, 'Model').value, 'm2');
  L.set(field(L, 'Link'), '', 'input'); await L.sleep(200);
  L.click(L.$$('.logform .seg button').find(b => b.textContent === 'Reddit')); await L.sleep(200);
  assert.deepEqual([field(L, 'Model').value, field(L, 'Subreddit').value], ['m2', 'r/goth']);
  await logIt(L);
  assert.equal(logged(L).length, 0, 'Bea in r/goth is warned about first');
  assert.equal(hint(L).textContent, AGAIN);
  await logIt(L);
  assert.deepEqual(logged(L).map(e => [e.m, e.sub, e.p]), [['m2', 'r/goth', 'Reddit']]);
  assert.deepEqual(L.errors, []);
});

test('a banned subreddit with no model chosen, or a post on her profile, logs at once', async t => {
  // Banned in r/u too: a post on her profile (u/…) is still not a post in a subreddit.
  const L = await open({ seed: Object.assign({}, seed, {
    'models/m1': model('Ava', { bannedSubs: [{ n: 'goth', u: '', note: '' }, { n: 'r/u', u: '', note: '' }] }) }) });
  t.after(() => L.close());
  await L.go('#posts');
  L.set(field(L, 'Subreddit'), 'r/goth', 'input'); await L.sleep(100);
  assert.equal(hint(L).textContent, '');
  await logIt(L);
  assert.deepEqual(logged(L).map(e => [e.m, e.sub]), [['', 'r/goth']]);
  await choose(L, 'm1', 'r/goth');
  assert.equal(hint(L).className, 'due-bad');
  L.set(field(L, 'Subreddit'), 'u/ava_x', 'input'); await L.sleep(100);
  assert.equal(hint(L).textContent, 'Posted on the profile');
  assert.equal(hint(L).className, 'faint');
  await logIt(L);
  assert.deepEqual(logged(L).map(e => [e.m, e.sub]), [['', 'r/goth'], ['m1', 'u/ava_x']]);
  assert.deepEqual(L.errors, []);
});

test('the posting log does not offer her banned subreddits', async t => {
  // Banned in r/goth (in Subreddits, not on her lists) and r/Pale (on her NSFW list, not in Subreddits).
  const L = await open({ seed: Object.assign({}, seed, {
    'subs/s3': sub('r/emo'),
    'models/m1': model('Ava', { nsfwSubs: [listed('r/Pale'), listed('r/Emo')], bannedSubs: [{ n: 'goth' }, { n: 'https://www.reddit.com/r/pale/' }] }) }) });
  t.after(() => L.close());
  await L.go('#posts');
  const offered = () => L.$$('#sublist option').map(o => o.value).sort();
  await choose(L, 'm1');
  assert.deepEqual(offered(), ['r/AltGoneWild', 'r/Emo']);
  await choose(L, 'm2');
  assert.deepEqual(offered(), ['r/AltGoneWild', 'r/emo', 'r/goth']);
  await choose(L, '');
  assert.deepEqual(offered(), ['r/AltGoneWild', 'r/emo', 'r/goth']);
  assert.deepEqual(L.errors, []);
});

test('editing a logged post, or logging its link again, is never stopped by a banned subreddit', async t => {
  const today = new Date();
  const L = await open({ seed: Object.assign({}, seed, {
    ['posts/' + weekStart(today) + '_local']: { weekStart: weekStart(today), uid: 'local', entries: [
      { id: 'p1', d: ymd(today), tm: '10:00', p: 'Reddit', q: 1, ty: 'Post', m: 'm1', a: 'a1', sub: 'r/AltGoneWild', title: 'First', pid: 'abc123',
        link: 'https://www.reddit.com/r/AltGoneWild/comments/abc123/first/' }] }
  }) }); t.after(() => L.close());
  await L.go('#posts');
  L.click(L.$('.entry .statbtn')); await L.sleep(200);
  const box = L.$('.modal');
  [...box.querySelectorAll('input')].find(i => i.getAttribute('aria-label') === 'Subreddit').value = 'r/Goth';
  L.click([...box.querySelectorAll('button')].find(b => b.textContent === 'Save')); await L.sleep(300);
  assert.equal(L.$('.modal'), null);
  assert.deepEqual(logged(L).map(e => [e.id, e.sub]), [['p1', 'r/Goth']]);
  // The same post pasted again updates that entry at once.
  await choose(L, 'm1');
  L.set(field(L, 'Link'), 'https://www.reddit.com/r/goth/comments/abc123/first/', 'input'); await L.sleep(300);
  assert.equal(L.$('.logform button[type=submit]').textContent, 'Update post');
  L.set(field(L, 'Views'), '500', 'input');
  await logIt(L);
  assert.deepEqual(logged(L).map(e => [e.id, e.sub, e.views]), [['p1', 'r/goth', 500]]);
  assert.deepEqual(L.errors, []);
});

test('the AI briefing lists where she is banned and says never to suggest banned subreddits', async t => {
  const L = await open({ seed }); t.after(() => L.close());
  await L.go('#ai');
  L.click(L.button('Build briefing'));
  const out = L.$('textarea[aria-label="Briefing"]');
  for (let i = 0; i < 40 && !out.value; i++) await L.sleep(50);
  const lines = out.value.split('\n');
  assert.equal(lines[lines.findIndex(l => l.startsWith('- **Subreddits** is the agency')) + 1],
    '- **Banned subreddits** on a model are places she must not be posted to; never suggest them for her.');
  assert.deepEqual(lines.filter(l => l.startsWith('- Banned in:')), ['- Banned in: r/goth (Sep 2026, spam filter)', '- Banned in: —']);
  lines.forEach((l, i) => { if (l.startsWith('- Banned in:')) assert.match(lines[i - 1], /^- SFW persona subreddits/); });
  // In the Subreddits table, r/goth is suggested for Bea only.
  assert.equal(lines.find(l => l.startsWith('| r/goth |')), '| r/goth | NSFW | Active | Goth | — | — | — | — | Bea |');
  assert.deepEqual(L.errors, []);
});

test('in Portuguese the banned list, its warnings and the subreddit panel are translated', async t => {
  const L = await open({ lang: 'pt', seed: Object.assign({}, seed, {
    'models/m1': model('Ava', { nsfwSubs: [listed('r/goth')], bannedSubs: [{ n: 'goth', u: '', note: '' }] }) }) });
  t.after(() => L.close());
  await openModel(L, 'Ava');
  const banned = list(L, 'Subreddits banidos');
  assert.equal(banned.querySelector('p.faint').textContent, 'Subreddits em que ela está banida. Nunca são sugeridos, e o registro de postagens avisa antes de registrar neles.');
  assert.equal(banned.querySelectorAll('.subrow input')[2].placeholder, 'Motivo e data');
  assert.deepEqual(rows(L, 'Subreddits NSFW'), [['r/goth', ['Banido']]]);
  assert.equal(list(L, 'Subreddits NSFW').querySelector('.subrow .chip').title, 'Ela está banida neste subreddit.');
  await closePeek(L);
  await openSub(L, 'r/goth');
  assert.equal(section(L, 'Modelos banidas aqui').querySelector('h3').textContent, 'Modelos banidas aqui (1)');
  await closePeek(L);
  await openSub(L, 'r/AltGoneWild');
  assert.equal(section(L, 'Modelos banidas aqui').querySelector('p').textContent, 'Nenhuma modelo está banida aqui.');
  await closePeek(L);
  await L.go('#posts');
  L.set(field(L, 'Modelo'), 'm1'); await L.sleep(100);
  L.set(field(L, 'Subreddit'), 'r/goth', 'input'); await L.sleep(100);
  assert.equal(hint(L).textContent, 'Ela está banida neste subreddit.');
  await logIt(L);
  assert.equal(hint(L).textContent, 'Ela está banida neste subreddit. Clique em Registrar postagem de novo para registrar mesmo assim.');
  assert.deepEqual(L.errors, []);
});
