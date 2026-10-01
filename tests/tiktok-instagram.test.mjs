import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { open, fakeNeutralino } from './harness.mjs';

const fx = n => readFileSync(new URL('./fixtures/' + n, import.meta.url), 'utf8');

const ID = '7231338487075638570';
const VIDEO = 'https://www.tiktok.com/@avarose/video/' + ID;
const TT_OEMBED = 'https://www.tiktok.com/oembed?url=' + VIDEO;
const IG = code => `https://www.instagram.com/p/${code}/`;
const FAILED = '! Couldn’t look up this post online. Type the details in.';
const LOOKING = '… Looking up post details';
const plain = o => JSON.parse(JSON.stringify(o));
const field = (L, lab) => L.$$('.logform label').find(l => l.childNodes[0].textContent === lab).querySelector('select,input');
const values = L => ['Post Title', 'Views', 'Likes/Upvotes'].map(f => field(L, f).value);
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
  return {
    calls,
    fetch: url => { calls.push(url); return new Promise(r => waiting.set(url, r)); },
    answer: (url, text) => { const r = waiting.get(url); assert.ok(r, 'nothing asked for ' + url); waiting.delete(url); r(text); }
  };
}
const answers = { tiktokOembed: fx('tiktok-oembed.json'), tiktokPage: fx('tiktok-page.html'), instagram: fx('instagram-page.html') };
// Every platform answering with the saved pages.
const allOk = async url => /tiktok\.com\/oembed/.test(url) ? answers.tiktokOembed : /tiktok\.com/.test(url) ? answers.tiktokPage : /instagram\.com/.test(url) ? answers.instagram : null;

test('TikTok parsers read caption, views and likes', async t => {
  const L = await open(); t.after(() => L.close());
  const { w } = L;
  assert.ok(w.__lux.parseTikTokOembed(fx('tiktok-oembed.json')).title.length > 0);
  const p = w.__lux.parseTikTokPage(fx('tiktok-page.html'));
  assert.ok(Number.isInteger(p.views) && Number.isInteger(p.ups));
  assert.equal(w.__lux.parseTikTokPage('<html>login</html>'), null);
  assert.equal(w.__lux.parseTikTokOembed('not json'), null);
  assert.deepEqual(plain(w.__lux.parseTikTokOembed(fx('tiktok-oembed.json'))), { title: 'Night fit check 🖤 #goth' });
  assert.deepEqual(plain(p), { views: 45200, ups: 3100, title: 'Night fit check 🖤 #goth' });
  assert.deepEqual(plain(w.__lux.parseTikTokPage(fx('tiktok-page.html'), ID)), { views: 45200, ups: 3100, title: 'Night fit check 🖤 #goth' });
});

test('Instagram parser reads likes and caption, never views', async t => {
  const L = await open(); t.after(() => L.close());
  const { w } = L;
  const p = w.__lux.parseInstagramPage(fx('instagram-page.html'));
  assert.ok(Number.isInteger(p.ups));
  assert.equal('views' in p, false);
  assert.equal(w.__lux.parseInstagramPage('<html><title>Login • Instagram</title></html>'), null);
  assert.deepEqual(plain(p), { ups: 1204, title: 'Golden hour ✨' });
});

