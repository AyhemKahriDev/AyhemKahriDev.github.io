import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));

test('the hand-written catalogue parses and every game has the required fields', () => {
  const { games } = read('content/games.json');
  assert.ok(games.length >= 7);
  for (const g of games) {
    for (const key of ['id', 'title', 'tagline', 'description', 'category', 'accent', 'keywords', 'howToPlay', 'faq']) {
      assert.ok(g[key] !== undefined, `${g.id} is missing ${key}`);
    }
  }
});

test('every catalogue category id is unique', () => {
  const { categories } = read('content/games.json');
  const ids = categories.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
});
