import assert from "node:assert/strict";
import test from "node:test";
import { analyzeHikingStations } from "../lib/hiking/guidance.js";

test("recalculates hiking guidance from the current station temperatures", () => {
  const stations = [
    station("tempest-144737", 2137, 72, 65),
    station("tempest-127602", 2316, 70, 64),
    station("tempest-160562", 3363, 68, 61),
    station("tempest-157700", 3371, 66, 60),
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