test('the TikTok page parser reads only the video’s own exact numbers', async t => {
  const L = await open(); t.after(() => L.close());
  const parse = (item, pid) => L.w.__lux.parseTikTokPage(`<script type="application/json" id='__UNIVERSAL_DATA_FOR_REHYDRATION__'>${
    JSON.stringify({ __DEFAULT_SCOPE__: { 'webapp.video-detail': { itemInfo: { itemStruct: item } } } })}</script>`, pid);
  const p = (item, pid) => { const r = parse(item, pid); return r && plain(r); };
  // Exact counts from statsV2 (text) or stats (numbers); one line of caption.
  assert.deepEqual(p({ id: ID, desc: 'Line one\nline two 🖤', statsV2: { playCount: '1234567', diggCount: '89012' } }, ID), { views: 1234567, ups: 89012, title: 'Line one line two 🖤' });
  assert.deepEqual(p({ id: ID, stats: { playCount: 45200, diggCount: 0 } }, ID), { views: 45200, ups: 0, title: '' });
  assert.deepEqual(p({ id: ID, statsV2: { playCount: '45200' }, stats: { playCount: 1, diggCount: 3100 } }, ID), { views: 45200, ups: 3100, title: '' });
  assert.deepEqual(p({ id: ID, desc: 'x', stats: { diggCount: 7 } }, ID), { views: null, ups: 7, title: 'x' });
  // Another video's page, missing or nonsense numbers, or no item: nothing.
  assert.equal(p({ id: '7000000000000000001', stats: { playCount: 45200, diggCount: 3100 } }, ID), null);
  assert.equal(p({ id: ID, desc: 'Only a caption' }, ID), null);
  assert.equal(p({ id: ID, stats: { playCount: -5, diggCount: '1.2K' }, statsV2: { playCount: 'lots', diggCount: {} } }, ID), null);
  assert.equal(p({ id: ID, stats: { playCount: 1e13, diggCount: true } }, ID), null);
  assert.equal(p(null, ID), null);
  assert.equal(p('item', ID), null);
  for (const bad of ['', null, '<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__">{not json</script>',
    '<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__">{"__DEFAULT_SCOPE__":{"webapp.user-detail":{}}}</script>',
    '<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__">null</script>', '<script id="SIGI_STATE">{"stats":{"playCount":5}}</script>'])
    assert.equal(L.w.__lux.parseTikTokPage(bad, ID), null, String(bad));
});

test('the Instagram page parser copes with its markup and never guesses a number', async t => {
  const L = await open(); t.after(() => L.close());
  const p = (html, code) => { const r = L.w.__lux.parseInstagramPage(html, code); return r && plain(r); };
  const meta = (content, more = '') => `<html><head>${more}<meta content="${content}" property="og:description" /></head></html>`;
  // Attributes in any order or quotes, escaped emojis, the caption's own quotes kept.
  assert.deepEqual(p(meta('1,204 likes, 56 comments - ava.rose on July 23, 2024: &quot;Golden hour &#x2728; &#128420; “mine”&quot;')), { ups: 1204, title: 'Golden hour ✨ 🖤 “mine”' });
  assert.deepEqual(p(`<meta property='og:description' content='1 like, 0 comments - Ava Rose (@ava.rose) on Instagram: "Hi"'>`), { ups: 1, title: 'Hi' });
  assert.deepEqual(p(meta('12345 likes, 2 comments - ava.rose on May 1, 2025')), { ups: 12345, title: '' });
  assert.deepEqual(p(meta('0 likes, 0 comments - ava.rose on May 1, 2025: &quot;Line one\nline two')), { ups: 0, title: 'Line one line two' });
  // Only the page description when there is no og:description.
  assert.deepEqual(p('<meta name="description" content="2,000 likes, 3 comments - ava.rose on May 1, 2025: &quot;Hey&quot;. ">'), { ups: 2000, title: 'Hey' });
  // A rounded count is not the real number: the caption only.
  assert.deepEqual(p(meta('12K likes, 340 comments - ava.rose on May 1, 2025: &quot;Big one&quot;')), { ups: null, title: 'Big one' });
  assert.deepEqual(p(meta('1.2M likes, 3,400 comments - ava.rose on May 1, 2025: &quot;Bigger&quot;')), { ups: null, title: 'Bigger' });
  assert.equal(p(meta('1.2M likes, 3,400 comments - ava.rose on May 1, 2025')), null);
  assert.deepEqual(p(meta('1,20,4 likes, 5 comments - ava.rose on May 1, 2025: &quot;Odd&quot;')), { ups: null, title: 'Odd' });
  // The page of another post, or a login page, or anything else: nothing.
  const own = '<meta property="og:url" content="https://www.instagram.com/p/C9xAb12Cd/">';
  assert.deepEqual(p(meta('5 likes, 1 comment - ava.rose on May 1, 2025: &quot;Mine&quot;', own), 'C9xAb12Cd'), { ups: 5, title: 'Mine' });
  assert.equal(p(meta('5 likes, 1 comment - ava.rose on May 1, 2025: &quot;Not mine&quot;', own), 'C0therPost'), null);
  // Its own address written any way Instagram writes it; never a longer code that only starts the same.
  for (const [url, ok] of [['https://www.instagram.com/p/C9xAb12Cd', true], ['https://www.instagram.com/p/C9xAb12Cd/?hl=en', true],
    ['https://www.instagram.com/p/C9xAb12Cd?utm_source=ig', true], ['https://www.instagram.com/reel/C9xAb12Cd/', true],
    ['https://www.instagram.com/ava.rose/p/C9xAb12Cd/', true], ['https://www.instagram.com/p/C9xAb12Cd#top', true],
    ['https://www.instagram.com/p/C9xAb12CdX/', false], ['https://www.instagram.com/p/xC9xAb12Cd/', false], ['https://www.instagram.com/', false]])
    assert.equal(!!p(meta('5 likes, 1 comment - ava.rose on May 1, 2025: &quot;Mine&quot;', `<meta property="og:url" content="${url}">`), 'C9xAb12Cd'), ok, url);
  for (const bad of ['', null, '<html><title>Login • Instagram</title></html>',
    meta('Create an account or log in to Instagram - A simple, fun &amp; creative way to capture, edit &amp; share photos, videos &amp; messages with friends &amp; family.'),
    meta('1.204 curtidas, 56 comentários - ava.rose em 23 de julho de 2024: &quot;Oi&quot;'), meta('likes, comments - on'), '<meta property="og:description">'])
    assert.equal(L.w.__lux.parseInstagramPage(bad), null, String(bad));
});

