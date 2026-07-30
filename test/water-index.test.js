import test from "node:test";
import assert from "node:assert/strict";

import {
  scoreWaterfallFlow,
  splitRainfallWindows
} from "../public/js/water/waterfall-index.js";
import {
  scoreRiverActivity,
  seasonalFlowRatio
} from "../public/js/water/river-index.js";
import { WATERFALLS, RIVERS } from "../public/js/water/water-data.js";

const lookingGlass = WATERFALLS.find((item) => item.id === "looking-glass-falls");
const asheville = RIVERS.find((item) => item.id === "french-broad-asheville");

test("waterfall scoring withholds a score when precipitation is unavailable", () => {
  assert.equal(scoreWaterfallFlow(lookingGlass, { available: false }), null);
});

test("waterfall rainfall windows do not count the same rain more than once", () => {
  assert.deepEqual(
    splitRainfallWindows({ rain24h: 1, rain3d: 2, rain7d: 3, rain14d: 5 }),
    [1, 1, 1, 2]
  );
});

test("fast waterfalls respond more to a recent storm than the same older rain", () => {
  const recent = scoreWaterfallFlow(lookingGlass, {
    available: true,
    rain24h: 1.25,
    rain3d: 1.25,
    rain7d: 1.25,
    rain14d: 1.25
  });
  const older = scoreWaterfallFlow(lookingGlass, {
    available: true,
    rain24h: 0,
    rain3d: 1.25,
    rain7d: 1.25,
    rain14d: 1.25
  });
  assert.ok(recent > older);
  assert.ok(recent - older >= 15);
});

test("waterfall scores move through dry, normal, and wet scenarios without exceeding the scale", () => {
  const dry = scoreWaterfallFlow(lookingGlass, {
    available: true,
    rain24h: 0,
    rain3d: 0,
    rain7d: 0.08,
    rain14d: 0.2
  });
  const normal = scoreWaterfallFlow(lookingGlass, {
    available: true,
    rain24h: 0.2,
    rain3d: 0.65,
    rain7d: 1.2,
    rain14d: 2
  });
  const wet = scoreWaterfallFlow(lookingGlass, {
    available: true,
    rain24h: 1.2,
    rain3d: 2.8,
    rain7d: 4.2,
    rain14d: 6
  });
  assert.ok(dry < normal);
  assert.ok(normal < wet);
  assert.ok(wet <= 96);
});

test("river scoring uses seasonal percent-normal flow", () => {
  assert.equal(seasonalFlowRatio({ percentNormal: 135, dischargeCfs: 2000 }, asheville), 1.35);
});

test("rising water and runoff reduce contact-recreation scores", () => {
  const calmGauge = {
    isLive: true,
    dischargeCfs: 1300,
    percentNormal: 100,
    trend12hPct: 2
  };
  const risingGauge = {
    ...calmGauge,
    trend12hPct: 48
  };
  const dry = { available: true, rain6h: 0, rain24h: 0.05, rain3d: 0.2 };
  const wet = { available: true, rain6h: 0.8, rain24h: 1.4, rain3d: 2.5 };
  const weather = { thunderstormRisk: 0.1, airTempF: 80, windMph: 5 };
  const calm = scoreRiverActivity(asheville, "tubing", calmGauge, dry, weather);
  const rising = scoreRiverActivity(asheville, "tubing", risingGauge, wet, weather);
  assert.ok(calm.score - rising.score >= 35);
});

test("river scoring withholds ratings without a live gauge", () => {
  const result = scoreRiverActivity(asheville, "tubing", null, {}, {});
  assert.equal(result.score, null);
  assert.equal(result.rating, "Data Limited");
});

test("river-specific hazardous thresholds override the suitability score", () => {
  const result = scoreRiverActivity(asheville, "swimming", {
    isLive: true,
    dischargeCfs: 6100,
    percentNormal: 400,
    trend12hPct: 20
  }, { available: true, rain6h: 0, rain24h: 0, rain3d: 0 }, {
    thunderstormRisk: 0,
    airTempF: 80,
    windMph: 5
  });
  assert.equal(result.rating, "Hazardous");
});
