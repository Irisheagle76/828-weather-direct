import test from "node:test";
import assert from "node:assert/strict";

import { buildHumanActionIntelFS } from "../public/js/intel/human-action-feelscore.js";

function localTimestamp(year, month, day, hour) {
  return new Date(year, month - 1, day, hour, 0, 0, 0).getTime();
}

function forecastHour(timestamp, temperatureF, dewpointF, windSpeed = 5) {
  return {
    timestamp,
    temperatureF,
    dewpointF,
    windSpeed,
    windGust: windSpeed + 4,
    precipAmount: 0,
    precipProbability: 0.1,
    cloudCover: 0.2
  };
}

test("today narrative names an upcoming uncomfortable FEELSCORE window", () => {
  const now = localTimestamp(2026, 8, 12, 8);
  const hourly = [
    forecastHour(localTimestamp(2026, 8, 12, 8), 67, 63, 3),
    forecastHour(localTimestamp(2026, 8, 12, 9), 71, 63, 7),
    forecastHour(localTimestamp(2026, 8, 12, 10), 74, 65, 9),
    forecastHour(localTimestamp(2026, 8, 12, 11), 77, 65, 12),
    forecastHour(localTimestamp(2026, 8, 12, 12), 80, 67, 13),
    forecastHour(localTimestamp(2026, 8, 12, 13), 82, 69, 13),
    forecastHour(localTimestamp(2026, 8, 12, 14), 84, 69, 11),
    forecastHour(localTimestamp(2026, 8, 12, 15), 85, 70, 10),
    forecastHour(localTimestamp(2026, 8, 12, 16), 84, 69, 10),
    forecastHour(localTimestamp(2026, 8, 12, 17), 84, 68, 10),
    forecastHour(localTimestamp(2026, 8, 12, 18), 83, 68, 9),
    forecastHour(localTimestamp(2026, 8, 12, 19), 80, 67, 7),
    forecastHour(localTimestamp(2026, 8, 12, 20), 77, 65, 5),
    forecastHour(localTimestamp(2026, 8, 12, 21), 74, 64, 3),
    forecastHour(localTimestamp(2026, 8, 12, 22), 72, 63, 3),
    forecastHour(localTimestamp(2026, 8, 12, 23), 71, 63, 2),
    forecastHour(localTimestamp(2026, 8, 13, 0), 70, 63, 2)
  ];

  const result = buildHumanActionIntelFS({ now, hourly });

  assert.match(result.feelscore.narrative, /^Right now, temperatures are mild, while humidity is noticeable\./);
  assert.match(result.feelscore.narrative, /Heat and humidity become the main story this afternoon/);
  assert.match(result.feelscore.narrative, /temperatures reaching the mid-80s/);
  assert.match(result.feelscore.narrative, /dew points near 70°/);
  assert.doesNotMatch(result.feelscore.narrative, /mid-80s, and dew points/);
  const projectedScore = result.feelscore.narrative.match(/FEELSCORE falls to around (\d+)/);
  assert.ok(projectedScore);
  assert.ok(Number(projectedScore[1]) <= 54);
  assert.match(result.feelscore.narrative, /extended time outside uncomfortable/);
  assert.match(result.feelscore.narrative, /before improving this evening/);
});

test("comfortable future conditions retain the standard narrative", () => {
  const now = localTimestamp(2026, 8, 12, 8);
  const hourly = Array.from({ length: 17 }, (_, index) =>
    forecastHour(localTimestamp(2026, 8, 12, 8 + index), 68 + Math.min(index, 6), 55, 5)
  );

  const result = buildHumanActionIntelFS({ now, hourly });

  assert.doesNotMatch(result.feelscore.narrative, /FEELSCORE falls to around/);
  assert.doesNotMatch(result.feelscore.narrative, /extended time outside uncomfortable/);
});

test("an afternoon already in uncomfortable territory keeps the stronger narrative", () => {
  const now = localTimestamp(2026, 8, 12, 15);
  const hourly = [
    forecastHour(localTimestamp(2026, 8, 12, 15), 86, 70, 10),
    forecastHour(localTimestamp(2026, 8, 12, 16), 87, 69, 10),
    forecastHour(localTimestamp(2026, 8, 12, 17), 85, 68, 10),
    forecastHour(localTimestamp(2026, 8, 12, 18), 83, 68, 9),
    forecastHour(localTimestamp(2026, 8, 12, 19), 80, 67, 7),
    forecastHour(localTimestamp(2026, 8, 12, 20), 77, 65, 5),
    forecastHour(localTimestamp(2026, 8, 12, 21), 74, 64, 3),
    forecastHour(localTimestamp(2026, 8, 12, 22), 72, 63, 3),
    forecastHour(localTimestamp(2026, 8, 12, 23), 71, 63, 2),
    forecastHour(localTimestamp(2026, 8, 13, 0), 70, 63, 2)
  ];

  const result = buildHumanActionIntelFS({ now, hourly });

  assert.match(result.feelscore.narrative, /Heat and humidity are the main story this afternoon/);
  assert.match(result.feelscore.narrative, /FEELSCORE is already around \d+/);
  assert.match(result.feelscore.narrative, /before improving this evening/);
});
