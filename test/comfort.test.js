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
  assert.equal(FEELSCORE_CALIBRATION.version, "2026-11-22-all-season-v2");
  assert.equal(FEELSCORE_CALIBRATION.dewpoint.muggyF, 65);
  assert.equal(FEELSCORE_CALIBRATION.dewpoint.veryMuggyF, 67);
});

test("cool near-saturated air gets a raw-damp penalty", () => {
  const dry = calculateComfort({
    temperatureF: 57,
    dewpointF: 40,
    relativeHumidity: 50,
    windSpeed: 0,
    timestamp: Date.parse("2026-11-22T22:00:00-05:00")
  });
  const damp = calculateComfort({
    temperatureF: 57,
    dewpointF: 55,
    relativeHumidity: 94,
    windSpeed: 0,
    timestamp: Date.parse("2026-11-22T22:00:00-05:00")
  });

  assert.equal(damp.flags.rawDamp, true);
  assert.ok(damp.rawDampPenalty >= 0.12);
  assert.ok(damp.score * 10 <= 67);
  assert.ok(damp.score < dry.score);
});

test("active rain directly lowers the current comfort score", () => {
  const hour = {
    temperatureF: 57,
    dewpointF: 55,
    relativeHumidity: 94,
    windSpeed: 0,
    timestamp: Date.parse("2026-11-22T22:00:00-05:00")
  };
  const dry = calculateComfort(hour);
  const raining = calculateComfort({
    ...hour,
    activePrecipitation: true,
    precipSeverity: "light",
    precipType: "rain"
  });

  assert.equal(raining.weatherPenalty, 0.10);
  assert.equal(Math.round((dry.score - raining.score) * 10), 10);
  assert.ok(raining.score * 10 < FEELSCORE_CALIBRATION.scoreBands.pleasant);
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
