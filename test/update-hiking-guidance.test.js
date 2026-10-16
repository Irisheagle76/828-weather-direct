import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { updateHikingGuidance } from "../scripts/update-hiking-guidance.mjs";
import { resetElevationObservationCache } from "../lib/observations/service.js";
import { OBSERVATION_STATIONS } from "../lib/observations/registry.js";

const NOW = Date.parse("2026-10-16T07:02:00Z");
const credentials = { weatherUndergroundApiKey: "wu-secret", jccTempestToken: "jcc-secret", tempestToken: "home-secret", tempestStationId: "127602" };
const replacementWUIds = ["KNCWAYNE323", "KNCBURNS167", "KNCCANTO128", "KNCCANTO127", "KNCBLACK209", "KNCLAKEJ3", "KNCASHEV482", "KNCASHEV440", "KNCASHEV288", "KNCASHEV307"];

async function refresh(t, options = {}) {
  resetElevationObservationCache();
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "hiking-refresh-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const outputPath = path.join(directory, "hiking-guidance.json");
  const previous = '{"generatedAt":"2026-10-15T14:00:00Z","stations":[]}\n';
  await fs.writeFile(outputPath, previous);
  const logs = [];
  const logger = Object.fromEntries(["info", "warn", "error"].map((level) => [level, (message) => logs.push({ level, ...JSON.parse(message) })]));
  return { outputPath, previous, logs, run: () => updateHikingGuidance({ now: NOW, outputPath, credentials, fetcher: upstream(), logger, ...options }) };
}

// Exercise the actual observation service, health checks, composite, analyzer, and writer.
function upstream({ rejectTempest = false, failedWUIds = [], staleStation = null, lightning = false } = {}) {
  return async (input) => {
    const url = new URL(input);
    if (url.hostname === "swd.weatherflow.com") {
      if (url.pathname.includes("/observations/station/")) {
        return response({ status: { status_code: 0 }, station_id: 144737, obs: [{
          timestamp: NOW / 1000, air_temperature: 20, relative_humidity: 60,
          wind_avg: 1, wind_gust: 2, solar_radiation: 0,
          lightning_strike_count_last_1hr: lightning ? 1 : 0
        }] });
      }
      if ((rejectTempest || url.searchParams.has("token")) && url.searchParams.get("token") !== "home-secret") return response({}, 401);
      const stationId = url.searchParams.get("station_id");
      return response({ current_conditions: {
        time: NOW / 1000 - (stationId === staleStation ? 7200 : 0),
        air_temperature: stationId === staleStation ? 109 : 65, dew_point: 50,
        wind_avg: 3, wind_gust: 5, relative_humidity: 65,
        lightning_strike_count_last_1hr: lightning ? 1 : 0
      } });
    }
    if (url.hostname === "api.weather.com") {
      const stationId = url.searchParams.get("stationId");
      if (failedWUIds.includes(stationId)) return response({}, 503);
      return response({ observations: [{
        stationID: stationId, obsTimeUtc: new Date(NOW - (stationId === staleStation ? 7200000 : 0)).toISOString(),
        humidity: 70, imperial: { temp: stationId === staleStation ? 109 : 55, dewpt: 45, windSpeed: 3, windGust: 8, precipRate: 0 }
      }] });
    }
    if (url.hostname === "products.climate.ncsu.edu") {
      return response({ latest: { ob: "2026-10-16 02:55:00", air_temp: 45, dew: 35, rh: 65, wind_speed: 5, wind_gust: 10 } });
    }
    assert.fail(`Unexpected upstream host: ${url.hostname}`);
  };
}

function response(data, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => data };
}