test('lookupPostDetails combines TikTok oEmbed and page, and survives failures', async t => {
  const L = await open(); t.after(() => L.close());
  L.w.__lux.setFetcherForTests(async url => /oembed/.test(url) ? fx('tiktok-oembed.json') : fx('tiktok-page.html'));
  const r = await L.w.__lux.lookupPostDetails({ ok: true, p: 'TikTok', author: 'avarose', pid: '7231338487075638570', url: 'https://www.tiktok.com/@avarose/video/7231338487075638570' });
  assert.equal(r.source, 'TikTok');
  assert.ok(r.title && r.views > 0 && r.ups > 0);
  assert.deepEqual(plain(r), { title: 'Night fit check 🖤 #goth', views: 45200, ups: 3100, source: 'TikTok' });
  L.w.__lux.setFetcherForTests(async url => /oembed/.test(url) ? fx('tiktok-oembed.json') : null);
  const r2 = await L.w.__lux.lookupPostDetails({ ok: true, p: 'TikTok', author: 'avarose', pid: '7231338487075638570' });
  assert.ok(r2.title && r2.views == null);
  assert.equal(r2.ups, null);
  // Only the page answers: its caption and numbers.
  L.w.__lux.setFetcherForTests(async url => /oembed/.test(url) ? '<html>Blocked</html>' : fx('tiktok-page.html').replace('Night fit check', 'From the page'));
  assert.deepEqual(plain(await L.w.__lux.lookupPostDetails({ ok: true, p: 'TikTok', author: 'avarose', pid: ID })),
    { title: 'From the page 🖤 #goth', views: 45200, ups: 3100, source: 'TikTok' });
  L.w.__lux.setFetcherForTests(async () => { throw new Error('offline'); });
  assert.equal(await L.w.__lux.lookupPostDetails({ ok: true, p: 'TikTok', author: 'avarose', pid: '7231338487075638570' }), null);
  // Instagram: likes and caption, never views.
  L.w.__lux.setFetcherForTests(allOk);
  const ig = await L.w.__lux.lookupPostDetails({ ok: true, p: 'Instagram', pid: 'C9xAb12Cd', type: 'Feed post' });
  assert.deepEqual(plain(ig), { title: 'Golden hour ✨', ups: 1204, source: 'Instagram' });
  for (const page of [null, '<html><title>Login • Instagram</title></html>', '']){
    L.w.__lux.setFetcherForTests(async () => page);
    assert.equal(await L.w.__lux.lookupPostDetails({ ok: true, p: 'Instagram', pid: 'C9xAb12Cd' }), null, String(page));
  }
});

