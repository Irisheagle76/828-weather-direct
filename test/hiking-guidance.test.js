import assert from "node:assert/strict";
import test from "node:test";
import { analyzeHikingStations } from "../lib/hiking/guidance.js";

test("recalculates hiking guidance from the current station temperatures", () => {
  const stations = [
    station("tempest-144737", 2137, 72, 65),
    station("tempest-127602", 2316, 70, 64),
    station("windy-ridge-trail", 3209, 68, 61, "wunderground"),
    station("webb-weather", 3000, 66, 60, "wunderground"),
    station("mount-mitchell", 6215, 55, 45, "econet")
  ];

  const guidance = analyzeHikingStations(stations, { now: Date.parse("2026-08-31T14:00:00Z") });

  assert.equal(guidance.localTempSpread, 6);
  assert.equal(guidance.highStationSpread, 2);
  assert.equal(guidance.mitchellDrop, 14);
  assert.match(guidance.hikerNarrative, /Mount Mitchell is about 14degF cooler/);
});

test("uses recent live lightning in the recomputed guidance", () => {
  const current = station("tempest-144737", 2137, 72, 65);
  current.lightningStrikes1h = 1;
  const guidance = analyzeHikingStations([current], { now: Date.parse("2026-08-31T14:00:00Z") });

  assert.equal(guidance.lightning.active, true);
  assert.equal(guidance.hikerScoreLabel, "Alert");
});

function station(id, elevationFt, temperatureF, dewPointF, provider = "tempest") {
  return {
    id,
    provider,
    name: id,
    elevationFt,
    temperatureF,
    dewPointF,
    humidityPct: 70,
    windMph: 2,
    gustMph: 4,
    uv: 2,
    solarWm2: 200,
    rainTodayIn: 0,
    rainRateInHr: 0,
    lightningStrikes1h: 0,
    lightningStrikes3h: 0
  };
}

test("pleasant Asheville hiking does not stack regional extremes or sun penalties", () => {
  const local = [
    { ...station("tempest-144737", 2137, 74.3, 59.5), uv: 5.68, solarWm2: 729 },
    { ...station("tempest-127602", 2316, 72, 56), uv: 6, solarWm2: 754 },
    { ...station("windy-ridge-trail", 3209, 75, 59, "wunderground"), uv: 6, solarWm2: 725 },
    { ...station("webb-weather", 3000, 64, 57, "wunderground"), uv: 0, solarWm2: 37 }
  ];
  const regional = [
    { ...station("mount-mitchell", 6215, 54.1, 42.7, "econet"), gustMph: 37 },
    station("max-patch", 4420, 56.7, 56.3, "wunderground"),
    { ...station("tempest-104977", 3284, 74, 51), uv: 10, solarWm2: 1284 }
  ];
  const guidance = analyzeHikingStations([...local, ...regional]);
  assert.equal(guidance.hikerScore, 80);
  assert.equal(guidance.hikerScoreLabel, "Good");
  assert.equal(guidance.hikerScore, analyzeHikingStations(local).hikerScore);
  assert.deepEqual(guidance.hikerScoreFactors.map((f) => f.label), ["Fog or damp trail risk", "Sun exposure"]);
  assert.match(guidance.hikerNarrative, /^Good for Asheville-area hikes/);
  assert.match(guidance.routeWarnings.join(" "), /mount-mitchell.*37 mph/);
  assert.match(guidance.routeWarnings.join(" "), /max-patch.*near-saturated/);
});

test("local heat, rain and wind lower the score and the narrative agrees", () => {
  const guidance = analyzeHikingStations([{
    ...station("tempest-144737", 2137, 95, 94),
    wbgtF: 90, gustMph: 40, uv: 10, solarWm2: 1200,
    rainRateInHr: 0.2, rainTodayIn: 2
  }]);
  assert.ok(guidance.hikerScore < 55);
  assert.equal(guidance.hikerScoreLabel, "Use care");
  assert.match(guidance.hikerNarrative, /^Use care/);
  assert.doesNotMatch(guidance.bestWindow, /friendly|Good overall/);
});

test("regional lightning still overrides pleasant local conditions", () => {
  const guidance = analyzeHikingStations([
    station("tempest-144737", 2137, 72, 50),
    { ...station("tempest-104977", 3284, 70, 50), lightningStrikes1h: 1 }
  ]);
  assert.equal(guidance.hikerScoreLabel, "Alert");
  assert.match(guidance.hikerNarrative, /avoid exposed/);
});

test("regional fallback discloses the score scope when Asheville is unavailable", () => {
  const guidance = analyzeHikingStations([station("mount-mitchell", 6215, 55, 40, "econet")]);
  assert.equal(guidance.scoreScope, "Available regional observations");
  assert.match(guidance.overall, /available regional observations/);
});

test("unusable observations cannot lower the score or invent a current assessment", () => {
  const local = station("tempest-144737", 2137, 72, 50);
  const stale = { ...station("max-patch", 4420, 55, 55), gustMph: 60, health: { usable: false } };
  const guidance = analyzeHikingStations([local, stale]);
  assert.equal(guidance.hikerScore, analyzeHikingStations([local]).hikerScore);
  assert.equal(guidance.routeWarnings.length, 0);
  const empty = analyzeHikingStations([stale]);
  assert.equal(empty.hikerScore, null);
  assert.equal(empty.hikerScoreLabel, "Unavailable");
  assert.match(empty.overall, /unavailable/);
});