test("partial WU outage publishes 9/19 current sites with explicit coverage and station-level diagnostics", async (t) => {
  const context = await refresh(t, { fetcher: upstream({ failedWUIds: replacementWUIds }) });
  const payload = await context.run();
  assert.equal(payload.quality.status, "partial");
  assert.equal(payload.quality.availableStations, 9);
  assert.equal(payload.quality.requestedStations, 19);
  assert.equal(payload.quality.failures.length, 10);
  assert.equal(payload.stations.length, OBSERVATION_STATIONS.filter((s) => !s.componentOnly).length);
  assert.equal(payload.stations.filter((s) => s.health.usable).length, 9);
  assert.ok(payload.stations.filter((s) => !s.health.usable).every((s) => s.status === "unavailable" && s.temperatureF === undefined));
  assert.equal(payload.guidance.localTempSpread, 3);
  assert.equal(payload.guidance.highStationSpread, null);
  assert.match(payload.guidance.hikerNarrative, /Limited station coverage: 9 of 19/);
  assert.match(payload.guidance.routeWarnings.at(-1), /unavailable sites cannot rule out.*lightning/);
  const warnings = context.logs.filter((log) => log.event === "hiking_feed_failure");
  assert.equal(warnings.length, 10);
  assert.ok(warnings.every((log) => log.provider === "wunderground" && /503/.test(log.reason)));
  assert.deepEqual(JSON.parse(await fs.readFile(context.outputPath, "utf8")), payload);
});

test("full coverage needs no shared WeatherFlow key and retains lightning alerts and Mountain Air composite", async (t) => {
  const context = await refresh(t, { fetcher: upstream({ lightning: true }) });
  const payload = await context.run();
  assert.equal(payload.quality.status, "fresh");
  assert.equal(payload.quality.availableStations, 19);
  assert.equal(payload.guidance.lightning.active, true);
  assert.equal(payload.guidance.hikerScoreLabel, "Alert");
  assert.doesNotMatch(payload.guidance.hikerNarrative, /Limited station coverage/);
  assert.deepEqual(payload.stations.find((s) => s.provider === "composite").componentStationIds, ["KNCBURNS29", "KNCBURNS30"]);
  assert.equal(context.logs.filter((log) => log.level === "warn").length, 0);
});

test("only the two owner Tempest stations remain and their tokens stay station-scoped", async (t) => {
  assert.deepEqual(OBSERVATION_STATIONS.filter(s => s.provider === "tempest").map(s => s.providerStationId), ["144737", "127602"]);
  const requests = [];
  const provider = upstream({ rejectTempest: true });
  const context = await refresh(t, {
    credentials: { ...credentials, tempestToken: "home-secret", tempestStationId: "127602" },
    fetcher: async (input, options) => {
      const url = new URL(input);
      if (url.hostname === "swd.weatherflow.com") requests.push(url);
      return provider(input, options);
    }
  });
  const payload = await context.run();
  assert.equal(payload.quality.availableStations, 19);
  assert.equal(payload.quality.failures.length, 0);
  assert.equal(payload.stations.find((s) => s.id === "tempest-127602").health.usable, true);
  assert.equal(payload.stations.find((s) => s.id === "tempest-144737").health.usable, true);
  const ownerRequests = requests.filter((url) => url.searchParams.get("token") === "home-secret");
  assert.equal(ownerRequests.length, 1);
  assert.equal(ownerRequests[0].searchParams.get("station_id"), "127602");
  assert.equal(ownerRequests[0].searchParams.has("api_key"), false);
  assert.ok(requests.some((url) => url.pathname.endsWith("/observations/station/144737") && url.searchParams.get("token") === "jcc-secret"));
  assert.equal(requests.length, 2);
});

test("an owner token without a matching station ID is never sent to other stations", async (t) => {
  const context = await refresh(t, { credentials: { ...credentials, tempestToken: "home-secret", tempestStationId: "999999" }, fetcher: upstream({ rejectTempest: true }) });
  const payload = await context.run();
  assert.equal(payload.quality.availableStations, 18);
  assert.equal(payload.stations.find((s) => s.id === "tempest-127602").health.usable, false);
  assert.match(payload.quality.failures.find(f => f.id === "tempest-127602").reason, /TEMPEST_TOKEN with a matching TEMPEST_STATION_ID/);
});

