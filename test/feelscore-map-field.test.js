import test from 'node:test';
import assert from 'node:assert/strict';

import { buildCategoryLookup, sampleContour, smoothContourOpacity } from '../public/js/feelscore-map-field.js';

const bbox = { west: -84, east: -83.25, south: 35, north: 35.75 };
const spacing = 0.25;
const points = [
  { lat: 35, lon: -84, finalCategory: 0 },
  { lat: 35.25, lon: -83.75, finalCategory: 3 },
  { lat: 35.25, lon: -83.5, finalCategory: 1 },
  { lat: 35.5, lon: -83.75, finalCategory: 0 },
];
const lookup = buildCategoryLookup(points);

test('an isolated qualifying point keeps its own category color at its center', () => {
  const field = sampleContour(-83.75, 35.25, lookup, spacing, bbox);
  assert.ok(field);
  assert.ok(field.mix[3] > field.mix[1]);
  assert.equal(field.mix[2], 0);
  assert.equal(smoothContourOpacity(field.strength), 1);
});

test('contours feather outward instead of ending as hard grid cells', () => {
  const center = sampleContour(-83.75, 35.25, lookup, spacing, bbox);
  const edge = sampleContour(-83.75, 35.62, lookup, spacing, bbox);
  assert.ok(center && edge);
  assert.ok(smoothContourOpacity(edge.strength) < smoothContourOpacity(center.strength));
  assert.ok(smoothContourOpacity(edge.strength) > 0);
});

test('neighboring qualifying categories blend only from categories that exist', () => {
  const field = sampleContour(-83.625, 35.25, lookup, spacing, bbox);
  assert.ok(field.mix[1] > 0);
  assert.ok(field.mix[3] > 0);
  assert.equal(field.mix[2], 0);
  assert.equal(field.mix[4], 0);
  assert.equal(field.mix[5], 0);
});

test('locations beyond the contour influence remain unshaded', () => {
  assert.equal(sampleContour(-83.25, 35.75, lookup, spacing, bbox), null);
});