test('what Lux asks TikTok and Instagram for, and the links it never looks up', async t => {
  const L = await open(); t.after(() => L.close());
  const calls = [];
  L.w.__lux.setFetcherForTests(async url => { calls.push(url); return null; });
  const asked = async r => { calls.length = 0; await L.w.__lux.lookupPostDetails(r); return calls.slice().sort(); };
  assert.deepEqual(await asked({ ok: true, p: 'TikTok', type: 'Video', author: 'ava.rose_x', pid: ID }),
    [`https://www.tiktok.com/@ava.rose_x/video/${ID}`, `https://www.tiktok.com/oembed?url=https://www.tiktok.com/@ava.rose_x/video/${ID}`]);
  assert.deepEqual(await asked({ ok: true, p: 'TikTok', type: 'Slideshow', author: 'avarose', pid: ID }),
    [`https://www.tiktok.com/@avarose/photo/${ID}`, `https://www.tiktok.com/oembed?url=https://www.tiktok.com/@avarose/photo/${ID}`]);
  assert.deepEqual(await asked({ ok: true, p: 'Instagram', type: 'Reel', pid: 'C9x-Ab_12' }), [IG('C9x-Ab_12')]);
  for (const r of [{ ok: true, p: 'TikTok', pid: ID }, { ok: true, p: 'TikTok', author: 'a', pid: ID }, { ok: true, p: 'TikTok', author: 'ava rose', pid: ID },
    { ok: true, p: 'TikTok', author: 'avarose', pid: '12345' }, { ok: true, p: 'Instagram', pid: 'abc' }, { ok: true, p: 'Instagram', pid: 'C9x%2FAb' },
    { ok: false, why: 'short', p: 'TikTok' }, { ok: false, why: 'story', p: 'Instagram' }])
    assert.deepEqual(await asked(r), [], JSON.stringify(r));
  // Every address asked for passes the safety check.
  for (const r of [{ ok: true, p: 'TikTok', author: 'ava.rose_x', pid: ID }, { ok: true, p: 'Instagram', pid: 'C9x-Ab_12' }]){
    for (const url of await asked(r)) assert.ok(L.w.__lux.LOOKUP_URL_RE.test(url), url);
  }
});

test('pasting a TikTok link fills title, views and likes but keeps typed values', async t => {
  const L = await open({ seed: {} }); t.after(() => L.close());
  L.w.__lux.setFetcherForTests(async url => /oembed/.test(url) ? fx('tiktok-oembed.json') : fx('tiktok-page.html'));
  await L.go('#posts');
  const field = lab => L.$$('.logform label').find(l => l.childNodes[0].textContent === lab).querySelector('select,input');
  L.set(field('Views'), '999');
  L.set(field('Link'), 'https://www.tiktok.com/@avarose/video/7231338487075638570', 'input'); await L.sleep(300);
  assert.ok(field('Post Title').value.length > 0);
  assert.equal(field('Views').value, '999');
  assert.ok(Number(field('Likes/Upvotes').value) > 0);
  assert.deepEqual(values(L), ['Night fit check 🖤 #goth', '999', '3100']);
  assert.deepEqual(chips(L), ['✓ TikTok', '✓ Details from TikTok']);
  await logPost(L);
  assert.deepEqual(plain(logged(L).map(e => [e.p, e.title, e.views, e.ups, e.pid])), [['TikTok', 'Night fit check 🖤 #goth', 999, 3100, ID]]);
  assert.deepEqual(L.errors, []);
});

