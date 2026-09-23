import test from "node:test";
import assert from "node:assert/strict";
import { getCurrentPrecipOverride } from "../public/js/intel/precip-override.js";

function memoryStorage(initial = {}) {
  let value = JSON.stringify(initial);
  return {
    getItem: () => value,
    setItem: (_key, next) => { value = next; }
  };
}

test("fresh overhead NOAA radar plus saturated air can acknowledge falling rain", () => {
  const now = Date.parse("2026-07-11T13:30:00Z");
  const result = getCurrentPrecipOverride({
    now,
    storage: memoryStorage(),
    current: { timestamp: now, precipRate: 0, relative_humidity: 93 },
    radar: { available: true, ageMinutes: 3, nearestEchoMiles: 4.1, echoPixels: 6976 }
  });
  assert.equal(result.active, true);
  assert.equal(result.radarSupportedRain, true);
  assert.equal(result.source, "noaa-radar");
  assert.match(result.headline, /rain is falling/i);
});

test("recent Tempest lightning is retained in the rain narrative", () => {
  const now = Date.parse("2026-07-11T13:30:00Z");
  const storage = memoryStorage();
  const result = getCurrentPrecipOverride({
    now,
    storage,
    current: {
      timestamp: now,
      precipRate: 1.2,
      lightningStrikeCount: 3,
      lightningStrikeDistance: 12
    }
  });
  assert.equal(result.type, "storm");
  assert.match(result.summary, /3 lightning strikes within about 12 miles/i);

  const retained = getCurrentPrecipOverride({
    now: now + 10 * 60 * 1000,
    storage,
    current: { timestamp: now + 10 * 60 * 1000, precipRate: 0 },
    radar: { available: true, ageMinutes: 2, nearestEchoMiles: 5, echoPixels: 200 }
  });
  assert.equal(retained.lightningActive, true);
  assert.equal(retained.lightningCount, 3);
});

test("radar by itself does not claim rain is reaching the ground", () => {
  const now = Date.parse("2026-07-11T13:30:00Z");
  const result = getCurrentPrecipOverride({
    now,
    storage: memoryStorage(),
    current: { timestamp: now, precipRate: 0, relative_humidity: 55 },
    radar: { available: true, ageMinutes: 3, nearestEchoMiles: 4, echoPixels: 500 }
  });
  assert.equal(result.active, false);
  assert.equal(result.radarSupportedRain, false);
});

test("Tempest last-strike time supports lightning wording after the interval count resets", () => {
  const now = Date.parse("2026-07-11T13:30:00Z");
  const result = getCurrentPrecipOverride({
    now,
    storage: memoryStorage(),
    current: {
      timestamp: now,
      precipRate: 0.8,
      lightningStrikeCount: 0,
      lightningStrikeDistance: 10,
      lightningStrikeLastAt: now - 4 * 60 * 1000
    }
  });
  assert.equal(result.lightningActive, true);
  assert.equal(result.type, "storm");
  assert.match(result.summary, /lightning within about 10 miles/i);
});
