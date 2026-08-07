import test from "node:test";
import assert from "node:assert/strict";

import {
  PULSE_SHELF_LIFE_MS,
  isPulseFresh,
  pulseExpiresAt,
  pulseTimestamp
} from "../public/js/pulse-freshness.js";

const publishedAt = Date.parse("2026-08-06T12:00:00-04:00");

test("Pulse remains promoted until its three-hour shelf life ends", () => {
  assert.equal(isPulseFresh(publishedAt, publishedAt + PULSE_SHELF_LIFE_MS - 1), true);
  assert.equal(isPulseFresh(publishedAt, publishedAt + PULSE_SHELF_LIFE_MS), false);
});

test("Pulse expiration uses the supplied update timestamp", () => {
  assert.equal(pulseExpiresAt(publishedAt), publishedAt + PULSE_SHELF_LIFE_MS);
  assert.equal(isPulseFresh(null, publishedAt), false);
});

test("Pulse timestamps accept ISO strings and Unix seconds", () => {
  assert.equal(pulseTimestamp("2026-08-06T12:00:00-04:00"), publishedAt);
  assert.equal(pulseTimestamp(publishedAt / 1000), publishedAt);
});