test('re-pasting a logged post fills in its current numbers over the ones logged, never over numbers typed in', async t => {
  const L = await open({ seed: {} }); t.after(() => L.close());
  let page = fx('tiktok-page.html').replace('"45200"', '"12"').replace('"3100"', '"1"');
  L.w.__lux.setFetcherForTests(async url => /oembed/.test(url) ? fx('tiktok-oembed.json') : page);
  await L.go('#posts');
  paste(L, VIDEO); await L.sleep(150);
  assert.deepEqual(values(L), ['Night fit check 🖤 #goth', '12', '1']);
  await logPost(L);
  // A week later the page shows more: pasted again, the post is updated with its current numbers.
  page = fx('tiktok-page.html');
  paste(L, VIDEO); await L.sleep(150);
  assert.equal(L.$('.logform button[type=submit]').textContent, 'Update post');
  assert.deepEqual(values(L), ['Night fit check 🖤 #goth', '45200', '3100']);
  assert.ok(chips(L).includes('✓ Details from TikTok'));
  await logPost(L);
  assert.deepEqual(plain(logged(L).map(e => [e.title, e.views, e.ups])), [['Night fit check 🖤 #goth', 45200, 3100]]);
  // Views typed in while Lux looks it up stay; the likes Lux showed from the log are brought up to date.
  const F = heldFetcher();
  L.w.__lux.setFetcherForTests(F.fetch);
  paste(L, VIDEO); await L.sleep(100);
  assert.deepEqual(values(L), ['Night fit check 🖤 #goth', '45200', '3100']);
  L.set(field(L, 'Views'), '50000', 'input');
  F.answer(TT_OEMBED, fx('tiktok-oembed.json'));
  F.answer(VIDEO, fx('tiktok-page.html').replace('"45200"', '"60000"').replace('"3100"', '"3200"')); await L.sleep(100);
  assert.deepEqual(values(L), ['Night fit check 🖤 #goth', '50000', '3200']);
  await logPost(L);
  assert.deepEqual(plain(logged(L).map(e => [e.views, e.ups])), [[50000, 3200]]);
  assert.deepEqual(L.errors, []);
});

test('TikTok: what is typed while Lux looks it up is kept, and a blocked page still gives the caption', async t => {
  const L = await open({ seed: {} }); t.after(() => L.close());
  const F = heldFetcher();
  L.w.__lux.setFetcherForTests(F.fetch);
  await L.go('#posts');
  paste(L, VIDEO); await L.sleep(100);
  assert.deepEqual(F.calls.slice().sort(), [VIDEO, TT_OEMBED].sort(), 'both pages asked for at once');
  assert.ok(chips(L).includes(LOOKING));
  L.set(field(L, 'Post Title'), 'My caption', 'input');
  L.set(field(L, 'Likes/Upvotes'), '12');
  F.answer(TT_OEMBED, fx('tiktok-oembed.json'));
  F.answer(VIDEO, fx('tiktok-page.html')); await L.sleep(100);
  assert.deepEqual(values(L), ['My caption', '45200', '12']);
  assert.deepEqual(chips(L), ['✓ TikTok', '✓ Details from TikTok']);
  await logPost(L);
  assert.deepEqual(plain(logged(L).map(e => [e.title, e.views, e.ups])), [['My caption', 45200, 12]]);
  // The page is blocked: the caption from oEmbed, and the numbers are left to type.
  const other = 'https://www.tiktok.com/@avarose/video/7231338487075638571';
  paste(L, other); await L.sleep(100);
  F.answer('https://www.tiktok.com/oembed?url=' + other, fx('tiktok-oembed.json'));
  F.answer(other, '<html><head><title>Verify to continue</title></head></html>'); await L.sleep(100);
  assert.deepEqual(values(L), ['Night fit check 🖤 #goth', '', '']);
  assert.deepEqual(chips(L), ['✓ TikTok', '✓ Details from TikTok']);
  assert.deepEqual(L.errors, []);
});

