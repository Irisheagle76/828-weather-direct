import test from "node:test";
import assert from "node:assert/strict";

import {
  aggregateBasinRainfall,
  buildRainfallWindows,
  mrmsMillimetersToInches,
  parseUSGSContinuousValues,
  parseUSGSObservationNormals
} from "../lib/water/liveConditions.js";
import { WATERFALL_BASINS } from "../lib/water/waterfallBasins.js";

test("raw MRMS liquid accumulation is converted from millimeters to inches", () => {
  assert.equal(mrmsMillimetersToInches(25.4), 1);
  assert.equal(mrmsMillimetersToInches(12.7), 0.5);
});

test("hourly precipitation is accumulated into rolling windows", () => {
  const now = Date.parse("2026-07-30T20:00:00Z");
  const times = [
    now / 1000 - 2 * 3600,
    now / 1000 - 12 * 3600,
    now / 1000 - 48 * 3600,
    now / 1000 - 120 * 3600,
    now / 1000 - 240 * 3600
  ];
  const result = buildRainfallWindows(times, [0.2, 0.3, 0.5, 0.7, 0.9], now);
  assert.equal(result.rain6h, 0.2);
  assert.equal(result.rain24h, 0.5);
  assert.equal(result.rain3d, 1);
  assert.equal(result.rain7d, 1.7);
  assert.equal(result.rain14d, 2.6);
});

test("basin rainfall favors the area-wide signal without losing a localized wet core", () => {
  const samples = [
    { rain6h: 0.1, rain24h: 0.4, rain3d: 1, observedThrough: "2026-07-30T20:00:00Z" },
    { rain6h: 0.1, rain24h: 0.5, rain3d: 1.1, observedThrough: "2026-07-30T20:00:00Z" },
    { rain6h: 0.2, rain24h: 0.6, rain3d: 1.2, observedThrough: "2026-07-30T20:00:00Z" },
    { rain6h: 1.4, rain24h: 2.5, rain3d: 3.5, observedThrough: "2026-07-30T20:00:00Z" }
  ];
  const result = aggregateBasinRainfall(samples, {
    comid: 123,
    drainageAreaSqMi: 10,
    sampleCount: 4
  }, ["rain6h", "rain24h", "rain3d"]);

  assert.equal(result.available, true);
  assert.equal(result.rain3d, 1.71);
  assert.equal(result.basin.windows.rain3d.mean, 1.7);
  assert.equal(result.basin.windows.rain3d.wetCore, 1.78);
  assert.equal(result.basin.windows.rain3d.maximum, 3.5);
});

test("basin rainfall is withheld when too much of the footprint is missing", () => {
  const result = aggregateBasinRainfall([
    { rain6h: 0.1, rain24h: 0.2, rain3d: 0.3 },
    { rain6h: 0.2, rain24h: 0.3, rain3d: 0.4 }
  ], { sampleCount: 8 });
  assert.equal(result.available, false);
  assert.equal(result.rain3d, null);
});

test("every waterfall has a distributed upstream-basin footprint", () => {
  const footprints = Object.values(WATERFALL_BASINS);
  assert.equal(footprints.length, 9);
  assert.ok(footprints.every((basin) => basin.comid && basin.drainageAreaSqMi > 0));
  assert.ok(footprints.every((basin) => basin.samplePoints.length >= 4));
  assert.ok(footprints.reduce((sum, basin) => sum + basin.samplePoints.length, 0) >= 90);
});

test("USGS parser chooses the latest reading and calculates a 12-hour trend", () => {
  const now = Date.parse("2026-07-30T20:00:00Z");
  const payload = {
    features: [
      {
        properties: {
          monitoring_location_id: "USGS-12345678",
          parameter_code: "00060",
          value: "100",
          unit_of_measure: "ft^3/s",
          time: "2026-07-30T08:00:00Z"
        }
      },
      {
        properties: {
          monitoring_location_id: "USGS-12345678",
          parameter_code: "00060",
          value: "150",
          unit_of_measure: "ft^3/s",
          time: "2026-07-30T20:00:00Z"
        }
      }
    ]
  };
  const result = parseUSGSContinuousValues(payload, now);
  assert.equal(result["12345678"].dischargeCfs, 150);
  assert.equal(result["12345678"].trend12hPct, 50);
});

test("USGS observation normals choose the median of daily mean discharge", () => {
  const result = parseUSGSObservationNormals({
    features: [{
      properties: {
        monitoring_location_id: "USGS-12345678",
        data: [
          {
            parameter_code: "00060",
            parent_statistic_id: "00001",
            values: [{ computation: "median", value: "110", sample_count: 15 }]
          },
          {
            parameter_code: "00060",
            parent_statistic_id: "00003",
            values: [{ computation: "median", value: "125", sample_count: 80 }]
          }
        ]
      }
    }]
  });

  assert.equal(result["12345678"].normalMedianCfs, 125);
  assert.equal(result["12345678"].normalSampleCount, 80);
});
