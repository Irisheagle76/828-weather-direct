import test from "node:test";
import assert from "node:assert/strict";
import { focusedDataset } from "../lib/api-routes/mobile/feelscore-map.js";
import { buildCategoryLookup, sampleContour, CATEGORY_COLORS } from "../public/js/feelscore-map-field.js";
test("focus preserves published categories without weather/scoring duplication", () => {
  const points = [{ lat: 35.5, lon: -82.5, finalCategory: 4, hours: [1, 2, 3, 4] }, { lat: 25, lon: -80, finalCategory: 5 }];
  const states = { features: [{ properties: { NAME: "North Carolina" }, geometry: {} }, { properties: { NAME: "Florida" }, geometry: {} }] };
  const result = focusedDataset({ points, forecastDate: "2026-09-15", generatedAt: "now", bbox: {}, spacingDegrees: .25 }, states);
  assert.deepEqual(result.points, [{ lat: 35.5, lon: -82.5, finalCategory: 4 }]);
  assert.equal(result.boundaries.features.length, 1);
  assert.equal(points[0].hours.length, 4);
});
test("shared desktop sampler uses the same category color and preserves missing coverage", () => {
  const lookup = buildCategoryLookup([{ lat: 35.5, lon: -82.5, finalCategory: 4 }]);
  const field = sampleContour(-82.5, 35.5, lookup, .25, { west: -85, south: 33 });
  assert.equal(field.mix[4], 1);
  assert.deepEqual(CATEGORY_COLORS[4], [73, 198, 139]);
  assert.equal(sampleContour(-70, 30, lookup, .25, { west: -85, south: 33 }), null);
});
