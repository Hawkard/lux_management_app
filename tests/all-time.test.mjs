import { test } from 'node:test';
import assert from 'node:assert/strict';
import { open } from './harness.mjs';

const today = new Date();
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const weekStart = d => { const x = new Date(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return ymd(x); };
const lastYear = new Date(today.getFullYear() - 1, 2, 10);

const seed = {
  ['posts/' + weekStart(today) + '_local']: { weekStart: weekStart(today), uid: 'local', entries: [
    { id: 'p1', d: ymd(today), tm: '10:00', p: 'Reddit', q: 1, ty: 'Post', sub: 'r/goth', title: 'Today' } ] },
  ['posts/' + weekStart(lastYear) + '_local']: { weekStart: weekStart(lastYear), uid: 'local', entries: [
    { id: 'p2', d: ymd(lastYear), tm: '09:00', p: 'TikTok', q: 1, ty: 'Video', title: 'Last year' } ] }
};

test('All time sits right of This month and shows every post', async () => {
  const L = await open({ seed });
  await L.go('#posts');
  const labels = L.$$('.toolbar-row .seg')[1].querySelectorAll('button');
  assert.deepEqual([...labels].map(b => b.textContent), ['Today', 'Yesterday', 'This week', 'This month', 'All time']);
  L.click(L.button('This month')); await L.sleep(300);
  assert.equal(L.$$('.entry').length, 1);
  L.click(L.button('All time')); await L.sleep(300);
  assert.equal(L.$$('.entry').length, 2);
  assert.deepEqual(L.errors, []);
});

test('All time is translated', async () => {
  const L = await open({ seed, lang: 'pt' });
  await L.go('#posts');
  assert.ok(L.$$('.toolbar-row .seg')[1].textContent.includes('Todo o período'));
});
