import test from 'node:test';
import assert from 'node:assert/strict';

import { buildCategoryLookup, sampleCategory } from '../public/js/feelscore-map-field.js';

const bbox = { west: -84, east: -83.5, south: 35, north: 35.5 };
const spacing = 0.25;
const points = [
  { lat: 35, lon: -84, finalCategory: 0 },
  { lat: 35, lon: -83.75, finalCategory: 3 },
  { lat: 35.25, lon: -84, finalCategory: 0 },
  { lat: 35.25, lon: -83.75, finalCategory: 0 },
];
const lookup = buildCategoryLookup(points);

test('map sampling preserves the exact category at a forecast grid point', () => {
  assert.equal(sampleCategory(-83.75, 35, lookup, spacing, bbox), 3);
});

test('map sampling never invents an averaged category that is absent from its corners', () => {
  const samples = [
    sampleCategory(-83.79, 35.04, lookup, spacing, bbox),
    sampleCategory(-83.87, 35.12, lookup, spacing, bbox),
    sampleCategory(-83.99, 35.24, lookup, spacing, bbox),
  ];
  assert.ok(samples.every((category) => category === 0 || category === 3));
  assert.ok(!samples.includes(1));
  assert.ok(!samples.includes(2));
});

test('map sampling favors the lower category on an exact boundary tie', () => {
  assert.equal(sampleCategory(-83.875, 35, lookup, spacing, bbox), 0);
});
