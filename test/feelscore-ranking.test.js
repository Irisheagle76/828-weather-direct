import test from 'node:test';
import assert from 'node:assert/strict';
import { rankCities } from '../public/js/feelscore-ranking.js';

test('top ten use category scores, stable alphabetical ties and shared ranks', () => {
  const cities = Array.from({ length: 13 }, (_, i) => ({ name: `City ${String(i).padStart(2, '0')}`, finalCategory: i % 6 }));
  const before = structuredClone(cities);
  const ranked = rankCities(cities);
  assert.equal(ranked.length, 10);
  assert.deepEqual(ranked.slice(0, 3).map(({ name, rank, finalCategory }) => [name, rank, finalCategory]), [
    ['City 05', 1, 5], ['City 11', 1, 5], ['City 04', 3, 4],
  ]);
  assert.deepEqual(cities, before);
});

test('missing and invalid scores are excluded while zero remains a valid score', () => {
  assert.deepEqual(rankCities([
    { name: 'Missing', finalCategory: null }, { name: 'Invalid', finalCategory: 6 },
    { name: 'Fractional', finalCategory: 3.5 }, { name: 'Zero', finalCategory: 0 },
    { name: 'Zero', finalCategory: 0 },
  ]), [{ name: 'Zero', finalCategory: 0, rank: 1 }]);
  assert.deepEqual(rankCities(), []);
});
