import test from "node:test";
import assert from "node:assert/strict";
import { hikingReportState, hikingNetworkMarkup } from "../public/mobile/hiking-data.js";
import { hikingCurrentPayload } from "../lib/api-routes/hiking/current.js";
import { OBSERVATION_STATIONS } from "../lib/observations/registry.js";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const NOW = Date.parse("2026-10-16T14:00:00Z");
const sites = () => OBSERVATION_STATIONS.filter(station => !station.componentOnly && station.enabled !== false).map(station => ({ ...station, temperatureF: 60, dewPointF: 55, windMph: 3, gustMph: 8, observedAt: new Date(NOW).toISOString(), health: { usable: true }, retrievalMode: "live" }));
const observations = (stations = sites()) => ({ generatedAt: new Date(NOW).toISOString(), stations, quality: { requestedStations: 11, availableStations: stations.filter(s => s.health.usable).length, fallbackStations: 0, status: "fresh", failures: [] } });

test("mobile consumes the complete shared 11-site hiking payload and ten-site profile", () => {
  const payload = hikingCurrentPayload(observations(), { now: NOW });
  const report = hikingReportState(payload, NOW);
  assert.equal(report.requested, 11);
  assert.equal(report.available, 11);
  assert.equal(report.stale, false);
  const markup = hikingNetworkMarkup(payload, { now: NOW });
  assert.match(markup, /10 selected sites/);
  assert.match(markup, /All 11 station readings/);
  for (const name of ["Asheville Regional Airport", "Mills River", "Waynesville Research Station", "Burnsville Tower", "Bearwallow Mountain", "Mount Mitchell"]) assert.ok(markup.includes(name));
  assert.match(markup, /Lightning observations come from available Asheville-area Tempest stations/);
});

test("missing or rejected sites remain visible without invalid measurements and trigger current partial coverage", () => {
  const input = observations(sites().filter(s => ["tempest", "econet"].includes(s.provider)));
  input.quality.status = "partial";
  const payload = hikingCurrentPayload(input, { now: NOW });
  const report = hikingReportState(payload, NOW);
  assert.equal(payload.stations.length, 11);
  assert.equal(report.stale, false, "a recent partial report is distinct from an old report");
  assert.equal(report.partial, true);
  assert.equal(report.available, 10);
  assert.match(payload.guidance.hikerNarrative, /Limited station coverage: 10 of 11/);
  const missing = payload.stations.find(s => s.id === "nws-kavl");
  assert.equal(missing.health.usable, false);
  assert.equal(missing.temperatureF, undefined);
  assert.match(hikingNetworkMarkup(payload, { now: NOW }), /Current readings unavailable/);
});

test("a high coverage service status still exposes individual missing sites and null comparisons", () => {
  const data = sites().map(s => s.id === "mount-mitchell" ? { ...s, temperatureF: 109, health: { usable: false } } : s);
  const payload = hikingCurrentPayload(observations(data), { now: NOW });
  assert.equal(payload.quality.status, "fresh");
  assert.equal(hikingReportState(payload, NOW).partial, true);
  assert.equal(payload.guidance.mitchellDrop, null);
  assert.equal(payload.stations.find(s => s.id === "mount-mitchell").temperatureF, undefined);
});

test("mobile withholds a current score for stale, missing-time, unavailable, or future reports", () => {
  for (const generatedAt of [undefined, new Date(NOW - 46 * 60000).toISOString(), new Date(NOW + 6 * 60000).toISOString()]) {
    const payload = { ...observations(), generatedAt, guidance: { hikerScore: 90 } };
    assert.equal(hikingReportState(payload, NOW).stale, true);
    assert.equal(hikingReportState(payload, NOW).score, null);
  }
  const empty = { ...observations([]), guidance: { hikerScore: null } };
  assert.equal(hikingReportState(empty, NOW).score, null);
  assert.equal(hikingReportState(empty, NOW).stale, true);
});

test("fallback provenance and missing metrics are explicit instead of zero or current live claims", () => {
  const data = sites().map(s => s.id === "tempest-127602" ? { ...s, retrievalMode: "memory-fallback", humidityPct: null, windMph: null } : s);
  const payload = { ...observations(data), guidance: { hikerScore: null } };
  const markup = hikingNetworkMarkup(payload, { now: NOW });
  assert.match(markup, /1 site uses a recent saved reading/);
  assert.match(markup, /saved fallback reading/);
  assert.match(markup, /<dt>Humidity<\/dt><dd>Unavailable/);
  assert.equal(hikingReportState(payload, NOW).score, null);
});

test("an open mobile session reuses hiking data for five minutes, then retrieves new readings", async () => {
  const source = await readFile(new URL("../public/mobile/mobile.js", import.meta.url), "utf8");
  const loadFunction = source.slice(source.indexOf("async function loadHiking("), source.indexOf("async function loadSky("));
  let now = NOW;
  let requests = 0;
  const context = vm.createContext({ state: { hiking: null }, hikingLoadedAt: 0,
    Date: { now: () => now }, routeUrl: value => value, renderHiking() {},
    fetchJson: async () => ({ reading: ++requests }) });
  vm.runInContext(loadFunction, context);
  assert.equal((await vm.runInContext("loadHiking()", context)).reading, 1);
  now += 299999;
  assert.equal((await vm.runInContext("loadHiking()", context)).reading, 1);
  now += 1;
  assert.equal((await vm.runInContext("loadHiking()", context)).reading, 2);
  assert.equal((await vm.runInContext("loadHiking(true)", context)).reading, 3);
});
