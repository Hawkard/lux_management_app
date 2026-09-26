import { test } from 'node:test';
import assert from 'node:assert/strict';
import { open } from './harness.mjs';

const seed = {
  'models/m1': { name: 'Ava', status: 'Active', niche: ['Goth'], nsfwSubs: [], sfwSubs: [], platforms: ['Reddit'], employees: [] },
  'subs/s1': { name: 'r/goth', kind: 'NSFW', status: 'Active', tags: ['goth'] }
};

const VIOLET = '#9D7BEA', TEAL = '#6CC3BA', PINK = '#F06FA4', SKY = '#8EC5F0', SILVER = '#C9CED6';
const rgb = hex => `rgb(${[1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`;
const model = (name, extra = {}) => Object.assign({ name, status: 'Active', niche: ['Goth'], nsfwSubs: [], sfwSubs: [], platforms: ['Reddit'], employees: [] }, extra);
const sub = (name, extra = {}) => Object.assign({ name, kind: 'NSFW', status: 'Active', tags: ['goth'] }, extra);
const withColors = (colors, more = {}) => Object.assign({ 'meta/tagColors': { colors } }, seed, more);
// Ava (Goth) and Bea (goth, Alt); r/goth (goth) and r/AltGoth (GOTH, Alt): the same tag written three ways.
const mixed = colors => withColors(colors, { 'models/m2': model('Bea', { niche: ['goth', 'Alt'] }), 'subs/s2': sub('r/AltGoth', { tags: ['GOTH', 'Alt'] }) });

