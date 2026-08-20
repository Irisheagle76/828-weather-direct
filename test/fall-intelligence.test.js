import test from "node:test";
import assert from "node:assert/strict";
import { leafDropRisk, ratingForScore, scoreFallHours } from "../public/js/fall/scoring.js";
import { buildElevationAnalysis } from "../public/js/fall/elevation.js";

const at = (hour) => new Date(2026, 9, 10, hour).getTime();
const pleasant = Array.from({ length: 12 }, (_, index) => ({ timestamp: at(8 + index), temperatureF: 62, dewpointF: 45, precipProbability: 0.05, precipitation: 0, cloudCover: 0.25, windSpeed: 6, windGust: 11 }));

test("fall score rewards dry, partly clear, light-wind daylight", () => {
  const result = scoreFallHours(pleasant);
  assert.ok(result.score >= 80);
  assert.match(result.rating, /Excellent|Exceptional/);
  assert.equal(ratingForScore(44), "Poor");
  assert.equal(ratingForScore(70), "Very Good");
});

test("fall score refuses to invent guidance from missing hours", () => {
  const result = scoreFallHours([]);
  assert.equal(result.available, false);
  assert.equal(result.score, null);
  assert.equal(result.rating, "Unavailable");
});

test("leaf drop risk responds to gusts and rain", () => {
  assert.equal(leafDropRisk(pleasant).category, "Low");
  const harsh = pleasant.map((hour) => ({ ...hour, windSpeed: 24, windGust: 43, precipitation: 0.08 }));
  assert.match(leafDropRisk(harsh).category, /High/);
});

test("elevation analysis flags a radiational cold-pool setup without forcing a linear lapse rate", () => {
  const night = (temperatureF, windSpeed = 2) => [0, 1, 2, 3, 4, 5, 6].map((h) => ({ timestamp: at(h), temperatureF, dewpointF: temperatureF - 7, cloudCover: 0.1, windSpeed }));
  const result = buildElevationAnalysis([
    { id: "asheville", elevationFeet: 2134, hourly: night(31) },
    { id: "pisgah", elevationFeet: 5721, hourly: night(34, 9) },
    { id: "mitchell", elevationFeet: 6684, hourly: night(29, 14) }
  ], { now: at(0) });
  assert.equal(result.coldPoolRisk, true);
  assert.equal(result.bands.find((band) => band.id === "asheville-valley").temperatureF, 31);
  assert.equal(result.thresholds.temp32.reached, true);
});

test("elevation analysis with valley and summit cold pockets refuses one false threshold", () => {
  const night = (temperatureF) => [0, 1, 2, 3, 4, 5, 6].map((h) => ({ timestamp: at(h), temperatureF, dewpointF: temperatureF - 5, cloudCover: 0.6, windSpeed: 7 }));
  const result = buildElevationAnalysis([
    { id: "asheville", elevationFeet: 2134, hourly: night(31) },
    { id: "mid", elevationFeet: 4000, hourly: night(37) },
    { id: "summit", elevationFeet: 6500, hourly: night(29) }
  ], { now: at(0) });
  assert.equal(result.thresholds.temp32.ambiguous, true);
  assert.equal(result.thresholds.temp32.range, null);
  assert.equal(result.thresholds.temp32.ranges.length, 2);
});

test("fresh observations diagnose a nighttime inversion without changing public forecast guidance", () => {
  const night = (temperatureF) => [0, 1, 2, 3, 4, 5, 6].map((h) => ({ timestamp: at(h), temperatureF, dewpointF: temperatureF - 2, cloudCover: 0.8, windSpeed: 8 }));
  const result = buildElevationAnalysis([
    { id: "asheville", elevationFeet: 2134, hourly: night(44) },
    { id: "pisgah", elevationFeet: 5721, hourly: night(39) },
    { id: "mitchell", elevationFeet: 6684, hourly: night(36) }
  ], {
    now: at(0),
    observations: { anchors: [
      { destinationId: "asheville", temperatureF: 31, windMph: 1 },
      { destinationId: "waynesville", temperatureF: 30, windMph: 1 },
      { destinationId: "black-mountain", temperatureF: 32, windMph: 2 },
      { destinationId: "pisgah", temperatureF: 35, windMph: 7 }
    ] }
  });
  assert.equal(result.forecastColdPoolRisk, false);
  assert.equal(result.observedColdPoolSignal, true);
  assert.equal(result.coldPoolRisk, false);
});
