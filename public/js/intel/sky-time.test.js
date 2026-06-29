import test from "node:test";
import assert from "node:assert/strict";
import {
  buildDuskSkyFallback,
  findTodaySolarTimes,
  getSkyTimePhase,
  TWILIGHT_AFTER_SUNSET_MS
} from "./sky-time.js";

test("keeps the sky in dusk mode throughout civil twilight", () => {
  const sunsetAt = Date.parse("2026-06-28T00:48:00Z");
  assert.equal(getSkyTimePhase({ now: sunsetAt + 8 * 60 * 1000, sunsetAt }), "dusk");
  assert.equal(getSkyTimePhase({ now: sunsetAt + TWILIGHT_AFTER_SUNSET_MS, sunsetAt }), "night");
});

test("uses the current Asheville day's solar times", () => {
  const daily = [
    { sunrise: Date.parse("2026-06-27T10:15:00Z"), sunset: Date.parse("2026-06-28T00:48:00Z") },
    { sunrise: Date.parse("2026-06-28T10:16:00Z"), sunset: Date.parse("2026-06-29T00:48:00Z") }
  ];
  const times = findTodaySolarTimes(daily, Date.parse("2026-06-28T00:56:00Z"));
  assert.equal(times.sunsetAt, daily[0].sunset);
});

test("builds cloud-aware dusk wording", () => {
  assert.equal(
    buildDuskSkyFallback({ cloudCover: 0.48 }).headline,
    "Partly cloudy skies as dusk settles in."
  );
  assert.equal(
    buildDuskSkyFallback({ cloudCover: 78 }).headline,
    "Mostly cloudy skies as dusk settles in."
  );
});