// The color a chip shows (its border, whichever way it is colored), or '' for the default look: no style of its own.
const tint = el => { assert.ok(el, 'chip'); return el.getAttribute('style') === null ? '' : el.style.borderColor; };
const chips = (el, sel = '.chip.tag') => [...el.querySelectorAll(sel)].map(c => [c.textContent, tint(c)]);
// Each row of the table: its name and its tag chips.
const tableTags = L => L.$$('.tbl tbody tr').map(r => [r.children[0].textContent, chips(r)]);
async function openRow(L, hash, name){
  await L.go(hash);
  L.click(L.$$('.tbl tbody tr').find(r => r.children[0].textContent === name)); await L.sleep(250);
}
const closePeek = async L => { L.click(L.$('.x')); await L.sleep(300); };
// The panel's Niche or Tags box, its chips, and its list of tags.
const tagBox = L => L.$$('#peek .chipbox').find(b => /^(Edit|Editar) (Niche|Tags|Nicho)$/.test(b.getAttribute('aria-label')));
const boxTags = L => chips(tagBox(L));
async function openTags(L){ L.click(tagBox(L)); await L.sleep(100); }
// Each tag in the list: its name, its color, and its color button's color.
const popRows = L => L.$$('.pop .optrow').map(r => [r.querySelector('.chip').textContent, tint(r.querySelector('.chip')), r.querySelector('.tagsw').style.background]);
const colorButton = (L, tag) => L.$$('.pop .tagsw').find(b => b.getAttribute('aria-label') === 'Tag color ' + tag);
const swatch = (L, title) => L.$$('.pop .sw').find(b => b.title === title);
async function pickColor(L, tag, title){
  L.click(colorButton(L, tag)); await L.sleep(100);
  L.click(swatch(L, title)); await L.sleep(200);
}
const escape = async L => { L.w.document.body.dispatchEvent(new L.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await L.sleep(100); };
// Her suggested subreddits, and the models suggested for a subreddit, each with the matching tags.
const suggTags = L => L.$$('#peek .suggrow').map(r => [r.querySelector('.sublink').textContent, chips(r, '.chip.tagm')]);
const section = (L, title) => L.$$('#peek .sect').find(s => s.querySelector('h3') && s.querySelector('h3').textContent.startsWith(title));
const suggFor = L => [...section(L, 'Suggested for').querySelectorAll('li')].map(li => [li.querySelector('.linkbtn').textContent, chips(li, '.chip.tagm')]);
const localAudit = L => Object.entries(L.stored()).filter(([k]) => k.startsWith('audit/local/m/')).flatMap(([, v]) => v.entries);
const toasts = L => L.$$('.toast').map(x => x.textContent);
async function until(L, fn){ for (let i = 0; i < 80 && !fn(); i++) await L.sleep(50); return fn(); }
// Import & export: pastes a backup and reads it, then imports it (the buttons are found the same way in any language).
async function paste(L, backup){
  await L.go('#io');
  const box = L.$('.io textarea');
  box.value = typeof backup === 'string' ? backup : JSON.stringify(backup);
  L.click(box.nextElementSibling.querySelector('button')); await L.sleep(100);
}
const previewLines = L => L.$$('.preview label.checkrow').map(l => l.textContent);
// Earlier messages are cleared first, so only this import's message is left.
async function runImport(L, done){
  L.$$('.toast').forEach(x => x.remove());
  L.click(L.$('.preview .btn.primary'));
  assert.ok(await until(L, () => toasts(L).some(x => x.startsWith(done))), toasts(L).join(' | '));
}
const backupOf = more => Object.assign({ app: 'lux-management', version: 2, exportedAt: '2026-09-20T10:00:00.000Z', collections: {} }, more);

test('a niche color picked on a model shows on matching subreddit tags', async t => {
  const L = await open({ seed }); t.after(() => L.close());
  await L.go('#t/models');
  L.click(L.$$('.tbl tbody tr')[0]); await L.sleep(250);
  const nicheBox = L.$$('#peek .chipbox').find(b => /Goth/.test(b.textContent));
  L.click(nicheBox); await L.sleep(100);
  L.click(L.$('.pop .tagsw')); await L.sleep(100);
  L.click(L.$$('.pop .sw').find(b => b.title === 'Violet')); await L.sleep(200);
  assert.equal(L.stored()['meta/tagColors'].colors.goth, '#9D7BEA');
  // Back on her list of tags, in the new color, and so is her Niche box.
  assert.deepEqual(popRows(L), [['Goth', rgb(VIOLET), rgb(VIOLET)]]);
  assert.deepEqual(boxTags(L), [['Goth', rgb(VIOLET)]]);
  L.w.document.body.dispatchEvent(new L.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  L.click(L.$('.x')); await L.sleep(300);
  assert.match(L.$('.tbl tbody tr .chip.tag').getAttribute('style'), /157, 123, 234|#9D7BEA/i);
  await L.go('#t/subs');
  assert.match(L.$('.tbl tbody tr .chip.tag').getAttribute('style'), /157, 123, 234|#9D7BEA/i);
  // The audit log has the change, under the workspace.
  assert.deepEqual(localAudit(L).filter(e => e.c === 'workspace').map(e => [e.a, e.n, e.ch]),
    [['updated', 'Goth', [{ f: 'Tag color', from: 'default', to: VIOLET }]]]);
  assert.deepEqual(L.errors, []);
});

test('Goth on a model and goth or GOTH on a subreddit show the same color everywhere', async t => {
  // Saved by hand or by an older copy: any capitalization, spaces, a lowercase color, and something that isn't a color.
  const L = await open({ seed: mixed({ ' GOTH ': '#9d7bea', alt: TEAL, petite: 'nope' }) }); t.after(() => L.close());
  const V = rgb(VIOLET), T = rgb(TEAL);
  await L.go('#t/models');
  assert.deepEqual(tableTags(L), [['Ava', [['Goth', V]]], ['Bea', [['goth', V], ['Alt', T]]]]);
  await L.go('#t/subs');
  assert.deepEqual(tableTags(L), [['r/AltGoth', [['GOTH', V], ['Alt', T]]], ['r/goth', [['goth', V]]]]);
  await openRow(L, '#t/models', 'Ava');
  assert.deepEqual(boxTags(L), [['Goth', V]]);
  assert.deepEqual(suggTags(L), [['r/AltGoth', [['GOTH', V]]], ['r/goth', [['goth', V]]]]);
  await openTags(L);
  assert.deepEqual(popRows(L), [['Alt', T, T], ['Goth', V, V]]);
  await escape(L);
  await openRow(L, '#t/subs', 'r/goth');
  assert.deepEqual(boxTags(L), [['goth', V]]);
  assert.deepEqual(suggFor(L), [['Ava', [['goth', V]]], ['Bea', [['goth', V]]]]);
  await openTags(L);
  assert.deepEqual(popRows(L), [['Alt', T, T], ['Goth', V, V]]);
  // A color picked for GOTH on r/AltGoth is the color of goth and Goth too.
  await escape(L);
  await openRow(L, '#t/subs', 'r/AltGoth');
  await openTags(L);
  await pickColor(L, 'Goth', 'Sky');
  assert.deepEqual(L.stored()['meta/tagColors'].colors, { alt: TEAL, goth: SKY });
  await escape(L); await closePeek(L);
  assert.deepEqual(tableTags(L), [['r/AltGoth', [['GOTH', rgb(SKY)], ['Alt', T]]], ['r/goth', [['goth', rgb(SKY)]]]]);
  await L.go('#t/models');
  assert.deepEqual(tableTags(L), [['Ava', [['Goth', rgb(SKY)]]], ['Bea', [['goth', rgb(SKY)], ['Alt', T]]]]);
  assert.deepEqual(L.errors, []);
});

test('resetting a tag color returns it to default everywhere', async t => {
  const L = await open({ seed: mixed({ goth: '#9D7BEA' }) }); t.after(() => L.close());
  await openRow(L, '#t/subs', 'r/goth');
  assert.deepEqual(suggFor(L), [['Ava', [['goth', rgb(VIOLET)]]], ['Bea', [['goth', rgb(VIOLET)]]]]);
  L.click(L.$$('#peek .chipbox').find(b => /goth/i.test(b.textContent))); await L.sleep(100);
  await pickColor(L, 'Goth', 'Default gold');
  assert.equal(L.stored()['meta/tagColors'].colors.goth, undefined);
  assert.deepEqual(L.stored()['meta/tagColors'], { colors: {} }, 'the tag is removed, not saved as empty');
  // The list of tags, the Tags box, and once the list is closed, the models suggested here.
  assert.deepEqual(popRows(L), [['Alt', '', 'var(--gold)'], ['Goth', '', 'var(--gold)']]);
  assert.deepEqual(boxTags(L), [['goth', '']]);
  await escape(L);
  assert.deepEqual(suggFor(L), [['Ava', [['goth', '']]], ['Bea', [['goth', '']]]]);
  await closePeek(L);
  assert.deepEqual(tableTags(L), [['r/AltGoth', [['GOTH', ''], ['Alt', '']]], ['r/goth', [['goth', '']]]]);
  await openRow(L, '#t/models', 'Ava');
  assert.deepEqual(boxTags(L), [['Goth', '']]);
  assert.deepEqual(suggTags(L), [['r/AltGoth', [['GOTH', '']]], ['r/goth', [['goth', '']]]]);
  await closePeek(L);
  assert.deepEqual(tableTags(L), [['Ava', [['Goth', '']]], ['Bea', [['goth', ''], ['Alt', '']]]]);
  assert.deepEqual(localAudit(L).filter(e => e.c === 'workspace').map(e => [e.n, e.ch]), [['Goth', [{ f: 'Tag color', from: VIOLET, to: 'default' }]]]);
  assert.deepEqual(L.errors, []);
});

test('tags without a color keep the default look, and a color too dark to read fills its chip', async t => {
  const L = await open({ seed: Object.assign({}, seed, { 'models/m2': model('Bea', { niche: ['Alt'] }), 'subs/s2': sub('r/alt', { tags: ['Alt'] }),
    'meetings/x1': { title: 'Weekly', status: 'Scheduled', date: '2026-09-01', time: '10:00', attendees: [], topics: ['Goth'] } }) });
  t.after(() => L.close());
  await L.go('#t/subs');
  const plain = L.$$('.tbl tbody tr .chip.tag');
  assert.deepEqual(plain.map(c => [c.textContent, c.className, c.getAttribute('style')]), [['Alt', 'chip tag', null], ['goth', 'chip tag', null]]);
  await openRow(L, '#t/subs', 'r/goth');
  const tagm = section(L, 'Suggested for').querySelector('.chip');
  assert.deepEqual([tagm.textContent, tagm.className, tagm.getAttribute('style')], ['goth', 'chip tag tagm', null]);
  await openTags(L);
  L.click(colorButton(L, 'Goth')); await L.sleep(100);
  L.set(L.$('.pop input[type=color]'), '#1a237e'); await L.sleep(200);
  assert.equal(L.stored()['meta/tagColors'].colors.goth, '#1A237E');
  // Navy text on the black background can't be read: the chip is filled with the color instead, with white text.
  const dark = tagBox(L).querySelector('.chip');
  assert.deepEqual([dark.style.color, dark.style.backgroundColor, dark.style.borderColor], ['rgb(255, 255, 255)', 'rgb(26, 35, 126)', 'rgb(26, 35, 126)']);
  await pickColor(L, 'Goth', 'Silver');
  const light = tagBox(L).querySelector('.chip');
  assert.deepEqual([light.style.color, light.style.backgroundColor, light.style.borderColor], [rgb(SILVER), '', rgb(SILVER)]);
  // Meeting topics are not niches or subreddit tags: they keep plain chips.
  await escape(L); await closePeek(L);
  await L.go('#t/meetings');
  const col = L.$$('.tbl thead th').findIndex(th => th.textContent.startsWith('Topics'));
  const topic = L.$('.tbl tbody tr').children[col].querySelector('.chip');
  assert.deepEqual([topic.textContent, topic.className, topic.getAttribute('style')], ['Goth', 'chip', null]);
  assert.deepEqual(L.errors, []);
});

test('setTagColor saves one color per tag whatever its capitalization, and ignores what is not a color or not a tag', async t => {
  const L = await open({ seed: withColors({ goth: VIOLET }) }); t.after(() => L.close());
  const { setTagColor, tagColor, tagChip } = L.w.__lux;
  for (const [tag, color] of [['Goth', 'violet'], ['Goth', 'rgb(1, 2, 3)'], ['', TEAL], ['   ', TEAL], [null, TEAL], ['goth', '#9d7bea'], [' GOTH ', VIOLET]]) await setTagColor(tag, color);
  assert.deepEqual(L.stored()['meta/tagColors'], { colors: { goth: VIOLET } }, 'nothing changed');
  assert.deepEqual(localAudit(L), []);
  await setTagColor(' GOTH ', '#6cc3ba');
  await setTagColor('Alt', PINK);
  assert.deepEqual(L.stored()['meta/tagColors'], { colors: { alt: PINK, goth: TEAL } });
  assert.deepEqual([tagColor('goth'), tagColor(' Goth'), tagColor('ALT'), tagColor('emo'), tagColor(undefined)], [TEAL, TEAL, PINK, '', '']);
  const chip = tagChip('Goth', 'tagm');
  assert.deepEqual([chip.className, chip.textContent, chip.style.color, chip.style.borderColor], ['chip tag tagm', 'Goth', rgb(TEAL), rgb(TEAL)]);
  await setTagColor('goth', '');
  assert.deepEqual(L.stored()['meta/tagColors'], { colors: { alt: PINK } });
  assert.equal(tagChip('Goth').getAttribute('style'), null);
  await L.sleep(100);
  assert.deepEqual(localAudit(L).map(e => [e.a, e.c, e.n, e.ch[0].f, e.ch[0].from, e.ch[0].to]),
    [['updated', 'workspace', 'GOTH', 'Tag color', VIOLET, TEAL], ['updated', 'workspace', 'Alt', 'Tag color', 'default', PINK], ['updated', 'workspace', 'goth', 'Tag color', TEAL, 'default']]);
  assert.deepEqual(L.errors, []);
});

test('the colors stay inside the window when they are taller than the list of tags was', async t => {
  const L = await open({ seed }); t.after(() => L.close());
  await openRow(L, '#t/models', 'Ava');
  await openTags(L);
  const pop = L.$('.pop'), H = L.w.innerHeight;
  const top = pop.style.top;
  // Room enough: the popover stays where it is.
  pop.getBoundingClientRect = () => ({ top: 100, bottom: 400, height: 300, left: 0, right: 280, width: 280 });
  L.click(colorButton(L, 'Goth')); await L.sleep(100);
  assert.equal(pop.style.top, top);
  assert.equal(L.w.document.activeElement.textContent, '← Back', 'the keyboard is on Back');
  L.click(L.$('.pop .linkbtn')); await L.sleep(100);
  assert.equal(L.w.document.activeElement, L.$('.pop input'), 'and on the search box when back');
  // Near the bottom of the window, the colors would reach below it: the popover moves up.
  pop.getBoundingClientRect = () => ({ top: H - 100, bottom: H + 200, height: 300, left: 0, right: 280, width: 280 });
  L.click(colorButton(L, 'Goth')); await L.sleep(100);
  assert.equal(pop.style.top, (H - 308) + 'px');
  assert.deepEqual(L.errors, []);
});

test('the model name color picker works as before', async t => {
  const L = await open({ seed: Object.assign({}, seed, { 'models/m2': model('Bea', { color: '#9d7bea' }) }) }); t.after(() => L.close());
  const names = ['Default gold', 'Rose', 'Pink', 'Coral', 'Amber', 'Champagne', 'Mint', 'Teal', 'Sky', 'Lavender', 'Violet', 'Silver', 'White'];
  await openRow(L, '#t/models', 'Ava');
  const sw = () => L.$('#peek .swatch');
  assert.deepEqual([sw().title, sw().getAttribute('aria-label'), sw().style.background], ['Change name color', 'Change name color', 'var(--gold)']);
  L.click(sw()); await L.sleep(100);
  assert.equal(L.$('.pop .faint.small').textContent, 'Name color');
  assert.deepEqual(L.$$('.pop .sw').map(b => b.title), names);
  assert.deepEqual(L.$$('.pop .sw').map(b => b.getAttribute('aria-label')), names);
  assert.deepEqual(L.$$('.pop .sw.on').map(b => b.title), ['Default gold']);
  assert.equal(L.$('.pop input[type=color]').value, '#d4af37');
  assert.equal(L.$('.pop .customrow').textContent, 'Custom color');
  L.click(swatch(L, 'Violet')); await L.sleep(200);
  assert.equal(L.$('.pop'), null, 'the picker closes');
  assert.equal(L.stored()['models/m1'].color, VIOLET);
  assert.equal(L.$('#peek .titlein').style.color, rgb(VIOLET));
  assert.equal(sw().style.background, rgb(VIOLET));
  L.click(sw()); await L.sleep(100);
  assert.deepEqual(L.$$('.pop .sw.on').map(b => b.title), ['Violet']);
  L.set(L.$('.pop input[type=color]'), '#123abc'); await L.sleep(200);
  assert.equal(L.$('.pop'), null);
  assert.equal(L.stored()['models/m1'].color, '#123ABC');
  L.click(sw()); await L.sleep(100);
  assert.deepEqual(L.$$('.pop .sw.on').map(b => b.title), []);
  assert.equal(L.$('.pop input[type=color]').value, '#123abc');
  L.click(swatch(L, 'Default gold')); await L.sleep(200);
  assert.equal(L.stored()['models/m1'].color, '');
  assert.deepEqual(localAudit(L).filter(e => e.c === 'models').flatMap(e => e.ch).map(c => [c.f, c.from, c.to]),
    [['Name color', '', VIOLET], ['Name color', VIOLET, '#123ABC'], ['Name color', '#123ABC', '']]);
  assert.deepEqual(L.stored()['meta/tagColors'], undefined, 'name colors are not tag colors');
  // A color saved in lowercase is still marked as the one chosen.
  await closePeek(L);
  await openRow(L, '#t/models', 'Bea');
  L.click(sw()); await L.sleep(100);
  assert.deepEqual(L.$$('.pop .sw.on').map(b => b.title), ['Violet']);
  assert.deepEqual(L.errors, []);
});

test('backup export includes tag colors', async t => {
  const L = await open({ seed: Object.assign({ 'meta/tagColors': { colors: { goth: '#9D7BEA' } } }, seed) }); t.after(() => L.close());
  await L.go('#io');
  L.click(L.button('Export backup (.json)')); await L.sleep(300);
  const backup = JSON.parse(L.$('.modal textarea').value);
  assert.deepEqual(backup.meta.tagColors.colors, { goth: '#9D7BEA' });
  assert.deepEqual(backup.meta, { tagColors: { colors: { goth: '#9D7BEA' } } }, 'each document as stored, by its name');
  assert.deepEqual(L.errors, []);
});

test('importing a backup adds its tag colors and keeps the colors already set here', async t => {
  // Exported where goth is teal and alt pink, imported where goth is already violet.
  const A = await open({ seed: withColors({ goth: TEAL, alt: PINK }) }); t.after(() => A.close());
  await A.go('#io');
  A.click(A.button('Export backup (.json)')); await A.sleep(300);
  const text = A.$('.modal textarea').value;
  const L = await open({ seed: withColors({ goth: VIOLET }) }); t.after(() => L.close());
  await paste(L, text);
  assert.ok(previewLines(L).includes('Tag colors: 2 (colors already set here are kept)'), previewLines(L).join(' | '));
  await runImport(L, 'Import finished');
  assert.ok(toasts(L).includes('Import finished: 0 added or updated, 2 skipped 1 tag colors added.'), toasts(L).join(' | '));
  assert.deepEqual(L.stored()['meta/tagColors'], { colors: { alt: PINK, goth: VIOLET } });
  assert.deepEqual(localAudit(L).filter(e => e.a === 'imported').map(e => e.ch[0].to), ['0 records added or updated, 2 skipped, 1 tag colors added']);
  await L.go('#t/subs');
  assert.deepEqual(tableTags(L), [['r/goth', [['goth', rgb(VIOLET)]]]]);
  // The same backup again: nothing to add.
  await paste(L, text);
  await runImport(L, 'Import finished');
  assert.deepEqual(toasts(L), ['Import finished: 0 added or updated, 2 skipped']);
  assert.deepEqual(L.stored()['meta/tagColors'], { colors: { alt: PINK, goth: VIOLET } });
  // Colors that aren't colors, or have no tag, are left out; tags are matched whatever their capitalization.
  await paste(L, backupOf({ meta: { tagColors: { colors: { ' EMO ': '#abcdef', Goth: TEAL, petite: 'pink', '': SKY, alt: 42 } } } }));
  assert.ok(previewLines(L).includes('Tag colors: 2 (colors already set here are kept)'), previewLines(L).join(' | '));
  await runImport(L, 'Import finished: 0 added or updated, 0 skipped 1 tag colors added.');
  assert.deepEqual(L.stored()['meta/tagColors'], { colors: { alt: PINK, emo: '#ABCDEF', goth: VIOLET } });
  assert.deepEqual(L.errors, []);
});

test('tag colors are imported only when their box is ticked, and a backup without any shows no line', async t => {
  const L = await open({ seed }); t.after(() => L.close());
  await paste(L, backupOf({ meta: { tagColors: { colors: { goth: TEAL } } } }));
  const line = L.$$('.preview label.checkrow').find(l => l.textContent.startsWith('Tag colors'));
  assert.equal(line.querySelector('input').checked, true);
  L.click(line.querySelector('input'));
  assert.equal(line.querySelector('input').checked, false);
  await runImport(L, 'Import finished: 0 added or updated, 0 skipped');
  assert.equal(L.stored()['meta/tagColors'], undefined);
  await paste(L, backupOf({ meta: {} }));
  assert.deepEqual(previewLines(L).filter(x => x.startsWith('Tag colors')), []);
  await paste(L, backupOf({ meta: { tagColors: { colors: { goth: 'violet' } } } }));
  assert.deepEqual(previewLines(L).filter(x => x.startsWith('Tag colors')), []);
  assert.deepEqual(L.errors, []);
});

test('a full desktop backup brings its tag colors through Import & export too', async t => {
  const L = await open({ seed: withColors({ goth: VIOLET }) }); t.after(() => L.close());
  const s9 = sub('r/emo', { tags: ['Emo'], updatedAt: 5 });
  await paste(L, backupOf({ kind: 'desktop-full', collections: { subs: [Object.assign({ id: 's9' }, s9)] }, posts: [],
    raw: { 'subs/s9': s9, 'meta/tagColors': { colors: { emo: PINK, goth: TEAL } } } }));
  assert.ok(previewLines(L).includes('Tag colors: 2 (colors already set here are kept)'), previewLines(L).join(' | '));
  await runImport(L, 'Import finished: 1 added or updated, 0 skipped 1 tag colors added.');
  assert.deepEqual(L.stored()['meta/tagColors'], { colors: { emo: PINK, goth: VIOLET } });
  await L.go('#t/subs');
  assert.deepEqual(tableTags(L), [['r/emo', [['Emo', rgb(PINK)]]], ['r/goth', [['goth', rgb(VIOLET)]]]]);
  assert.deepEqual(L.errors, []);
});

test('in Portuguese the tag color picker and the import line are translated', async t => {
  const L = await open({ seed, lang: 'pt' }); t.after(() => L.close());
  await openRow(L, '#t/models', 'Ava');
  await openTags(L);
  const sw = L.$('.pop .tagsw');
  assert.deepEqual([sw.title, sw.getAttribute('aria-label')], ['Cor da tag', 'Cor da tag Goth']);
  L.click(sw); await L.sleep(100);
  assert.equal(L.$('.pop .linkbtn').textContent, '← Voltar');
  assert.equal(L.$('.pop .faint.small').textContent, 'Cor de “Goth”');
  assert.deepEqual(L.$$('.pop .sw').slice(0, 2).map(b => b.title), ['Dourado padrão', 'Rosa']);
  assert.equal(L.$('.pop .customrow').textContent, 'Cor personalizada');
  // Back without choosing: the list of tags again, and nothing saved.
  L.click(L.$('.pop .linkbtn')); await L.sleep(100);
  assert.deepEqual(popRows(L), [['Goth', '', 'var(--gold)']]);
  assert.equal(L.stored()['meta/tagColors'], undefined);
  await escape(L); await closePeek(L);
  await paste(L, backupOf({ meta: { tagColors: { colors: { alt: PINK } } } }));
  assert.ok(previewLines(L).includes('Cores das tags: 1 (as cores já definidas aqui são mantidas)'), previewLines(L).join(' | '));
  await runImport(L, 'Importação concluída');
  assert.ok(toasts(L).includes('Importação concluída: 0 adicionados ou atualizados, 0 ignorados 1 cores de tags adicionadas.'), toasts(L).join(' | '));
  assert.deepEqual(L.errors, []);
});

// A stand-in for the web version's database that, like the real one, delivers every change to the open queries.
// Each read and write takes `ms` milliseconds. change() is a teammate's write on the server.
function liveDb(docs, ms = 0){
  const copy = o => JSON.parse(JSON.stringify(o));
  const parent = p => p.slice(0, p.lastIndexOf('/'));
  const live = new Set();
  const later = () => new Promise(r => setTimeout(r, ms));
  const push = () => setTimeout(() => live.forEach(fn => fn()), 0);
  const snap = (col, ops) => ({ metadata: { fromCache: false, hasPendingWrites: false },
    docs: Object.keys(docs).filter(p => parent(p) === col).sort()
      .filter(p => ops.every(o => o.op === '==' ? docs[p][o.f] === o.v : o.op === 'in' ? o.v.includes(docs[p][o.f]) : true))
      .map(p => ({ id: p.slice(p.lastIndexOf('/') + 1), exists: true, data: () => copy(docs[p]) })) });
  const doc = p => ({
    get: async () => { await later(); return { id: p.slice(p.lastIndexOf('/') + 1), exists: p in docs, data: () => (p in docs ? copy(docs[p]) : undefined) }; },
    set: async d => { await later(); docs[p] = copy(d); push(); },
    update: async d => { await later(); if (!(p in docs)) throw { code: 'invalid_argument', message: 'missing' }; Object.assign(docs[p], copy(d)); push(); },
    delete: async () => { await later(); delete docs[p]; push(); }
  });
  const query = (col, ops) => ({
    where: (f, op, v) => query(col, ops.concat({ f, op, v })),
    orderBy: () => query(col, ops),
    limit: () => query(col, ops),
    get: async () => { await later(); return snap(col, ops); },
    onSnapshot: next => { const fn = () => next(snap(col, ops)); live.add(fn); setTimeout(fn, 0); return () => live.delete(fn); }
  });
  return { db: { collection: c => query(c, []), doc }, change: (p, d) => { docs[p] = copy(d); push(); } };
}
const webUser = canWrite => ({ me: async () => ({ id: 'u1', name: 'Ana' }), can: async () => canWrite, profiles: async () => ({}), search: async () => [] });
const webClaude = (db, canWrite = true) => ({ use: async name => name === 'db' ? db : name === 'user' ? webUser(canWrite) : null });
const copyOf = o => JSON.parse(JSON.stringify(o));

test('web version: colors come from the shared document, quick changes are all saved, and a teammate’s change shows', async t => {
  const docs = copyOf(withColors({ goth: VIOLET }, { 'subs/s1': sub('r/goth', { tags: ['goth', 'Alt'] }) }));
  const { db, change } = liveDb(docs, 40);
  const L = await open({ claude: webClaude(db) }); t.after(() => L.close());
  await L.go('#t/subs');
  assert.deepEqual(tableTags(L), [['r/goth', [['goth', rgb(VIOLET)], ['Alt', '']]]]);
  await openRow(L, '#t/subs', 'r/goth');
  await openTags(L);
  // Two colors picked one right after the other: the second is saved while the first is still on its way.
  L.click(colorButton(L, 'Goth')); L.click(swatch(L, 'Teal'));
  L.click(colorButton(L, 'Alt')); L.click(swatch(L, 'Pink'));
  assert.deepEqual(popRows(L), [['Alt', rgb(PINK), rgb(PINK)], ['Goth', rgb(TEAL), rgb(TEAL)]], 'shown at once');
  await L.sleep(700);
  assert.deepEqual(docs['meta/tagColors'], { colors: { alt: PINK, goth: TEAL } });
  const logged = Object.entries(docs).filter(([k]) => k.startsWith('audit/u1/m/')).flatMap(([, v]) => v.entries);
  assert.deepEqual(logged.map(e => [e.n, e.ch[0].to]).sort(), [['Alt', PINK], ['Goth', TEAL]]);
  await escape(L);
  // A teammate's change to something else doesn't redraw the open panel.
  const title = L.$('#peek .titlein');
  change('subs/s9', sub('r/emo', { tags: ['Emo'] }));
  await L.sleep(300);
  assert.equal(L.$('#peek .titlein'), title);
  // A teammate picks sky blue for goth: the open panel follows, and so does the table.
  change('meta/tagColors', { colors: { alt: PINK, goth: SKY } });
  await L.sleep(300);
  assert.deepEqual(boxTags(L), [['goth', rgb(SKY)], ['Alt', rgb(PINK)]]);
  await closePeek(L);
  assert.deepEqual(tableTags(L), [['r/emo', [['Emo', '']]], ['r/goth', [['goth', rgb(SKY)], ['Alt', rgb(PINK)]]]]);
  // And back to the default.
  change('meta/tagColors', { colors: {} });
  await L.sleep(300);
  assert.deepEqual(tableTags(L), [['r/emo', [['Emo', '']]], ['r/goth', [['goth', ''], ['Alt', '']]]]);
  assert.deepEqual(L.errors, []);
});

test('web version: a view-only person sees the colors but gets no color buttons, and nothing is written', async t => {
  const docs = copyOf(withColors({ goth: VIOLET }));
  const before = copyOf(docs);
  const { db } = liveDb(docs);
  const L = await open({ claude: webClaude(db, false) }); t.after(() => L.close());
  await openRow(L, '#t/subs', 'r/goth');
  assert.deepEqual(boxTags(L), [['goth', rgb(VIOLET)]]);
  assert.equal(tagBox(L).disabled, true);
  // Even with the list of tags open, there is no color button.
  await openTags(L);
  assert.ok(L.$('.pop .opt'), 'the list is open');
  assert.equal(L.$('.tagsw'), null);
  await escape(L); await closePeek(L);
  assert.deepEqual(tableTags(L), [['r/goth', [['goth', rgb(VIOLET)]]]]);
  // And setting a color directly does nothing either.
  await L.w.__lux.setTagColor('goth', TEAL);
  assert.equal(L.w.__lux.tagColor('goth'), VIOLET);
  await L.sleep(200);
  assert.deepEqual(docs, before);
  assert.deepEqual(L.errors, []);
});

// A stand-in for the desktop app's Neutralino: files in memory by path, and the events Lux listens to.
// write() changes a file the way the sync of a shared data folder does; emit() fires an event such as watchFile.
function fakeNeutralino(start){
  const files = new Map(), dirs = new Set(), mtime = new Map(), handlers = {};
  let clock = 1000;
  const addDirs = p => { const a = p.split('/'); for (let i = 2; i < a.length; i++) dirs.add(a.slice(0, i).join('/')); };
  const put = (p, text) => { addDirs(p); files.set(p, text); mtime.set(p, ++clock); };
  for (const [p, v] of Object.entries(start)) put(p, typeof v === 'string' ? v : JSON.stringify(v));
  const missing = () => Promise.reject({ code: 'NE_FS_NOPATHE', message: 'no such file or folder' });
  const emit = (name, detail) => (handlers[name] || []).slice().forEach(fn => fn({ detail }));
  return {
    files, emit,
    read: p => files.has(p) ? JSON.parse(files.get(p)) : undefined,
    write: (p, v) => put(p, JSON.stringify(v)),
    init: () => { setTimeout(() => emit('ready'), 0); },
    events: {
      on: async (name, fn) => { (handlers[name] = handlers[name] || []).push(fn); },
      off: async (name, fn) => { handlers[name] = (handlers[name] || []).filter(x => x !== fn); }
    },
    filesystem: {
      readFile: async p => files.has(p) ? files.get(p) : missing(),
      readBinaryFile: async p => files.has(p) ? new TextEncoder().encode(files.get(p)).buffer : missing(),
      writeFile: async (p, text) => put(p, String(text)),
      writeBinaryFile: async (p, buf) => put(p, new TextDecoder().decode(buf)),
      readDirectory: async p => {
        if (!dirs.has(p)) return missing();
        const names = new Set([...files.keys(), ...dirs].filter(x => x.startsWith(p + '/')).map(x => x.slice(p.length + 1).split('/')[0]));
        return [...names].map(entry => ({ entry, type: dirs.has(p + '/' + entry) ? 'DIRECTORY' : 'FILE' }));
      },
      getStats: async p => files.has(p) ? { size: files.get(p).length, isFile: true, isDirectory: false, modifiedAt: mtime.get(p) }
        : dirs.has(p) ? { size: 0, isFile: false, isDirectory: true, modifiedAt: 0 } : missing(),
      createDirectory: async p => { addDirs(p); dirs.add(p); },
      move: async (a, b) => { if (!files.has(a)) return missing(); put(b, files.get(a)); files.delete(a); },
      copy: async (a, b) => { if (!files.has(a)) return missing(); put(b, files.get(a)); },
      remove: async p => { if (files.has(p)) files.delete(p); else if (dirs.has(p)) dirs.delete(p); else return missing(); },
      getAbsolutePath: async p => p,
      createWatcher: async () => 1
    },
    os: {
      open: async () => {}, showSaveDialog: async (title, o) => o && o.defaultPath, showOpenDialog: async () => [], showFolderDialog: async () => '',
      spawnProcess: () => Promise.reject(new Error('no programs run in tests')), updateSpawnedProcess: async () => {}
    },
    app: { exit: async () => {}, restartProcess: async () => {} },
    window: { setMainMenu: async () => {} }
  };
}
const DATA = '/app/data';
// A desktop app whose data folder holds these documents, used by Ana (u1).
const desk = (docs, more = {}) => fakeNeutralino(Object.assign({
  '/app/config/settings.json': { userId: 'u1', lastBackup: Date.now(), githubUpdates: false },
  [DATA + '/people/u1.json']: { name: 'Ana', createdAt: 1 }
}, Object.fromEntries(Object.entries(docs).map(([p, v]) => [DATA + '/' + p + '.json', v])), more));
const deskErrors = L => L.errors.concat(L.$('.updbar.bad') ? ['crash bar shown'] : []);

test('desktop: colors live in the data folder, and a change made on another computer shows here', async t => {
  const N = desk(mixed({ goth: VIOLET }));
  const L = await open({ neutralino: N }); t.after(() => L.close());
  await L.go('#t/subs');
  assert.deepEqual(tableTags(L), [['r/AltGoth', [['GOTH', rgb(VIOLET)], ['Alt', '']]], ['r/goth', [['goth', rgb(VIOLET)]]]]);
  // Another computer picks teal; the synced folder changes and Lux notices.
  N.write(DATA + '/meta/tagColors.json', { colors: { goth: TEAL } });
  N.emit('watchFile');
  await L.sleep(1200);
  assert.deepEqual(tableTags(L), [['r/AltGoth', [['GOTH', rgb(TEAL)], ['Alt', '']]], ['r/goth', [['goth', rgb(TEAL)]]]]);
  // Two colors picked here one right after the other are both saved in the folder.
  await openRow(L, '#t/subs', 'r/AltGoth');
  await openTags(L);
  L.click(colorButton(L, 'Alt')); L.click(swatch(L, 'Pink'));
  L.click(colorButton(L, 'Goth')); L.click(swatch(L, 'Default gold'));
  await L.sleep(300);
  assert.deepEqual(N.read(DATA + '/meta/tagColors.json'), { colors: { alt: PINK } });
  assert.deepEqual(deskErrors(L), []);
});

test('desktop: Import & export of a full desktop backup brings its tag colors, audit log and people, and asks who you are', async t => {
  const N = desk(withColors({ goth: VIOLET }));
  const L = await open({ neutralino: N }); t.after(() => L.close());
  const at = Date.UTC(2026, 8, 10, 12);
  const s9 = sub('r/emo', { tags: ['Emo'], updatedAt: at });
  await paste(L, backupOf({ kind: 'desktop-full', collections: { subs: [Object.assign({ id: 's9' }, s9)] }, posts: [],
    raw: {
      'subs/s9': s9,
      'people/u9': { name: 'Bia', createdAt: 1 },
      'audit/u9': { uid: 'u9', last: at },
      'audit/u9/m/2026-09_p1': { month: '2026-09', part: 1, entries: [{ id: 'e1', t: at, a: 'updated', c: 'workspace', r: '', n: 'Emo', ch: [{ f: 'Tag color', from: 'default', to: PINK }] }] },
      'meta/tagColors': { colors: { emo: PINK, goth: TEAL } }
    } }));
  const who = L.$('.preview select[aria-label="Which person in this backup are you?"]');
  assert.deepEqual([...who.options].map(o => o.textContent), ['None of them', 'Bia (1 change)']);
  assert.deepEqual(previewLines(L).filter(x => /^(Tag colors|Audit log)/.test(x)),
    ['Tag colors: 2 (colors already set here are kept)', 'Audit log: 1 entries, with who made each change and when (duplicates are skipped)']);
  L.set(who, 'u9');
  await runImport(L, 'Import finished: 1 added or updated, 0 skipped 1 audit log entries added. 1 tag colors added.');
  await L.sleep(300);
  assert.deepEqual(N.read(DATA + '/meta/tagColors.json'), { colors: { emo: PINK, goth: VIOLET } });
  assert.ok(N.read(DATA + '/audit/u9/m/2026-09_p1.json').entries.some(e => e.id === 'e1'));
  assert.equal(N.read(DATA + '/people/u9.json').name, 'Bia');
  assert.equal(N.read('/app/config/settings.json').userId, 'u9', 'Ana is now Bia from the backup');
  await L.go('#t/subs');
  assert.deepEqual(tableTags(L), [['r/emo', [['Emo', rgb(PINK)]]], ['r/goth', [['goth', rgb(VIOLET)]]]]);
  assert.deepEqual(deskErrors(L), []);
});

test('desktop: Restore a backup brings back its tag colors, and the backup made first keeps the ones here', async t => {
  const old = { app: 'lux-management', version: 2, kind: 'desktop-full', exportedAt: '2026-09-20T10:00:00.000Z', collections: {}, posts: [],
    raw: Object.assign({ 'people/u1': { name: 'Ana', createdAt: 1 }, 'meta/tagColors': { colors: { goth: TEAL } } }, seed) };
  const N = desk(withColors({ goth: VIOLET }), { '/app/backups/lux-backup-2026-09-20_10-00.json': old });
  const L = await open({ neutralino: N }); t.after(() => L.close());
  await L.go('#settings');
  L.click(L.button('Restore a backup')); await L.sleep(200);
  L.click(L.$('.modal .opt')); await L.sleep(200);
  L.click(L.button('Restore'));
  assert.ok(await until(L, () => toasts(L).includes('Backup restored')), toasts(L).join(' | '));
  assert.deepEqual(N.read(DATA + '/meta/tagColors.json'), { colors: { goth: TEAL } });
  const made = [...N.files.keys()].filter(p => p.startsWith('/app/backups/lux-backup-') && !p.endsWith('2026-09-20_10-00.json'));
  assert.equal(made.length, 1);
  assert.deepEqual(JSON.parse(N.files.get(made[0])).raw['meta/tagColors'], { colors: { goth: VIOLET } });
  await L.go('#t/subs');
  assert.deepEqual(tableTags(L), [['r/goth', [['goth', rgb(TEAL)]]]]);
  assert.deepEqual(deskErrors(L), []);
});
