import test from "node:test";
import assert from "node:assert/strict";

import { calculatePeriodScoreTrend } from "./scoreTrend.js";

test("current trend ignores a late-night rebound after worsening near-term comfort", () => {
  const scores = [40, 38, 35, 32, 31, 30, 48];
  assert.equal(calculatePeriodScoreTrend(scores, "today"), -10);
});

test("current trend uses all available scores when fewer than six exist", () => {
  assert.equal(calculatePeriodScoreTrend([55, 52, 49], "today"), -6);
});

test("tomorrow retains its full-period comparison", () => {
  assert.equal(calculatePeriodScoreTrend([40, 35, 32, 48], "tomorrow"), 8);
});
