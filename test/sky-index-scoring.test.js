import test from "node:test";
import assert from "node:assert/strict";

import {
  blendLiveSummitScore,
  buildSkyScores,
  cloudVisibilityScore,
  forecastWeightedAverage,
  scoreConfidence
} from "../lib/sky-index-scoring.js";

test("cloud visibility remains continuous across former bucket boundaries", () => {
  assert.notEqual(cloudVisibilityScore(45), cloudVisibilityScore(46));
  assert.notEqual(cloudVisibilityScore(64), cloudVisibilityScore(65));
  assert.ok(cloudVisibilityScore(20) > cloudVisibilityScore(45));
  assert.ok(cloudVisibilityScore(45) > cloudVisibilityScore(82));
});

test("near-term forecast cells carry more weight than distant cells", () => {
  const earlyClear = forecastWeightedAverage([100, 100, 0, 0, 0, 0]);
  const lateClear = forecastWeightedAverage([0, 0, 0, 0, 100, 100]);
  assert.ok(earlyClear > lateClear);
});

test("different limited camera clarity values produce different summit scores", () => {
  const makeSignal = (clarityScore) => ({
    type: "camera-limited",
    camera: { condition: "limited_visibility", clarityScore, darkShare: 0.05 }
  });
  const lower = blendLiveSummitScore(80, makeSignal(52));
  const higher = blendLiveSummitScore(80, makeSignal(57));
  assert.notEqual(lower.score, higher.score);
  assert.ok(lower.score < higher.score);
  assert.notEqual(lower.score, 58);
});

test("clear camera scores blend rather than imposing a 90-point floor", () => {
  const result = blendLiveSummitScore(70, {
    type: "camera-usable",
    camera: { condition: "clear_view", clarityScore: 99, darkShare: 0 }
  });
  assert.equal(result.score, 80);
  assert.equal(result.liveWeight, 0.34);
});

test("summit score responds to modest changes in its continuous ingredients", () => {
  const base = {
    cloudCover: 54,
    transparency: 70,
    darkness: 60,
    humidityPenalty: 35,
    smokePenalty: 20,
    windComfort: 75
  };
  const a = buildSkyScores(base);
  const b = buildSkyScores({ ...base, cloudCover: 59, transparency: 73 });
  assert.notEqual(a.summitView, b.summitView);
});

test("confidence reports complete chart and live coverage", () => {
  const metrics = {
    cloudCover: 45,
    transparency: 70,
    darkness: 55,
    humidityPenalty: 30,
    smokePenalty: 20,
    windComfort: 80
  };
  const counts = Object.fromEntries(Object.keys(metrics).map((key) => [key, 12]));
  const confidence = scoreConfidence(metrics, counts, {
    type: "camera-usable",
    camera: { clarityScore: 75, darkShare: 0.1 }
  });
  assert.equal(confidence.score, 94);
  assert.equal(confidence.label, "High");
  assert.equal(confidence.liveObservationUsed, true);
});
