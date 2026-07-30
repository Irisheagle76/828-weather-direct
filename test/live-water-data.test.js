import test from "node:test";
import assert from "node:assert/strict";

import {
  buildRainfallWindows,
  mrmsMillimetersToInches,
  parseUSGSInstantaneousValues
} from "../lib/water/liveConditions.js";

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

test("USGS parser chooses the latest reading and calculates a 12-hour trend", () => {
  const now = Date.parse("2026-07-30T20:00:00Z");
  const payload = {
    value: {
      timeSeries: [{
        sourceInfo: { siteCode: [{ value: "12345678" }] },
        variable: { variableCode: [{ value: "00060" }] },
        values: [{
          value: [
            { value: "100", dateTime: "2026-07-30T08:00:00Z" },
            { value: "150", dateTime: "2026-07-30T20:00:00Z" }
          ]
        }]
      }]
    }
  };
  const result = parseUSGSInstantaneousValues(payload, now);
  assert.equal(result["12345678"].dischargeCfs, 150);
  assert.equal(result["12345678"].trend12hPct, 50);
});
