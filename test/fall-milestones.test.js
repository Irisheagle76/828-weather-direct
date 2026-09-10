import test from "node:test";
import assert from "node:assert/strict";
import { createMilestoneArchive, evaluateMilestones, fallSeasonYear, publicMilestoneArchive } from "../lib/fall/milestones.js";
import { recordFallMilestones } from "../lib/fall/milestone-service.js";
import { buildSeasonProgress } from "../public/js/fall/intelligence.js";

const FIRST_RUN = Date.parse("2026-10-05T09:00:00Z");
const SECOND_RUN = FIRST_RUN + 60 * 60 * 1000;

test("fall season is limited to August through December in Eastern time", () => {
  assert.equal(fallSeasonYear(Date.parse("2026-08-01T04:00:00Z")), 2026);
  assert.equal(fallSeasonYear(Date.parse("2026-12-31T23:00:00Z")), 2026);
  assert.equal(fallSeasonYear(Date.parse("2027-01-01T05:00:00Z")), null);
  assert.equal(fallSeasonYear(Date.parse("2026-07-31T23:59:00Z")), null);
});

test("one cold observation stays pending until a consecutive sample confirms it", () => {
  const first = evaluateMilestones(null, payload(anchor("mitchell", 6215, 31, FIRST_RUN - 5 * 60000)), { now: FIRST_RUN });
  const summit = band(first.archive, "6000-plus");
  assert.equal(summit.first40, null);
  assert.equal(summit.first36, null);
  assert.equal(summit.first32, null);
  assert.equal(summit.pending.first32.stationId, "mitchell");

  const second = evaluateMilestones(first.archive, payload(anchor("mitchell", 6215, 31.5, SECOND_RUN - 5 * 60000)), { now: SECOND_RUN });
  const confirmed = band(second.archive, "6000-plus");
  assert.equal(confirmed.first40.confirmation, "two-consecutive-samples");
  assert.equal(confirmed.first36.confirmation, "two-consecutive-samples");
  assert.equal(confirmed.first32.date, "2026-10-05");
  assert.equal(confirmed.first28, null);
  assert.deepEqual(second.newlyRecorded.map((item) => item.thresholdF), [40, 36, 32]);
});

test("two independent stations confirm a band milestone in one run", () => {
  const result = evaluateMilestones(null, payload(
    anchor("waynesville", 2700, 35, FIRST_RUN - 6 * 60000, { destinationId: "waynesville" }),
    anchor("black-mountain", 2661, 34, FIRST_RUN - 4 * 60000, { destinationId: "black-mountain" })
  ), { now: FIRST_RUN });
  const lowBand = band(result.archive, "2000-3000");
  assert.equal(lowBand.first40.confirmation, "two-independent-stations");
  assert.equal(lowBand.first36.evidence.length, 2);
  assert.equal(lowBand.first32, null);
});

test("recorded milestones are immutable when a later, colder observation arrives", () => {
  const existing = createMilestoneArchive(2026, FIRST_RUN);
  band(existing, "4000-5000").first32 = { thresholdF: 32, date: "2026-09-30", firstObservedAt: "2026-09-30T10:00:00.000Z" };
  const result = evaluateMilestones(existing, payload(anchor("mountain-air", 4375, 25, FIRST_RUN - 5 * 60000)), { now: FIRST_RUN });
  assert.equal(band(result.archive, "4000-5000").first32.date, "2026-09-30");
});

test("fallback, low-weight and forecast-outlier readings cannot create milestones", () => {
  const result = evaluateMilestones(null, payload(
    anchor("fallback", 6215, 20, FIRST_RUN - 5 * 60000, { retrievalMode: "artifact-fallback" }),
    anchor("low-weight", 3500, 20, FIRST_RUN - 5 * 60000, { effectiveWeight: 0.4 }),
    anchor("outlier", 4375, 20, FIRST_RUN - 5 * 60000, { crossStationStatus: "outlier" })
  ), { now: FIRST_RUN });
  assert.equal(result.eligibleObservations, 0);
  assert.equal(result.newlyRecorded.length, 0);
  assert.ok(result.archive.bands.every((item) => Object.keys(item.pending).length === 0));
});

test("public archive excludes unconfirmed pending sensor evidence", () => {
  const evaluated = evaluateMilestones(null, payload(anchor("mitchell", 6215, 39, FIRST_RUN - 5 * 60000)), { now: FIRST_RUN });
  const publicArchive = publicMilestoneArchive(evaluated.archive);
  assert.equal(publicArchive.trackingStartedAt, new Date(FIRST_RUN).toISOString());
  assert.equal("pending" in band(publicArchive, "6000-plus"), false);
});

test("Fall Explorer displays the most severe confirmed milestone for each band", () => {
  const progress = buildSeasonProgress({ bands: [{ id: "6000-plus", label: "6,000+ ft", temperatureF: 35 }] }, [{
    elevationBand: "6000-plus",
    first40: { thresholdF: 40, date: "2026-09-20" },
    first36: { thresholdF: 36, date: "2026-09-28" },
    first32: { thresholdF: 32, date: "2026-10-05" },
    first28: null
  }]);
  assert.equal(progress[0].status, "Freeze Reached");
  assert.equal(progress[0].reachedThreshold, 32);
  assert.equal(progress[0].date, "2026-10-05");
  assert.equal(progress[0].provisional, false);
});

test("milestone service persists an idempotent seasonal archive", async () => {
  let saved = null;
  const first = await recordFallMilestones(payload(anchor("mitchell", 6215, 39, FIRST_RUN - 5 * 60000)), {
    now: FIRST_RUN,
    loader: async () => saved,
    saver: async (archive) => { saved = archive; return true; }
  });
  assert.equal(first.status, "recorded");
  assert.equal(first.archive.bands[0].first40, null);

  const second = await recordFallMilestones(payload(anchor("mitchell", 6215, 38, SECOND_RUN - 5 * 60000)), {
    now: SECOND_RUN,
    loader: async () => saved,
    saver: async (archive) => { saved = archive; return true; }
  });
  assert.equal(second.newlyRecorded[0].thresholdF, 40);
  assert.equal(second.archive.bands[0].first40.date, "2026-10-05");
});

function payload(...anchors) {
  return { anchors };
}

function anchor(id, elevationFeet, temperatureF, observedAt, overrides = {}) {
  return {
    id,
    name: id,
    destinationId: "mitchell",
    elevationFeet,
    temperatureF,
    observedAt: new Date(observedAt).toISOString(),
    source: "Test station",
    effectiveWeight: 1,
    retrievalMode: "live",
    crossStationStatus: "normal",
    health: { usable: true, status: "healthy" },
    ...overrides
  };
}

function band(archive, id) {
  return archive.bands.find((item) => item.elevationBand === id);
}
