import test from "node:test";
import assert from "node:assert/strict";
import { normalizeFallObservations } from "../lib/fall/observations.js";

const NOW = Date.parse("2026-10-10T02:00:00Z");
const destinations = [
  { id: "waynesville", hourly: [{ timestamp: NOW, temperatureF: 39 }] },
  { id: "black-mountain", hourly: [{ timestamp: NOW, temperatureF: 41 }] },
  { id: "graveyard", elevationFeet: 5120, hourly: [{ timestamp: NOW, temperatureF: 40 }] },
  { id: "mitchell", elevationFeet: 6684, hourly: [{ timestamp: NOW, temperatureF: 30 }] },
  { id: "craggy", elevationFeet: 5892, hourly: [{ timestamp: NOW, temperatureF: 32 }] }
];

test("normalizes fresh Waynesville and Black Mountain valley anchors", () => {
  const observations = normalizeFallObservations({
    generatedAt: new Date(NOW - 5 * 60000).toISOString(),
    stations: [
      station("lake-junaluska", "KNCLAKEJ3", "Lake Junaluska", 2657, 37),
      station("wallace-mountain", "KNCBLACK209", "Wallace Mountain", 2625, 40)
    ]
  }, destinations, { now: NOW });

  assert.equal(observations.status, "partial");
  assert.equal(observations.availableAnchors, 2);
  assert.equal(observations.anchors[0].destinationId, "waynesville");
  assert.equal(observations.anchors[0].temperatureResidualF, -2);
  assert.equal(observations.anchors[1].elevationFeet, 2625);
});

test("rejects stale observations instead of treating them as ground truth", () => {
  const stale = station("lake-junaluska", "KNCLAKEJ3", "Lake Junaluska", 2657, 37);
  stale.observedAt = new Date(NOW - 2 * 60 * 60000).toISOString();
  const observations = normalizeFallObservations({ generatedAt: stale.observedAt, stations: [stale] }, destinations, { now: NOW });
  assert.equal(observations.status, "stale");
  assert.equal(observations.availableAnchors, 0);
  assert.equal(observations.rejected[0].reason, "stale-or-not-live");
});

test("uses a low-weight elevation-adjusted comparison for a sheltered Pisgah approach station", () => {
  const observations = normalizeFallObservations({
    generatedAt: new Date(NOW - 5 * 60000).toISOString(),
    stations: [station("camp-daniel-boone", "KNCCANTO127", "Camp Daniel Boone", 3257, 44)]
  }, destinations, { now: NOW });
  const anchor = observations.anchors[0];
  assert.equal(anchor.destinationId, "graveyard");
  assert.equal(anchor.terrainRole, "sheltered-mid-elevation");
  assert.equal(anchor.comparisonMethod, "elevation-adjusted");
  assert.equal(anchor.forecastTemperatureF, 46.5);
  assert.equal(anchor.temperatureResidualF, -2.5);
  assert.equal(anchor.weight, 0.35);
  assert.equal(anchor.sitingConfidence, "low");
});

test("uses the forested Mount Mitchell east-slope station as a reduced-weight supporting anchor", () => {
  const observations = normalizeFallObservations({
    generatedAt: new Date(NOW - 5 * 60000).toISOString(),
    stations: [station("alpine-village", "KNCBURNS167", "Alpine Village", 3260, 40)]
  }, destinations, { now: NOW });
  const anchor = observations.anchors[0];
  assert.equal(anchor.destinationId, "mitchell");
  assert.equal(anchor.terrainRole, "forested-east-slope");
  assert.equal(anchor.comparisonMethod, "elevation-adjusted");
  assert.equal(anchor.forecastTemperatureF, 42);
  assert.equal(anchor.temperatureResidualF, -2);
  assert.equal(anchor.weight, 0.5);
  assert.equal(anchor.sitingConfidence, "medium-low");
  assert.match(anchor.sitingNote, /South Toe River/);
});

test("uses the western Pisgah high-shoulder station with more weight than lower approach references", () => {
  const observations = normalizeFallObservations({
    generatedAt: new Date(NOW - 5 * 60000).toISOString(),
    stations: [station("park-place", "KNCWAYNE323", "Park Place", 4209, 42)]
  }, destinations, { now: NOW });
  const anchor = observations.anchors[0];
  assert.equal(anchor.destinationId, "graveyard");
  assert.equal(anchor.terrainRole, "western-pisgah-high-shoulder");
  assert.equal(anchor.comparisonMethod, "elevation-adjusted");
  assert.equal(anchor.forecastTemperatureF, 43.2);
  assert.equal(anchor.temperatureResidualF, -1.2);
  assert.equal(anchor.weight, 0.6);
  assert.equal(anchor.sitingConfidence, "low");
  assert.match(anchor.sitingNote, /exposure.*unverified/i);
});

test("uses Barnardsville as a reduced-weight Craggy north-flank reference", () => {
  const observations = normalizeFallObservations({
    generatedAt: new Date(NOW - 5 * 60000).toISOString(),
    stations: [station("barnardsville-craggy-north-flank", "KNCBARNA15", "Barnardsville / Craggy North Flank", 3052, 40)]
  }, destinations, { now: NOW });
  const anchor = observations.anchors[0];
  assert.equal(anchor.destinationId, "craggy");
  assert.equal(anchor.terrainRole, "craggy-north-flank");
  assert.equal(anchor.comparisonMethod, "elevation-adjusted");
  assert.equal(anchor.forecastTemperatureF, 41.9);
  assert.equal(anchor.temperatureResidualF, -1.9);
  assert.equal(anchor.weight, 0.4);
  assert.match(anchor.sitingNote, /wind.*not treated.*ridge/i);
});

test("normalizes the selected northern high-country and Craggy flank observations without double-counting runway sensors", () => {
  const observations = normalizeFallObservations({
    generatedAt: new Date(NOW - 5 * 60000).toISOString(),
    stations: [
      station("burnsville-northern-high-country", "KNCBURNS99", "Burnsville Northern High Country", 5330, 34),
      station("laurel-ridge-craggy-south-flank", "KNCBLACK183", "Laurel Ridge / Craggy South Flank", 3501, 40),
      station("mountain-air-ridge-composite", "KNCBURNS29+KNCBURNS30", "Mountain Air Ridge Composite", 4375, 38)
    ]
  }, destinations, { now: NOW });
  const [burnsville, laurel, mountainAir] = observations.anchors;
  assert.equal(burnsville.destinationId, "mitchell");
  assert.equal(burnsville.weight, 0.75);
  assert.equal(laurel.destinationId, "craggy");
  assert.equal(laurel.weight, 0.5);
  assert.equal(mountainAir.terrainRole, "regional-exposed-ridge");
  assert.equal(mountainAir.stationId, "KNCBURNS29+KNCBURNS30");
  assert.equal(mountainAir.weight, 0.7);
  assert.equal(observations.availableAnchors, 3);
});

function station(id, stationId, name, elevationFt, temperatureF) {
  return {
    id,
    stationId,
    name,
    elevationFt,
    status: "live",
    observedAt: new Date(NOW - 4 * 60000).toISOString(),
    temperatureF,
    dewPointF: temperatureF - 3,
    humidityPct: 88,
    windMph: 1,
    gustMph: 2,
    source: "Weather Underground"
  };
}