test('pasting an Instagram link fills likes and caption, never views, and keeps typed likes', async t => {
  const L = await open({ seed: {} }); t.after(() => L.close());
  const F = heldFetcher();
  L.w.__lux.setFetcherForTests(F.fetch);
  await L.go('#posts');
  paste(L, 'https://www.instagram.com/reel/C9xAb12Cd/?igsh=abc'); await L.sleep(100);
  assert.deepEqual(F.calls, [IG('C9xAb12Cd')]);
  F.answer(IG('C9xAb12Cd'), fx('instagram-page.html')); await L.sleep(100);
  assert.deepEqual(values(L), ['Golden hour ✨', '', '1204']);
  assert.deepEqual(chips(L), ['✓ Instagram', '✓ Details from Instagram']);
  L.set(field(L, 'Views'), '5000');
  await logPost(L);
  assert.deepEqual(plain(logged(L).map(e => [e.p, e.ty, e.title, e.views, e.ups])), [['Instagram', 'Reel', 'Golden hour ✨', 5000, 1204]]);
  // Likes typed first are kept.
  L.set(field(L, 'Likes/Upvotes'), '77');
  paste(L, IG('C9xAb12Ce')); await L.sleep(100);
  F.answer(IG('C9xAb12Ce'), fx('instagram-page.html')); await L.sleep(100);
  assert.deepEqual(values(L), ['Golden hour ✨', '', '77']);
  assert.deepEqual(L.errors, []);
});

test('TikTok and Instagram: when nothing can be read, the details are typed in and logged as before', async t => {
  const L = await open({ seed: {} }); t.after(() => L.close());
  await L.go('#posts');
  const cases = [
    ['TikTok: both blocked', 'https://www.tiktok.com/@avarose/video/72313384870756385', async () => null],
    ['TikTok: offline', 'https://www.tiktok.com/@avarose/video/72313384870756386', async () => { throw new Error('offline'); }],
    ['TikTok: a verification page and broken JSON', 'https://www.tiktok.com/@avarose/video/72313384870756387',
      async url => /oembed/.test(url) ? '{"title":"Night' : '<html><title>Verify</title><script id="__UNIVERSAL_DATA_FOR_REHYDRATION__">{}</script></html>'],
    ['Instagram: the login page', IG('C9xAb12Cf'), async () => '<html><head><title>Login • Instagram</title><meta property="og:description" content="Create an account or log in to Instagram"></head></html>'],
    ['Instagram: offline', IG('C9xAb12Cg'), async () => null]
  ];
  for (const [i, [kind, link, fetcher]] of cases.entries()){
    L.w.__lux.setFetcherForTests(fetcher);
    paste(L, link); await L.sleep(150);
    assert.ok(chips(L).includes(FAILED), kind + ': ' + chips(L).join(' | '));
    assert.deepEqual(values(L), ['', '', ''], kind);
    L.set(field(L, 'Post Title'), 'Typed ' + i, 'input');
    L.set(field(L, 'Views'), String(i + 10));
    await logPost(L);
    assert.deepEqual(plain(logged(L).map(e => [e.title, e.views])).pop(), ['Typed ' + i, i + 10], kind);
  }
  // A short TikTok link can't be read at all, so nothing is asked.
  const calls = [];
  L.w.__lux.setFetcherForTests(async url => { calls.push(url); return null; });
  paste(L, 'https://vm.tiktok.com/ZMabc123/'); await L.sleep(150);
  assert.deepEqual(calls, []);
  assert.ok(!chips(L).some(c => c === LOOKING || c === FAILED));
  assert.deepEqual(L.errors, []);
});

