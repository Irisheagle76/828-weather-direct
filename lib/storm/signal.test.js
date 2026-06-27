import test from "node:test";
import assert from "node:assert/strict";
import { buildStormSignal } from "./signal.js";
import { summarizeRadarFrames } from "./radar.js";

test("stays silent when radar is the only supporting signal", () => {
  const result = buildStormSignal({
    radar: {
      available: true,
      ageMinutes: 2,
      echoCoverage: 0.08,
      echoPixels: 500,
      nearWestEchoPixels: 100
    },
    sky: { mode: "day", cloudCoverWest: 5 },
    weather: { tempF: 86, dewF: 70 }
  });

  assert.equal(result.active, false);
  assert.equal(result.headline, null);
});

test("uses restrained wording for a moderate combined signal", () => {
  const result = buildStormSignal({
    radar: {
      available: true,
      ageMinutes: 2,
      echoCoverage: 0.02,
      echoPixels: 180,
      nearWestEchoPixels: 0,
      strongEchoPixels: 12,
      nearestEchoMiles: 55,
      growing: false,
      approaching: true
    },
    sky: { mode: "day", cloudCoverWest: 28 },
    weather: { tempF: 82, dewF: 64, humidity: 61 }
  });

  assert.equal(result.active, true);
  assert.equal(result.level, "watching");
  assert.equal(result.headline, "Clouds are building to the west.");
});

test("rejects weak eastward drift outside the near-west sector", () => {
  const result = buildStormSignal({
    radar: {
      available: true,
      ageMinutes: 1,
      echoCoverage: 0.12,
      echoPixels: 1265,
      nearWestEchoPixels: 0,
      strongEchoPixels: 0,
      nearestEchoMiles: 29,
      growing: true,
      movingEast: true,
      approaching: true
    },
    sky: { mode: "day", cloudCoverWest: 65 },
    weather: { tempF: 79, dewF: 71, humidity: 76 }
  });

  assert.equal(result.active, false);
  assert.equal(result.inputs.radarOrganizedNear, false);
  assert.equal(result.inputs.radarDevelopmentSupport, false);
});

test("ends messaging after strong echoes stop approaching", () => {
  const result = buildStormSignal({
    radar: {
      available: true,
      ageMinutes: 1,
      echoCoverage: 0.08,
      echoPixels: 850,
      nearWestEchoPixels: 90,
      strongEchoPixels: 80,
      nearestEchoMiles: 12,
      growing: true,
      approaching: false
    },
    sky: { mode: "day", cloudCoverWest: 75, cloudTrend: "increasing" },
    weather: { tempF: 80, dewF: 71, humidity: 76 }
  });

  assert.equal(result.active, false);
  assert.equal(result.inputs.radarDevelopmentSupport, false);
  assert.equal(result.headline, null);
});

test("rejects broad but weak radar echoes that are not approaching", () => {
  const result = buildStormSignal({
    radar: {
      available: true,
      ageMinutes: 1,
      echoCoverage: 0.1,
      echoPixels: 1100,
      nearWestEchoPixels: 3,
      strongEchoPixels: 0,
      nearestEchoMiles: 17,
      growing: true,
      approaching: false
    },
    sky: { mode: "day", cloudCoverWest: 65 },
    weather: { tempF: 79, dewF: 71, humidity: 76 }
  });

  assert.equal(result.active, false);
  assert.equal(result.inputs.radarDevelopmentSupport, false);
  assert.equal(result.headline, null);
});

test("uses stronger plain language when multiple signals agree", () => {
  const result = buildStormSignal({
    radar: {
      available: true,
      ageMinutes: 2,
      echoCoverage: 0.12,
      echoPixels: 900,
      nearWestEchoPixels: 240,
      strongEchoPixels: 60,
      nearestEchoMiles: 18,
      growing: true,
      approaching: true
    },
    sky: {
      mode: "day",
      cloudCoverWest: 62,
      cloudTrend: "increasing",
      satelliteCloudMotionSignal: true,
      satelliteCloudFraction: 0.7
    },
    weather: { tempF: 86, dewF: 70, humidity: 66 }
  });

  assert.equal(result.active, true);
  assert.equal(result.level, "strong");
  assert.equal(result.headline, "Storm clouds are building west of Asheville.");
  assert.match(result.detail, /radar echoes are growing and edging east/i);
});

test("does not use camera-based storm wording at night", () => {
  const result = buildStormSignal({
    radar: { available: true, ageMinutes: 1, echoPixels: 900, echoCoverage: 0.2 },
    sky: { mode: "night", cloudCoverWest: 90, cloudTrend: "increasing" },
    weather: { tempF: 80, dewF: 70 }
  });

  assert.equal(result.active, false);
});

test("radar frame summary detects growth and eastward motion", () => {
  const result = summarizeRadarFrames([
    {
      time: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
      echoPixels: 400,
      nearWestEchoPixels: 100,
      strongEchoPixels: 20,
      echoCoverage: 0.04,
      centroidLon: -83.2,
      centroidLat: 35.6,
      nearestEchoMiles: 38
    },
    {
      time: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
      echoPixels: 470,
      nearWestEchoPixels: 130,
      strongEchoPixels: 25,
      echoCoverage: 0.047,
      centroidLon: -83.16,
      centroidLat: 35.6,
      nearestEchoMiles: 32
    }
  ]);

  assert.equal(result.growing, true);
  assert.equal(result.movingEast, true);
  assert.equal(result.fillingInNearAsheville, true);
  assert.equal(result.approaching, true);
});
