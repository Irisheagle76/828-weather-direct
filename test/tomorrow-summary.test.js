import assert from "node:assert/strict";
import test from "node:test";

import { ashevilleDailyNormals } from "../public/js/intel/asheville-normals.js";
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
  assert.match(summary.headline, /welcome relief/);
  assert.match(summary.narrative, /drier air works in/i);
  assert.match(summary.narrative, /Mostly sunny/i);
  assert.match(summary.narrative, /Breezy at times/i);
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

  assert.match(summary.headline, /Warm and muggy again/);
  assert.match(summary.narrative, /stays muggy/i);
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

  assert.match(summary.headline, /Scattered showers/);
  assert.match(summary.narrative, /showers may pop up/i);
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
  assert.match(summary.narrative, /Rain is unlikely/i);
});

test("changeable weather uses Tim's direct, condition-first voice", () => {
  const hours = hoursFrom(Array.from({ length: 24 }, (_, hour) => ({
    temp: hour < 8 ? 65 : hour < 18 ? 79 : 72,
    dew: 66,
    rh: 68,
    wind: 6,
    cloud: 0.48,
    rain: 0.34,
    score: 73
  })));

  const summary = buildTomorrowSummary(hours, { tempMin: 65, tempMax: 79 });

  assert.equal(summary.headline, "Not a washout, but keep an eye out for a passing shower.");
  assert.match(summary.narrative, /Starting near 65°/);
  assert.match(summary.narrative, /You will notice some humidity/);
  assert.match(summary.narrative, /Expect a mix of sun and clouds with a light breeze/);
  assert.match(summary.narrative, /Most of the day should stay dry/);
  assert.doesNotMatch(summary.narrative, /trade places|cannot be ruled out|adds a little movement|defining feature/i);
});

test("the daily narrative never runs longer than four sentences", () => {
  const scenarios = [
    { dew: 58, wind: 3, cloud: 0.15, rain: 0.05, score: 84 },
    { dew: 66, wind: 6, cloud: 0.48, rain: 0.34, score: 73 },
    { dew: 69, wind: 14, cloud: 0.82, rain: 0.62, score: 60 }
  ];

  for (const scenario of scenarios) {
    const hours = hoursFrom(Array.from({ length: 24 }, (_, hour) => ({
      temp: hour < 8 ? 65 : 82,
      rh: 70,
      ...scenario
    })));
    const summary = buildTomorrowSummary(hours, { tempMin: 65, tempMax: 82 });
    const sentences = summary.narrative.match(/[^.!?]+[.!?]+/g) || [];

    assert.ok(sentences.length <= 4, `${sentences.length} sentences: ${summary.narrative}`);
  }
});

test("NOAA daily normals resolve for Asheville by calendar date", () => {
  assert.deepEqual(ashevilleDailyNormals("2026-08-05"), {
    high: 84.8,
    low: 65,
    period: "1991-2020",
    station: "Asheville Regional Airport (USW00003812)"
  });
});

test("a high at least ten degrees from normal adds seasonal context", () => {
  const hours = hoursFrom(Array.from({ length: 24 }, (_, hour) => ({
    temp: hour < 8 ? 65 : 95,
    dew: 59,
    rh: 48,
    wind: 4,
    cloud: 0.2,
    rain: 0.05,
    score: 58
  })));
  const summary = buildTomorrowSummary(
    hours,
    { date: "2026-08-05", tempMin: 65, tempMax: 95 },
    {},
    { normals: { high: 84.8, low: 65, period: "1991-2020" } }
  );

  assert.match(summary.narrative, /about 10° above average for the date/i);
  assert.equal(summary.diagnostics.highDeparture, 10.2);
  assert.equal(summary.diagnostics.normalHigh, 84.8);
  assert.equal((summary.narrative.match(/[^.!?]+[.!?]+/g) || []).length, 4);
});

test("near-average temperatures do not spend space on climate context", () => {
  const hours = hoursFrom(Array.from({ length: 24 }, (_, hour) => ({
    temp: hour < 8 ? 65 : 94,
    dew: 59,
    rh: 48,
    wind: 4,
    cloud: 0.2,
    rain: 0.05,
    score: 60
  })));
  const summary = buildTomorrowSummary(
    hours,
    { date: "2026-08-05", tempMin: 65, tempMax: 94 },
    {},
    { normals: { high: 84.8, low: 65, period: "1991-2020" } }
  );

  assert.doesNotMatch(summary.narrative, /above average|below average/i);
});
