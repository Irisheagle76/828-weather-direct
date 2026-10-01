import test from 'node:test';
import assert from 'node:assert/strict';

import { buildCategoryLookup, mapProjection, sampleContour, smoothContourOpacity } from '../public/js/feelscore-map-field.js';

const bbox = { west: -84, east: -83.25, south: 35, north: 35.75 };
const spacing = 0.25;
const points = [
  { lat: 35, lon: -84, finalCategory: 0 },
  { lat: 35.25, lon: -83.75, finalCategory: 3 },
  { lat: 35.25, lon: -83.5, finalCategory: 1 },
  { lat: 35.5, lon: -83.75, finalCategory: 0 },
];
const lookup = buildCategoryLookup(points);

for (const [width, height] of [[1622, 862], [1178, 626], [680, 390], [390, 488], [260, 430]]) {
  test(`contours, boundaries and hit testing align at ${width}x${height}`, () => {
    const scale = Math.min(1, 760 / width);
    const layerWidth = Math.max(280, Math.round(width * scale));
    const layerHeight = Math.max(220, Math.round(height * scale));
    const display = mapProjection(bbox, width, height);
    const raster = mapProjection(bbox, width, height, layerWidth, layerHeight);
    for (const [lon, lat] of [[bbox.west, bbox.north], [bbox.east, bbox.south], [-83.75, 35.25]]) {
      const [x, y] = display.point(lon, lat);
      const [rx, ry] = raster.point(lon, lat);
      assert.ok(Math.abs(rx * width / layerWidth - x) < 1e-9);
      assert.ok(Math.abs(ry * height / layerHeight - y) < 1e-9);
      const sampled = raster.inverse(x * layerWidth / width, y * layerHeight / height);
      const selected = display.inverse(x, y);
      assert.ok(Math.abs(sampled[0] - lon) < 1e-9);
      assert.ok(Math.abs(sampled[1] - lat) < 1e-9);
      assert.deepEqual(sampled, selected);
    }
  });
}

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
