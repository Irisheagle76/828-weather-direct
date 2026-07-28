import assert from "node:assert/strict";
import test from "node:test";

import { buildTomorrowSummary } from "../public/js/intel/tomorrow-summary.js";

function hoursFrom(values) {
  return values.map((value, hour) => ({
    timestamp: Date.parse(`2026-07-29T${String(hour).padStart(2, "0")}:00:00-04:00`),
    temperatureF: value.temp,
    dewpointF: value.dew,
    relativeHumidity: value.rh,
    windSpeed: value.wind,
    cloudCover: value.cloud,
    precipProbability: value.rain,
    comfortScore: value.score
  }));
}

test("a humid midnight does not label a drying post-frontal day as muggy", () => {
  const hours = hoursFrom(Array.from({ length: 24 }, (_, hour) => ({
    temp: hour < 8 ? 68 : hour < 18 ? 78 : 70,
    dew: hour < 5 ? 69 : hour < 11 ? 66 : hour < 19 ? 61 : 57,
    rh: hour < 8 ? 92 : hour < 12 ? 75 : 54,
    wind: hour < 8 ? 4 : 13,
    cloud: 0.18,
    rain: 0.04,
    score: hour < 8 ? 82 : 72
  })));

  const summary = buildTomorrowSummary(hours, {
    tempMin: 67,
    tempMax: 80,
    precipProbability: 0.04
  });

  assert.equal(summary.score, 72);
  assert.match(summary.headline, /Humidity backs off/);
  assert.match(summary.narrative, /humid start should not last/i);
  assert.match(summary.narrative, /steady breeze/i);
  assert.match(summary.narrative, /sunshine has plenty of room/i);
  assert.doesNotMatch(summary.headline, /muggy/i);
  assert.ok(summary.diagnostics.afternoonDew < 65);
  assert.equal(summary.diagnostics.scoreWindow, "8 AM-8 PM");
});

test("sustained afternoon dew points still produce an honestly muggy narrative", () => {
  const hours = hoursFrom(Array.from({ length: 24 }, (_, hour) => ({
    temp: hour < 8 ? 72 : 86,
    dew: 69,
    rh: 72,
    wind: 5,
    cloud: 0.45,
    rain: 0.12,
    score: 63
  })));

  const summary = buildTomorrowSummary(hours, { tempMin: 71, tempMax: 87 });

  assert.match(summary.headline, /Warm, muggy air/);
  assert.match(summary.narrative, /distinctly muggy edge/i);
});

test("rain remains the lead when it is the clearest daytime disruption", () => {
  const hours = hoursFrom(Array.from({ length: 24 }, (_, hour) => ({
    temp: hour < 8 ? 64 : 74,
    dew: 58,
    rh: 58,
    wind: 7,
    cloud: 0.8,
    rain: hour >= 12 && hour <= 17 ? 0.65 : 0.2,
    score: 70
  })));

  const summary = buildTomorrowSummary(hours, { tempMin: 63, tempMax: 75 });

  assert.match(summary.headline, /Showers may interrupt/);
  assert.match(summary.narrative, /meaningful interruption/i);
});

test("an overnight shower does not dominate an otherwise dry daytime card", () => {
  const hours = hoursFrom(Array.from({ length: 24 }, (_, hour) => ({
    temp: hour < 8 ? 61 : 75,
    dew: 57,
    rh: 60,
    wind: 6,
    cloud: 0.25,
    rain: hour < 4 ? 0.75 : 0.08,
    score: 82
  })));

  const summary = buildTomorrowSummary(hours, { tempMin: 60, tempMax: 76 });

  assert.equal(summary.rainChance, 0.08);
  assert.doesNotMatch(summary.headline, /Showers/);
  assert.match(summary.narrative, /rain offers little interference/i);
});
