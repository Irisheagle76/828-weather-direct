import test from "node:test";
import assert from "node:assert/strict";
import { seasonalPeakTimingInput } from "../lib/fall/seasonal-input.js";
import { estimatePeakTiming } from "../public/js/fall/peak-timing.js";

test("reviewed Vilas summary reaches the model with provenance and overrides old manual input", () => {
  const input = seasonalPeakTimingInput(Date.parse("2026-10-05T12:00:00Z"), { FALL_SEPTEMBER_MEAN_F: "70", FALL_SEPTEMBER_MEAN_YEAR: "2026" });
  assert.equal(input.septemberMeanF, 66.6);
  assert.equal(input.provenance.station.location, "Vilas, NC");
  assert.equal(input.provenance.rawDailyRecords, null);
  assert.match(input.source, /author-reported/);
  const peak = estimatePeakTiming(input);
  assert.equal(peak.midpoint, "Oct 20");
  assert.equal(peak.planningWindow, "Oct 17–Oct 23");
  assert.equal(peak.shiftDays, 3.6);
  assert.equal(peak.inputType, "seasonal");
});

test("completed September input activates at Eastern October boundary only", () => {
  assert.equal(seasonalPeakTimingInput(Date.parse("2026-10-01T03:59:59Z"), {}).septemberMeanF, null);
  assert.equal(seasonalPeakTimingInput(Date.parse("2026-10-01T04:00:00Z"), {}).septemberMeanF, 66.6);
  assert.equal(seasonalPeakTimingInput(Date.parse("2027-10-05T12:00:00Z"), {}).septemberMeanF, null);
});

test("invalid or missing seasonal means preserve historical fallback", () => {
  for (const value of [null, undefined, "", "bad", 0, 44, 86]) {
    const input = seasonalPeakTimingInput(Date.parse("2027-10-05T12:00:00Z"), { FALL_SEPTEMBER_MEAN_YEAR: "2027", FALL_SEPTEMBER_MEAN_F: value }, {});
    assert.equal(input.septemberMeanF, null);
    assert.equal(estimatePeakTiming(input).inputType, "climatology");
  }
});
