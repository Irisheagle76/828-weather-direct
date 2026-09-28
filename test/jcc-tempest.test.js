import test from "node:test";
import assert from "node:assert/strict";
import { fetchJccObservation } from "../lib/tempest/jcc.js";
import { fetchProviderObservation } from "../lib/observations/providers.js";
import { STATION_BY_ID } from "../lib/observations/registry.js";
import handler from "../lib/api-routes/tempest/device.js";

const now = Date.now();
const raw = { timestamp: Math.floor(now / 1000), air_temperature: 20, relative_humidity: 50,
  wind_avg: 2, wind_gust: 4, precip_rate: 2.54, precip_accum_local_day: 5.08,
  lightning_strike_count_last_1hr: 3 };
const reply = (obs = raw, overrides = {}) => ({ ok: true, json: async () => ({ status: { status_code: 0 }, station_id: 144737, obs: [obs], ...overrides }) });

test("dedicated JCC access converts direct metric observations and leaves other stations on the API key", async () => {
  const credentials = { jccTempestToken: "jcc-private", weatherFlowApiKey: "network-private" };
  const station = STATION_BY_ID.get("tempest-144737");
  const obs = await fetchProviderObservation(station, { credentials, now, fetcher: async url => {
    const parsed = new URL(url);
    assert.equal(parsed.pathname, "/swd/rest/observations/station/144737");
    assert.equal(parsed.searchParams.get("token"), credentials.jccTempestToken);
    assert.equal(parsed.searchParams.has("api_key"), false);
    return reply();
  } });
  assert.equal(obs.temperatureF, 68);
  assert.ok(Math.abs(obs.windMph - 4.47387) < 0.0001);
  assert.ok(Math.abs(obs.rainRateInHr - 0.1) < 0.0001);
  assert.equal(obs.lightningStrikes1h, 3);
  assert.ok(!JSON.stringify(obs).includes("private"));
  for (const id of ["tempest-127602", "tempest-144737"]) {
    await fetchProviderObservation(STATION_BY_ID.get(id), { credentials: id.endsWith("144737") ? { weatherFlowApiKey: "network-private" } : credentials, fetcher: async url => {
      assert.equal(new URL(url).searchParams.get("api_key"), "network-private");
      assert.equal(new URL(url).searchParams.has("token"), false);
      return { ok: true, json: async () => ({ current_conditions: { time: now / 1000 } }) };
    } });
  }
});

test("JCC rejects stale, wrong-station and denied responses and redacts request errors", async () => {
  for (const response of [reply({ ...raw, timestamp: now / 1000 - 601 }), reply(raw, { station_id: 123 }), reply(raw, { status: { status_code: 401 } })]) {
    await assert.rejects(fetchJccObservation("secret", { now, fetcher: async () => response }));
  }
  await assert.rejects(fetchJccObservation("secret", { fetcher: async () => { throw new Error("https://example/?token=secret"); } }), error => !error.message.includes("secret"));
  const array = [now / 1000, 0, 2, 4, 180, 3, 950, 20, 50, 0, 0, 0, 0.1, 1, 0, 0, 0, 1];
  const obs = await fetchJccObservation("secret", { now, fetcher: async () => reply(array) });
  assert.equal(obs.wind_avg, 2);
  assert.equal(obs.precipRate, 6);
});

test("endpoint exposes JCC separately without replacing primary temperature or wind", async () => {
  const saved = { token: process.env.TEMPEST_TOKEN, jcc: process.env.JCC_TEMPEST_TOKEN, station: process.env.TEMPEST_STATION_ID, fetch: globalThis.fetch };
  process.env.TEMPEST_TOKEN = "primary-private";
  process.env.JCC_TEMPEST_TOKEN = "jcc-private";
  process.env.TEMPEST_STATION_ID = "123";
  globalThis.fetch = async url => {
    const parsed = new URL(url);
    if (parsed.pathname.endsWith("144737")) {
      assert.equal(parsed.searchParams.get("token"), "jcc-private");
      return reply();
    }
    assert.equal(parsed.searchParams.get("token"), "primary-private");
    if (parsed.pathname.endsWith("better_forecast")) return { ok: true, json: async () => ({ current_conditions: { ...raw, air_temperature: 25, wind_avg: 1 } }) };
    return reply({ ...raw, air_temperature: 25, wind_avg: 1 }, { station_id: 123 });
  };
  try {
    let payload;
    await handler({}, { status() { return this; }, json(value) { payload = value; } });
    assert.equal(payload.current_conditions.air_temperature, 25);
    assert.equal(payload.current_conditions.wind_avg, 1);
    assert.equal(payload.downtown_station.air_temperature, 20);
    assert.equal(payload.wind_station.windSpeed, 2);
    assert.ok(!JSON.stringify(payload).includes("private"));
  } finally {
    globalThis.fetch = saved.fetch;
    for (const [key, value] of [["TEMPEST_TOKEN", saved.token], ["JCC_TEMPEST_TOKEN", saved.jcc], ["TEMPEST_STATION_ID", saved.station]]) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
