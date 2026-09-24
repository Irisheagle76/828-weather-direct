import test from "node:test";
import assert from "node:assert/strict";
import { yesterdayAtSameTime, closestTemperatureObservation, buildTemperatureComparison } from "../lib/tempest/temperature-comparison.js";

test("yesterday uses Asheville clock time across DST", () => {
  assert.equal(yesterdayAtSameTime(Date.parse("2026-03-08T14:00:00Z")), Date.parse("2026-03-07T15:00:00Z"));
  assert.equal(yesterdayAtSameTime(Date.parse("2026-11-01T15:00:00Z")), Date.parse("2026-10-31T14:00:00Z"));
});
test("closest valid temperature is used; gaps and nulls rejected", () => {
  const time = Date.parse("2026-09-13T14:00:00Z");
  const rows = [[time / 1000 - 60, 0, 0, 0, 0, 0, 0, 20], [time / 1000, 0, 0, 0, 0, 0, 0, null]];
  assert.equal(closestTemperatureObservation(rows, time).air_temperature, 20);
  assert.equal(closestTemperatureObservation(rows, time + 600_000), null);
});
test("comparison supports warmer, cooler, equal and stale observations", () => {
  const time = Date.parse("2026-09-14T14:00:00Z");
  const yesterday = { timestamp: time - 86_400_000, air_temperature: 20 };
  for (const [temperature, delta] of [[25, 9], [15, -9], [20, 0]]) {
    assert.equal(buildTemperatureComparison({ timestamp: time, air_temperature: temperature }, [yesterday], time).differenceF, delta);
  }
  assert.equal(buildTemperatureComparison({ timestamp: time, air_temperature: 20 }, [], time).available, false);
  assert.equal(buildTemperatureComparison({ timestamp: time, air_temperature: 20 }, [yesterday], time + 1_000_000).available, false);
});

test("endpoint caches/deduplicates reads and keeps private tokens out of results", async () => {
  const originalFetch = globalThis.fetch;
  const originalStation = process.env.TEMPEST_STATION_ID;
  const originalToken = process.env.TEMPEST_TOKEN;
  process.env.TEMPEST_STATION_ID = "123";
  process.env.TEMPEST_TOKEN = "private-test-token";
  const time = Date.now();
  let requests = 0;
  globalThis.fetch = async url => {
    requests++;
    const pathname = url.pathname;
    const data = pathname.includes("observations/station") ? { obs: [{ timestamp: time, air_temperature: 25 }] } :
      pathname.includes("observations/device") ? { type: "obs_st", obs: [[Math.floor(yesterdayAtSameTime(time) / 1000), 0, 0, 0, 0, 0, 0, 20]] } :
      { stations: [{ station_id: 123, devices: [{ device_id: 456, device_type: "ST" }] }] };
    return { ok: true, json: async () => data };
  };
  try {
    const { default: handler } = await import("../lib/api-routes/tempest/temperature-comparison.js?cache-test");
    const call = async method => {
      const headers = {};
      const res = { setHeader(k, v) { headers[k] = v; }, status(code) { this.code = code; return this; }, json(data) { return { code: this.code, data, headers }; } };
      return handler({ method }, res);
    };
    const results = await Promise.all([call("GET"), call("GET")]);
    assert.equal(results[0].data.differenceF, 9);
    assert.equal(requests, 3);
    await call("GET");
    assert.equal(requests, 3);
    assert.match(results[0].headers["Cache-Control"], /s-maxage=300/);
    assert.ok(!JSON.stringify(results).includes("private-test-token"));
    assert.equal((await call("POST")).code, 405);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalStation === undefined) delete process.env.TEMPEST_STATION_ID; else process.env.TEMPEST_STATION_ID = originalStation;
    if (originalToken === undefined) delete process.env.TEMPEST_TOKEN; else process.env.TEMPEST_TOKEN = originalToken;
  }
});
