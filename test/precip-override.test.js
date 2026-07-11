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

test("sustained fresh zero rain rates move from falling rain to eased rain", () => {
  const now = Date.parse("2026-07-11T13:30:00Z");
  const storage = memoryStorage();
  const radar = { available: true, ageMinutes: 2, nearestEchoMiles: 4, echoPixels: 500 };
  const first = getCurrentPrecipOverride({
    now,
    storage,
    current: { timestamp: now, precipRate: 0, relative_humidity: 94 },
    radar
  });
  assert.equal(first.mode, "active");
  assert.equal(first.radarSupportedRain, true);

  const ending = getCurrentPrecipOverride({
    now: now + 5 * 60 * 1000,
    storage,
    current: { timestamp: now + 5 * 60 * 1000, precipRate: 0, relative_humidity: 94 },
    radar
  });
  assert.equal(ending.mode, "recent");
  assert.equal(ending.dryConfirmed, true);
  assert.match(ending.headline, /rain has eased/i);
});

test("normal FeelScore narrative resumes after the wet transition window", () => {
  const now = Date.parse("2026-07-11T13:30:00Z");
  const storage = memoryStorage();
  const radar = { available: true, ageMinutes: 2, nearestEchoMiles: 4, echoPixels: 500 };
  getCurrentPrecipOverride({
    now,
    storage,
    current: { timestamp: now, precipRate: 0, relative_humidity: 94 },
    radar
  });
  const ended = getCurrentPrecipOverride({
    now: now + 11 * 60 * 1000,
    storage,
    current: { timestamp: now + 11 * 60 * 1000, precipRate: 0, relative_humidity: 94 },
    radar
  });
  assert.equal(ended.mode, "expired");
  assert.equal(ended.active, false);
  assert.equal(ended.overrideExpired, true);
});

test("a renewed Tempest rain rate cancels the dry handoff immediately", () => {
  const now = Date.parse("2026-07-11T13:30:00Z");
  const storage = memoryStorage({ dryObservationStartedAt: now - 8 * 60 * 1000 });
  const resumed = getCurrentPrecipOverride({
    now,
    storage,
    current: { timestamp: now, precipRate: 0.7, relative_humidity: 94 }
  });
  assert.equal(resumed.mode, "active");
  assert.equal(resumed.activeRainNow, true);
  assert.equal(resumed.dryConfirmed, false);
});