test('details Lux filled in for one post never stay for another: they go when the link changes, unless typed over', async t => {
  const L = await open({ seed: {} }); t.after(() => L.close());
  const F = heldFetcher();
  L.w.__lux.setFetcherForTests(F.fetch);
  await L.go('#posts');
  const other = 'https://www.tiktok.com/@avarose/video/7231338487075638571';
  paste(L, VIDEO); await L.sleep(100);
  F.answer(TT_OEMBED, fx('tiktok-oembed.json')); F.answer(VIDEO, fx('tiktok-page.html')); await L.sleep(100);
  assert.deepEqual(values(L), ['Night fit check 🖤 #goth', '45200', '3100']);
  // Another video: emptied at once, then filled with its own details.
  paste(L, other); await L.sleep(100);
  assert.deepEqual(values(L), ['', '', '']);
  F.answer('https://www.tiktok.com/oembed?url=' + other, JSON.stringify({ title: 'Second video ✨' }));
  F.answer(other, fx('tiktok-page.html').replace(ID, '7231338487075638571').replace('"45200"', '"777"')); await L.sleep(100);
  assert.deepEqual(values(L), ['Second video ✨', '777', '3100']);
  // What was typed over stays; what Lux filled in goes, even when the next lookup fails.
  L.set(field(L, 'Likes/Upvotes'), '55', 'input');
  paste(L, IG('C9xAb12Cd')); await L.sleep(100);
  assert.deepEqual(values(L), ['', '', '55']);
  F.answer(IG('C9xAb12Cd'), '<html><title>Login • Instagram</title></html>'); await L.sleep(100);
  assert.deepEqual(values(L), ['', '', '55']);
  assert.ok(chips(L).includes(FAILED));
  // Emptying the link empties what Lux filled in for it.
  paste(L, VIDEO); await L.sleep(100);
  F.answer(TT_OEMBED, fx('tiktok-oembed.json')); F.answer(VIDEO, fx('tiktok-page.html')); await L.sleep(100);
  assert.deepEqual(values(L), ['Night fit check 🖤 #goth', '45200', '55']);
  L.set(field(L, 'Link'), '', 'input'); await L.sleep(100);
  assert.deepEqual(values(L), ['', '', '55']);
  // Once a post is logged, the form starts afresh: a number typed for the next one is kept, whatever it is.
  paste(L, VIDEO); await L.sleep(100);
  F.answer(TT_OEMBED, fx('tiktok-oembed.json')); F.answer(VIDEO, fx('tiktok-page.html')); await L.sleep(100);
  assert.deepEqual(values(L), ['Night fit check 🖤 #goth', '45200', '55']);
  await logPost(L);
  L.set(field(L, 'Views'), '45200', 'input');
  paste(L, other); await L.sleep(100);
  assert.deepEqual(values(L), ['', '45200', '']);
  assert.deepEqual(L.errors, []);
});

test('a Reddit title looked up for one post never stays for the next, and a logged post’s numbers stay with it', async t => {
  const reddit = { name: 'Ava', status: 'Active', niche: [], nsfwSubs: [], sfwSubs: [], platforms: ['Reddit', 'TikTok'], employees: [] };
  const L = await open({ seed: { 'models/m1': reddit } }); t.after(() => L.close());
  const F = heldFetcher();
  L.w.__lux.setFetcherForTests(F.fetch);
  await L.go('#posts');
  const oembed = id => `https://www.reddit.com/oembed?url=https://www.reddit.com/r/goth/comments/${id}/`;
  paste(L, 'https://www.reddit.com/r/goth/comments/abc123/spooky_night/'); await L.sleep(100);
  F.answer(oembed('abc123'), JSON.stringify({ title: 'Spooky night 🖤✨' })); await L.sleep(100);
  assert.equal(field(L, 'Post Title').value, 'Spooky night 🖤✨');
  // The next link has no title in it and Reddit refuses: the title box is empty, ready to type.
  paste(L, 'https://www.reddit.com/r/goth/comments/def456/'); await L.sleep(100);
  F.answer(oembed('def456'), null); await L.sleep(100);
  assert.equal(field(L, 'Post Title').value, '');
  assert.ok(chips(L).includes(FAILED));
  // A post logged before: its numbers are shown for it, its title is kept over the one looked up, and both go when the
  // link changes.
  L.set(field(L, 'Post Title'), 'Logged one', 'input');
  L.set(field(L, 'Views'), '300'); L.set(field(L, 'Likes/Upvotes'), '20');
  await logPost(L);
  paste(L, 'https://www.reddit.com/r/goth/comments/def456/'); await L.sleep(100);
  assert.equal(L.$('.logform button[type=submit]').textContent, 'Update post');
  F.answer(oembed('def456'), JSON.stringify({ title: 'Real title' })); await L.sleep(100);
  assert.deepEqual(values(L), ['Logged one', '300', '20']);
  paste(L, VIDEO); await L.sleep(100);
  assert.deepEqual(values(L), ['', '', '']);
  assert.equal(L.$('.logform button[type=submit]').textContent, 'Log post');
  assert.deepEqual(L.errors, []);
});

