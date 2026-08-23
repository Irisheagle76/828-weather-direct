import test from "node:test";
import assert from "node:assert/strict";

import {
  buildFeelscoreRibbon,
  getAdaptiveHourContext
} from "../public/js/visuals/feelscore-ribbon.js";

test("FeelScore ribbon preserves scores and text classifications", () => {
  const timestamp = Date.UTC(2026, 7, 23, 2);
  const ribbon = buildFeelscoreRibbon([
    { hour: { timestamp }, score: 92 },
    { hour: { timestamp: timestamp + 3600000 }, score: 68 },
    { hour: { timestamp: timestamp + 7200000 }, score: 39 }
  ]);

  assert.deepEqual(ribbon.map((item) => item.className), ["excellent", "noticeable", "harsh"]);
  assert.deepEqual(ribbon.map((item) => item.score), [92, 68, 39]);
});

test("hour context prioritizes rain, then moisture, then significant wind", () => {
  assert.equal(getAdaptiveHourContext({ precipProbability: 0.4, dewpointF: 68, windGust: 25 }).type, "rain");
  assert.equal(getAdaptiveHourContext({ dewpointF: 66, windGust: 25 }).type, "moisture");
  assert.equal(getAdaptiveHourContext({ dewpointF: 55, windGust: 25 }).type, "wind");
  assert.equal(getAdaptiveHourContext({ dewpointF: 55, windSpeed: 4 }), null);
});
