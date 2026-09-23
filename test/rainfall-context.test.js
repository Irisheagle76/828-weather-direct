import test from "node:test";
import assert from "node:assert/strict";
import { getLatestCompleteAshevilleDateKey } from "../lib/rainfall-context/live.js";

test("UTC evening still uses Asheville's prior complete day", () => {
  assert.equal(
    getLatestCompleteAshevilleDateKey(new Date("2026-08-09T00:24:00Z")),
    "20260807"
  );
});

test("after Asheville midnight the newly completed local day is eligible", () => {
  assert.equal(
    getLatestCompleteAshevilleDateKey(new Date("2026-08-09T04:05:00Z")),
    "20260808"
  );
});

test("winter standard time uses the same Asheville calendar rule", () => {
  assert.equal(
    getLatestCompleteAshevilleDateKey(new Date("2026-12-10T03:30:00Z")),
    "20261208"
  );
});