test("residence authorization failures identify the owner token setting and preserve the station ID", async (t) => {
  const context = await refresh(t, { credentials: { ...credentials, tempestToken: "invalid-home-secret", tempestStationId: "127602" }, fetcher: upstream({ rejectTempest: true }) });
  const payload = await context.run();
  const failure = payload.quality.failures.find((f) => f.id === "tempest-127602");
  assert.match(failure.reason, /401/);
  const diagnostic = context.logs.find((log) => log.event === "hiking_feed_failure" && log.id === "tempest-127602");
  assert.match(diagnostic.hint, /TEMPEST_TOKEN and TEMPEST_STATION_ID/);
  assert.doesNotMatch(JSON.stringify(context.logs), /invalid-home-secret/);
});

test("JCC authorization failure identifies its own token and leaves other feeds usable", async (t) => {
  const provider = upstream();
  const context = await refresh(t, { fetcher: (input) => new URL(input).pathname.endsWith("/observations/station/144737") ? response({}, 401) : provider(input) });
  const payload = await context.run();
  assert.equal(payload.quality.availableStations, 18);
  assert.equal(payload.stations.find(s => s.id === "tempest-127602").health.usable, true);
  const diagnostic = context.logs.find(log => log.event === "hiking_feed_failure" && log.id === "tempest-144737");
  assert.match(diagnostic.reason, /HTTP 401/);
  assert.match(diagnostic.hint, /JCC_TEMPEST_TOKEN/);
  assert.doesNotMatch(diagnostic.hint, /WEATHERFLOW_API_KEY/);
});

test("stale numeric readings are excluded from guidance and replaced with unavailable site metadata", async (t) => {
  const context = await refresh(t, { fetcher: upstream({ staleStation: "KNCASHEV440" }) });
  const payload = await context.run();
  const stale = payload.stations.find((s) => s.id === "windy-ridge-trail");
  assert.equal(stale.health.usable, false);
  assert.equal(stale.temperatureF, undefined);
  assert.equal(stale.observedAt, undefined);
  assert.match(stale.error, /stale/);
  assert.ok(payload.guidance.maxTemp < 109);
  assert.equal(payload.quality.availableStations, 18);
  assert.match(payload.guidance.hikerNarrative, /18 of 19/);
});

test("a total outage preserves the previous file, fails clearly, and redacts credentials", async (t) => {
  const context = await refresh(t, { fetcher: async () => { throw new Error(`Network failed https://upstream.example/?token=${credentials.tempestToken} ${credentials.weatherUndergroundApiKey}`); } });
  await assert.rejects(context.run(), /No usable live hiking observations/);
  assert.equal(await fs.readFile(context.outputPath, "utf8"), context.previous);
  assert.ok(context.logs.some((log) => log.event === "hiking_refresh_failed"));
  const logged = JSON.stringify(context.logs);
  for (const [name, secret] of Object.entries(credentials)) if (/key|token/i.test(name)) assert.ok(!logged.includes(secret));
  assert.ok(!logged.includes("https://upstream.example"));
});

test("missing credentials name the missing secret, skip requests, and preserve the previous file", async (t) => {
  for (const key of ["weatherUndergroundApiKey"]) {
    let requested = false;
    const context = await refresh(t, { credentials: { ...credentials, [key]: null }, fetcher: async () => { requested = true; } });
    await assert.rejects(context.run(), /WEATHER_UNDERGROUND_API_KEY/);
    assert.equal(requested, false);
    assert.equal(await fs.readFile(context.outputPath, "utf8"), context.previous);
  }
});

test("repeated refreshes cannot publish memory fallback as fresh live observations", async (t) => {
  const context = await refresh(t);
  const payload = await context.run();
  const before = await fs.readFile(context.outputPath, "utf8");
  await assert.rejects(updateHikingGuidance({
    now: NOW + 60_000, outputPath: context.outputPath, credentials,
    fetcher: async () => response({}, 503), logger: { info() {}, warn() {}, error() {} }
  }), /No usable live hiking observations/);
  assert.equal(payload.quality.status, "fresh");
  assert.equal(await fs.readFile(context.outputPath, "utf8"), before);
});
