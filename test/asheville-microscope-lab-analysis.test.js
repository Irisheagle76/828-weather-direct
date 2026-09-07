import test from "node:test";
import assert from "node:assert/strict";
import {
  analyzeMesonet,
  haversineMiles,
  robustElevationSlope,
  summarizeMetric
} from "../public/js/asheville-microscope-lab-analysis.js";

const observedAt = "2026-09-05T20:00:00.000Z";

function station(id, overrides = {}) {
  return {
    id,
    name: overrides.name ?? id,
    area: overrides.area ?? "Asheville",
    location: overrides.location ?? { latitude: 35.6, longitude: -82.55, precision: "site" },
    elevationFt: overrides.elevationFt ?? 2200,
    exposure: overrides.exposure ?? "Open",
    provider: "fixture",
    scope: overrides.scope ?? "core",
    quality: { usable: true, freshness: "fresh", flags: [] },
    observation: {
      observedAt,
      temperatureF: overrides.temperatureF ?? 70,
      dewPointF: overrides.dewPointF ?? 55,
      windMph: overrides.windMph ?? 3,
      windGustMph: overrides.windGustMph ?? 6,
      precipitationRateInHr: overrides.precipitationRateInHr ?? 0,
      precipitationTodayIn: overrides.precipitationTodayIn ?? 0,
      seaLevelPressureMb: overrides.seaLevelPressureMb ?? 1015,
      solarRadiationWm2: overrides.solarRadiationWm2 ?? 400
    }
  };
}

test("metric summary uses robust median, IQR, and MAD", () => {
  const stations = [60, 61, 62, 63, 90].map((temperatureF, index) => station(String(index), { temperatureF }));
  const summary = summarizeMetric(stations, "temperatureF");
  assert.equal(summary.count, 5);
  assert.equal(summary.median, 62);
  assert.equal(summary.iqr, 2);
  assert.equal(summary.mad, 1);
  assert.equal(summary.spread, 30);
  assert.equal(summary.maximumStation.stationId, "4");
});

test("Theil-Sen elevation slope classifies an inversion without one outlier taking control", () => {
  const stations = [
    station("valley-a", { elevationFt: 2000, temperatureF: 40 }),
    station("valley-b", { elevationFt: 2100, temperatureF: 41 }),
    station("slope-a", { elevationFt: 2500, temperatureF: 45 }),
    station("ridge", { elevationFt: 3000, temperatureF: 50 }),
    station("bad", { elevationFt: 2800, temperatureF: 90 })
  ];
  const result = robustElevationSlope(stations);
  assert.ok(result.slopePer1000Ft > 8);
  assert.equal(result.sampleCount, 5);
});

test("pair distance uses station coordinates", () => {
  const first = station("a", { location: { latitude: 35.595, longitude: -82.552 } });
  const second = station("b", { location: { latitude: 35.615, longitude: -82.552 } });
  const miles = haversineMiles(first, second);
  assert.ok(miles > 1.3 && miles < 1.5);
});

test("network analysis ranks current anomalies and isolates a one-station rain signal", () => {
  const stations = [
    station("cool", { name: "Cool Valley", temperatureF: 60, elevationFt: 2000, location: { latitude: 35.58, longitude: -82.57 } }),
    station("middle-a", { temperatureF: 70, elevationFt: 2200, location: { latitude: 35.60, longitude: -82.55 } }),
    station("middle-b", { temperatureF: 71, elevationFt: 2300, location: { latitude: 35.61, longitude: -82.54 } }),
    station("warm", { name: "Warm Ridge", temperatureF: 82, elevationFt: 2500, precipitationRateInHr: 1.2, precipitationTodayIn: 2.1, location: { latitude: 35.63, longitude: -82.51 } }),
    station("normal", { temperatureF: 70.5, elevationFt: 2250, location: { latitude: 35.59, longitude: -82.56 } }),
    station("normal-two", { temperatureF: 70.2, elevationFt: 2275, location: { latitude: 35.57, longitude: -82.54 } })
  ];
  const payload = { generatedAt: observedAt, network: { stationCount: 6 }, stations };
  const analysis = analyzeMesonet(payload);
  assert.equal(analysis.reportingCount, 6);
  assert.equal(analysis.statistics.temperature.spread, 22);
  assert.equal(analysis.rain.wetStationCount, 1);
  assert.equal(analysis.rain.localized, true);
  assert.equal(analysis.rain.clusters[0].confidence, "low");
  assert.ok(analysis.anomalies.some((item) => item.stationId === "warm" && item.metric === "temperature"));
  assert.equal(analysis.agreement.publicCategory, "One Asheville story");
  assert.equal(analysis.agreement.localContrast, "Very strong");
  assert.match(analysis.agreement.eventExplanation, /rain/i);
  assert.equal(analysis.insights.length, 3);
});