test('desktop: TikTok’s two pages are asked for together, each with its own files, with the right user agents', async t => {
  const held = new Map();
  const N = fakeNeutralino({
    '/app/config/settings.json': { userId: 'u1', lastBackup: Date.now(), githubUpdates: false },
    '/app/data/people/u1.json': { name: 'Ana', createdAt: 1 }
  }, { curl: url => new Promise(r => held.set(url, r)) });
  const L = await open({ neutralino: N }); t.after(() => L.close());
  await L.go('#posts');
  paste(L, VIDEO); await L.sleep(300);
  // Both running at once, before either answers.
  assert.equal(N.spawned.length, 2);
  const [a, b] = N.spawned;
  assert.notEqual(a.command, b.command);
  assert.notEqual(a.config.output, b.config.output);
  const byUrl = Object.fromEntries(N.spawned.map(s => [s.config.url, s.config['user-agent']]));
  assert.deepEqual(byUrl, { [TT_OEMBED]: 'Mozilla/5.0', [VIDEO]: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' });
  assert.ok(N.spawned.every(s => s.config['max-time'] === '8' && /^curl -K lux-lookup-[0-9a-z]+\.curl$/.test(s.command) && !s.command.includes('tiktok')));
  held.get(VIDEO)({ code: 0, body: fx('tiktok-page.html') });
  held.get(TT_OEMBED)({ code: 0, body: fx('tiktok-oembed.json') });
  await L.sleep(300);
  assert.deepEqual(values(L), ['Night fit check 🖤 #goth', '45200', '3100']);
  assert.deepEqual([...N.files.keys()].filter(p => p.startsWith('/app/lookup/')), []);
  // Instagram: one page, with a browser's user agent; a login wall leaves everything to type.
  paste(L, IG('C9xAb12Cd')); await L.sleep(300);
  assert.equal(N.spawned.length, 3);
  assert.deepEqual([N.spawned[2].config.url, N.spawned[2].config['user-agent']], [IG('C9xAb12Cd'), 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)']);
  held.get(IG('C9xAb12Cd'))({ code: 0, body: '<html><title>Login • Instagram</title></html>' });
  await L.sleep(300);
  assert.deepEqual(values(L), ['', '', '']);
  assert.ok(chips(L).includes(FAILED));
  assert.deepEqual([...N.files.keys()].filter(p => p.startsWith('/app/lookup/')), []);
  assert.deepEqual(L.errors, []);
});

test('Portuguese: details from TikTok and Instagram', async t => {
  const L = await open({ seed: {}, lang: 'pt' }); t.after(() => L.close());
  L.w.__lux.setFetcherForTests(allOk);
  await L.go('#posts');
  const link = L.$('.logform input[autocomplete=off]:not([list])');
  link.value = VIDEO; link.dispatchEvent(new L.w.Event('input', { bubbles: true })); await L.sleep(200);
  assert.deepEqual(chips(L), ['✓ TikTok', '✓ Detalhes do TikTok']);
  link.value = IG('C9xAb12Cd'); link.dispatchEvent(new L.w.Event('input', { bubbles: true })); await L.sleep(200);
  assert.deepEqual(chips(L), ['✓ Instagram', '✓ Detalhes do Instagram']);
  assert.deepEqual(L.errors, []);
});
