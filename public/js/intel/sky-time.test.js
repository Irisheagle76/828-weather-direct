import test from "node:test";
import assert from "node:assert/strict";
import {
  buildDuskSkyFallback,
  evaluateSunsetPromotion,
  evaluateSunsetSky,
  findTodaySolarTimes,
  getSkyTimePhase,
  AFTERGLOW_AFTER_SUNSET_MS,
  SUNSET_GRACE_MS
} from "./sky-time.js";

test("uses the same sunset and afterglow windows for every display", () => {
  const sunsetAt = Date.parse("2026-06-28T00:48:00Z");
  assert.equal(getSkyTimePhase({ now: sunsetAt + 8 * 60 * 1000, sunsetAt }), "sunset");
  assert.equal(getSkyTimePhase({ now: sunsetAt + SUNSET_GRACE_MS, sunsetAt }), "afterglow");
  assert.equal(getSkyTimePhase({ now: sunsetAt + AFTERGLOW_AFTER_SUNSET_MS, sunsetAt }), "night");
});

test("uses the current Asheville day's solar times", () => {
  const daily = [
    { sunrise: Date.parse("2026-06-27T10:15:00Z"), sunset: Date.parse("2026-06-28T00:48:00Z") },
    { sunrise: Date.parse("2026-06-28T10:16:00Z"), sunset: Date.parse("2026-06-29T00:48:00Z") }
  ];
  const times = findTodaySolarTimes(daily, Date.parse("2026-06-28T00:56:00Z"));
  assert.equal(times.sunsetAt, daily[0].sunset);
});

test("builds conservative cloud-aware sunset wording", () => {
  assert.equal(
    buildDuskSkyFallback({ cloudCover: 0.48, phase: "afterglow" }).headline,
    "The western sky is moving from twilight into night."
  );
  assert.equal(
    buildDuskSkyFallback({ cloudCover: 78, phase: "afterglow" }).headline,
    "The remaining twilight is fading behind mostly cloudy skies."
  );
});

test("uses one radiance gate for homepage and Sunset Radiance", () => {
  const inputs = {
    cameraCloud: 0.32,
    forecastCloud: 0.48,
    precipProbability: 0.2,
    sunlightDetected: true
  };
  assert.equal(evaluateSunsetSky(inputs).radianceVetted, true);
  assert.equal(buildDuskSkyFallback({ ...inputs, phase: "afterglow" }).radianceVetted, true);
  assert.equal(evaluateSunsetSky({ ...inputs, forecastCloud: 0.72 }).radianceVetted, false);
  assert.equal(evaluateSunsetSky({ ...inputs, precipProbability: 0.45 }).radianceVetted, false);
  assert.equal(evaluateSunsetSky({ ...inputs, obscured: true }).radianceVetted, false);
});

test("sunset promotion requires timing, useful cloud texture, and vetted light", () => {
  const sunsetAt = Date.parse("2026-08-24T00:10:00Z");
  const favorable = {
    now: sunsetAt - 90 * 60 * 1000,
    sunsetAt,
    cameraCloud: 0.32,
    forecastCloud: 0.4,
    precipProbability: 0.1,
    sunlightDetected: true,
    confidence: 0.78
  };

  assert.equal(evaluateSunsetPromotion(favorable).active, true);
  assert.equal(evaluateSunsetPromotion({ ...favorable, now: sunsetAt - 3 * 60 * 60 * 1000 }).active, false);
  assert.equal(evaluateSunsetPromotion({ ...favorable, cameraCloud: 0.05, forecastCloud: 0.05 }).active, false);
  assert.equal(evaluateSunsetPromotion({ ...favorable, forecastCloud: 0.72 }).active, false);
  assert.equal(evaluateSunsetPromotion({ ...favorable, precipProbability: 0.5 }).active, false);
});
