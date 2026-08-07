import test from "node:test";
import assert from "node:assert/strict";

import {
  calculateComfort,
  FEELSCORE_CALIBRATION
} from "../public/js/intel/comfort.js";

const calibrationTimestamp = Date.UTC(2026, 7, 7, 18);

function scoreAt(temperatureF, dewpointF) {
  return calculateComfort({
    temperatureF,
    dewpointF,
    windSpeed: 0,
    timestamp: calibrationTimestamp
  }).score * 10;
}

test("FeelScore uses the field-calibrated humid-heat model", () => {
  assert.equal(FEELSCORE_CALIBRATION.version, "2026-08-07-humid-heat-v1");
  assert.equal(FEELSCORE_CALIBRATION.dewpoint.muggyF, 65);
  assert.equal(FEELSCORE_CALIBRATION.dewpoint.veryMuggyF, 67);
});

test("warm air with a 68 degree dew point is not rated pleasant", () => {
  const comfort = calculateComfort({
    temperatureF: 79,
    dewpointF: 68,
    windSpeed: 0,
    timestamp: calibrationTimestamp
  });

  assert.equal(comfort.score, 5.3);
  assert.equal(comfort.label, "Mixed");
  assert.equal(comfort.flags.veryHumid, true);
});

test("mild air with a low dew point remains comfortable", () => {
  const comfort = calculateComfort({
    temperatureF: 72,
    dewpointF: 52,
    windSpeed: 0,
    timestamp: calibrationTimestamp
  });

  assert.ok(comfort.score >= 9);
  assert.equal(comfort.label, "Comfortable");
});

test("the same warm temperature becomes steadily less comfortable as moisture rises", () => {
  const progression = [
    { dewpointF: 60, expectedScore: 75 },
    { dewpointF: 65, expectedScore: 61 },
    { dewpointF: 68, expectedScore: 53 },
    { dewpointF: 70, expectedScore: 48 }
  ];

  for (const point of progression) {
    assert.equal(scoreAt(79, point.dewpointF), point.expectedScore);
  }
});
