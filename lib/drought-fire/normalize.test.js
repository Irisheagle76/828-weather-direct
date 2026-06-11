import assert from "node:assert/strict";
import test from "node:test";

import { normalizeInputs } from "./normalize.js";

const severeDrought = {
  precipDeficit90d_in: 9,
  precipDeficitSeasonal_in: 13,
  soilPercentile: 1,
  daysSinceRain: 24,
  tempAnomalyF: 8
};

test("humid calm weather does not become high fire threat from drought alone", () => {
  const result = normalizeInputs({
    precipDeficit90d_in: 4.6,
    precipDeficitSeasonal_in: 21.8,
    soilPercentile: 1,
    daysSinceRain: 10,
    tempAnomalyF: 17.2,
    rh: 65,
    windGust: 2,
    tempF: 82
  });

  assert.ok(result.DSS >= 80);
  assert.equal(result.FRI, 41);
});

test("dry windy weather activates severe drought fuels", () => {
  const result = normalizeInputs({
    ...severeDrought,
    rh: 20,
    windGust: 25,
    tempF: 90
  });

  assert.ok(result.FRI >= 80, `unexpected FRI ${result.FRI}`);
});

test("measurable rain still caps today's fire threat", () => {
  const result = normalizeInputs({
    ...severeDrought,
    rh: 55,
    windGust: 12,
    tempF: 80,
    rainTodayIn: 0.35
  });

  assert.ok(result.FRI <= 28, `unexpected FRI ${result.FRI}`);
});
