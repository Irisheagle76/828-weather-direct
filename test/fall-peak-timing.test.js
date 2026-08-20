import test from "node:test";
import assert from "node:assert/strict";
import { estimatePeakTiming, PEAK_TIMING_MODEL } from "../public/js/fall/peak-timing.js";

test("uses the document's 64.7°F baseline without inventing a seasonal temperature", () => {
  const result = estimatePeakTiming({ seasonYear: 2026 });
  assert.equal(result.midpoint, "Oct 17");
  assert.equal(result.planningWindow, "Oct 14–Oct 20");
  assert.equal(result.inputType, "climatology");
  assert.equal(result.shiftDays, 0);
  assert.equal(result.model.rSquared, 0.62);
});

test("moves the midpoint about 1.90 days for each degree of September departure", () => {
  const result = estimatePeakTiming({ seasonYear: 2026, septemberMeanF: 66.7, source: "Verified September mean" });
  assert.equal(result.midpoint, "Oct 20");
  assert.equal(result.shiftDays, 3.8);
  assert.equal(result.inputType, "seasonal");
  assert.equal(result.inputLabel, "Verified September mean");
  assert.equal(PEAK_TIMING_MODEL.slopeDaysPerF, 1.9015);
});

test("rejects implausible temperature inputs and falls back to climatology", () => {
  const result = estimatePeakTiming({ seasonYear: 2026, septemberMeanF: 110 });
  assert.equal(result.septemberMeanF, 64.7);
  assert.equal(result.inputType, "climatology");
});
