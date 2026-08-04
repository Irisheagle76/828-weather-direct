import test from "node:test";
import assert from "node:assert/strict";
import {
  applyPrecipOverrideToNarrative,
  getCurrentPrecipOverride
} from "../public/js/intel/precip-override.js";

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

test("overhead radar and recent Tempest lightning override a zero gauge rate and fog narrative", () => {
  const now = Date.parse("2026-08-04T19:16:00Z");
  const storage = memoryStorage({
    lastRainDetectedAt: now - 8 * 60 * 1000,
    dryObservationStartedAt: now - 8 * 60 * 1000
  });
  const result = getCurrentPrecipOverride({
    now,
    storage,
    current: {
      timestamp: now,
      precipRate: 0,
      relative_humidity: 97,
      lightningStrikeCount: 4,
      lightningStrikeDistance: 3
    },
    radar: {
      available: true,
      ageMinutes: 2,
      nearestEchoMiles: 1.5,
      echoPixels: 6976,
      strongEchoPixels: 180
    }
  });

  assert.equal(result.mode, "active");
  assert.equal(result.type, "storm");
  assert.equal(result.radarConfirmedThunderstorm, true);
  assert.equal(result.dryConfirmed, true);
  assert.match(result.headline, /thunderstorm is active over Asheville/i);
  assert.match(result.summary, /radar shows precipitation over Asheville/i);
  assert.doesNotMatch(result.headline, /fog|eased/i);

  const narrative = applyPrecipOverrideToNarrative({
    headline: "Fog is obscuring Asheville.",
    detail: "The camera appears foggy."
  }, result);
  assert.match(narrative.headline, /thunderstorm is active over Asheville/i);
  assert.doesNotMatch(narrative.detail, /fog/i);
});

test("distant lightning and a clearing camera produce clearing-after-storms copy", () => {
  const now = Date.parse("2026-08-04T20:02:00Z");
  const result = getCurrentPrecipOverride({
    now,
    storage: memoryStorage({
      lastRainDetectedAt: now - 5 * 60 * 1000,
      dryObservationStartedAt: now - 8 * 60 * 1000
    }),
    current: {
      timestamp: now,
      precipRate: 0,
      relative_humidity: 92,
      lightningStrikeCount: 0,
      lightningStrikeDistance: 41,
      lightningStrikeLastAt: now - 1 * 60 * 1000
    },
    radar: {
      available: true,
      ageMinutes: 3,
      nearestEchoMiles: 4.1,
      echoPixels: 5497,
      strongEchoPixels: 277,
      approaching: false
    },
    skyClearing: true
  });

  assert.equal(result.mode, "clearing");
  assert.equal(result.radarConfirmedThunderstorm, false);
  assert.equal(result.lightningActive, true);
  assert.equal(result.lightningLocal, false);
  assert.match(result.headline, /sky is clearing after storms/i);
  assert.match(result.summary, /41 miles away/i);
});

test("distant recent lightning is labeled storms nearby when the sky is not clearing", () => {
  const now = Date.parse("2026-08-04T20:02:00Z");
  const result = getCurrentPrecipOverride({
    now,
    storage: memoryStorage({ dryObservationStartedAt: now - 8 * 60 * 1000 }),
    current: {
      timestamp: now,
      precipRate: 0,
      lightningStrikeDistance: 38,
      lightningStrikeLastAt: now - 2 * 60 * 1000
    },
    radar: { available: true, ageMinutes: 3, nearestEchoMiles: 4, echoPixels: 500 },
    skyClearing: false
  });

  assert.equal(result.mode, "nearby");
  assert.equal(result.lightningLocal, false);
  assert.match(result.headline, /storms are nearby, but not over Asheville/i);
});

test("radar older than ten minutes cannot confirm a local thunderstorm", () => {
  const now = Date.parse("2026-08-04T20:02:00Z");
  const result = getCurrentPrecipOverride({
    now,
    storage: memoryStorage({ dryObservationStartedAt: now - 8 * 60 * 1000 }),
    current: {
      timestamp: now,
      precipRate: 0,
      lightningStrikeDistance: 8,
      lightningStrikeLastAt: now - 2 * 60 * 1000
    },
    radar: { available: true, ageMinutes: 11, nearestEchoMiles: 2, echoPixels: 500 }
  });

  assert.equal(result.radarFresh, false);
  assert.equal(result.radarConfirmedThunderstorm, false);
  assert.equal(result.mode, "nearby");
});

test("lightning expires from the current observation after fifteen minutes", () => {
  const now = Date.parse("2026-08-04T20:02:00Z");
  const result = getCurrentPrecipOverride({
    now,
    storage: memoryStorage(),
    current: {
      timestamp: now,
      precipRate: 0,
      lightningStrikeDistance: 8,
      lightningStrikeLastAt: now - 16 * 60 * 1000
    },
    radar: { available: true, ageMinutes: 3, nearestEchoMiles: 2, echoPixels: 500 }
  });

  assert.equal(result.lightningActive, false);
  assert.equal(result.radarConfirmedThunderstorm, false);
  assert.equal(result.mode, "expired");
});
