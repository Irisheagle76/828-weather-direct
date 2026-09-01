import test from "node:test";
import assert from "node:assert/strict";

import { buildComfortCurveModel } from "../public/js/visuals/comfort-curve.js";

const hour = 60 * 60 * 1000;
const now = Date.UTC(2026, 7, 23, 0, 0, 0);

function forecast(scores) {
  return scores.map((score, index) => ({
    timestamp: now + index * hour,
    temperatureF: 72,
    dewpointF: 55,
    testScore: score
  }));
}

test("comfort curve identifies the strongest contiguous three-hour window", () => {
  const model = buildComfortCurveModel({
    hourly: forecast([61, 66, 74, 82, 88, 86, 76, 69]),
    now,
    hours: 12,
    score: (item) => item.testScore
  });

  assert.equal(model.minimum, 61);
  assert.equal(model.maximum, 88);
  assert.equal(model.best.start, now + 3 * hour);
  assert.equal(model.best.end, now + 5 * hour);
  assert.equal(model.best.peak, 88);
});

test("comfort curve exposes current, trend, and a complete text equivalent", () => {
  const model = buildComfortCurveModel({
    hourly: forecast([82, 80, 78, 70, 65, 60]),
    now,
    hours: 12,
    score: (item) => item.testScore
  });

  assert.equal(model.current.score, 82);
  assert.equal(model.trend.direction, "falling");
  assert.match(model.accessibleSummary, /Now, .*FeelScore 82/);
  assert.match(model.accessibleSummary, /FeelScore 60/);
});

test("comfort curve text equivalent distinguishes challenging and harsh scores", () => {
  const model = buildComfortCurveModel({
    hourly: forecast([54, 40, 39, 30]),
    now,
    hours: 12,
    score: (item) => item.testScore
  });

  assert.match(model.accessibleSummary, /FeelScore 54, Challenging/);
  assert.match(model.accessibleSummary, /FeelScore 40, Challenging/);
  assert.match(model.accessibleSummary, /FeelScore 39, Harsh/);
});

test("comfort curve prefers a nearby current observation over the overlapping forecast hour", () => {
  const currentHour = {
    timestamp: now + 7 * 60 * 1000,
    temperatureF: 66,
    testScore: 89
  };
  const model = buildComfortCurveModel({
    currentHour,
    hourly: forecast([85, 87, 86, 84]),
    now: currentHour.timestamp,
    hours: 12,
    score: (item) => item.testScore
  });

  assert.equal(model.current.timestamp, currentHour.timestamp);
  assert.equal(model.current.score, 89);
  assert.deepEqual(model.points.map((point) => point.score), [89, 87, 86, 84]);
});
