import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeCatalogue } from '../scripts/catalogue.mjs';

const snake = { id: 'snake', title: 'Snake', category: 'arcade' };
const pong = { id: 'pong', title: 'Pong', category: 'arcade' };

test('the earlier layer wins when two layers carry the same id', () => {
  const games = mergeCatalogue({
    base: [snake],
    engine: [{ id: 'snake', title: 'Engine impostor' }],
    curated: [{ id: 'snake', title: 'Curated impostor' }],
    published: [{ id: 'snake', title: 'Published impostor' }],
    generated: [{ id: 'snake', title: 'Harvested impostor' }],
  });
  assert.equal(games.length, 1);
  assert.equal(games[0].title, 'Snake');
});

test('overlays patch category, title and every copy key by id', () => {
  const games = mergeCatalogue({
    base: [snake],
    overlays: {
      snake: {
        category: 'classics',
        title: 'Neon Snake',
        copy: {
          tagline: 'Wrap and grow.',
          description: 'Eat, grow, do not bite yourself.',
          howToPlay: ['Steer with the arrow keys.'],
          faq: [{ q: 'Is it free?', a: 'Yes.' }],
          keywords: ['snake'],
        },
      },
    },
  });
  assert.equal(games[0].category, 'classics');
  assert.equal(games[0].title, 'Neon Snake');
  assert.equal(games[0].tagline, 'Wrap and grow.');
  assert.equal(games[0].description, 'Eat, grow, do not bite yourself.');
  assert.deepEqual(games[0].howToPlay, ['Steer with the arrow keys.']);
  assert.deepEqual(games[0].faq, [{ q: 'Is it free?', a: 'Yes.' }]);
  assert.deepEqual(games[0].keywords, ['snake']);
});

test('an overlay for an unknown id is a hard error, not a silent no-op', () => {
  assert.throws(
    () => mergeCatalogue({ base: [snake], overlays: { nope: { category: 'arcade' } } }),
    /overlays\.json references unknown game: nope/,
  );
});

test('the merge preserves layer order, and layer order inside a layer', () => {
  const games = mergeCatalogue({
    base: [snake],
    engine: [{ id: 'engine-one', title: 'Engine One' }],
    curated: [{ id: 'curated-one', title: 'Curated One' }],
    published: [{ id: 'published-one', title: 'Published One' }],
    generated: [{ id: 'generated-one', title: 'Generated One' }, pong],
  });
  assert.deepEqual(
    games.map((g) => g.id),
    ['snake', 'engine-one', 'curated-one', 'published-one', 'generated-one', 'pong'],
  );
});

test('a duplicate id inside one layer is dropped, not duplicated', () => {
  const games = mergeCatalogue({ base: [snake, { ...snake, title: 'Snake Again' }, pong] });
  assert.deepEqual(games.map((g) => g.id), ['snake', 'pong']);
  assert.equal(games[0].title, 'Snake');
});

test('merging never mutates the caller objects, and an overlay keeps the fields it does not patch', () => {
  const input = { ...snake, tagline: 'Arcade classic.' };
  const games = mergeCatalogue({
    base: [input],
    overlays: { snake: { copy: { tagline: 'Neon arcade classic.' } } },
  });
  assert.equal(input.tagline, 'Arcade classic.');
  assert.equal(input.title, 'Snake');
  assert.deepEqual(games[0].howToPlay, undefined);
  assert.equal(games[0].tagline, 'Neon arcade classic.');
});
