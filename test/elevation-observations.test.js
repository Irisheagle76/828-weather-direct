import test from "node:test";
import assert from "node:assert/strict";
import { evaluateObservationHealth, resetObservationHealthHistory } from "../lib/observations/health.js";
import { FALL_ANCHOR_STATIONS, OBSERVATION_STATIONS, STATION_BY_ID } from "../lib/observations/registry.js";
import { getElevationObservations, resetElevationObservationCache } from "../lib/observations/service.js";
import { summarizeSamples } from "../lib/observations/shadow.js";

const NOW = Date.parse("2026-08-20T12:40:00Z");

test("station registry has unique IDs and one composite for the Mountain Air pair", () => {
  assert.equal(new Set(OBSERVATION_STATIONS.map((station) => station.id)).size, OBSERVATION_STATIONS.length);
  assert.ok(FALL_ANCHOR_STATIONS.length >= 10);
  const composite = STATION_BY_ID.get("mountain-air-ridge-composite");
  assert.deepEqual(composite.componentIds, ["mountain-air-runway-14", "mountain-air-runway-32"]);
  assert.equal(composite.fall.weight, 0.7);
});

test("health checks reject stale and impossible readings and flag abrupt jumps", () => {
  resetObservationHealthHistory();
  const station = STATION_BY_ID.get("lake-junaluska");
  const base = observation(station, { observedAt: new Date(NOW - 5 * 60000).toISOString(), temperatureF: 40, humidityPct: 80 });
  assert.equal(evaluateObservationHealth(base, station, { now: NOW }).status, "healthy");
  const jump = observation(station, { observedAt: new Date(NOW).toISOString(), temperatureF: 60, humidityPct: 80 });
  assert.equal(evaluateObservationHealth(jump, station, { now: NOW }).status, "suspect");
  const stale = observation(station, { observedAt: new Date(NOW - 2 * 3600000).toISOString(), temperatureF: 40 });
  assert.equal(evaluateObservationHealth(stale, station, { now: NOW }).status, "stale");
  const impossible = observation(station, { observedAt: new Date(NOW).toISOString(), temperatureF: 140 });
  assert.equal(evaluateObservationHealth(impossible, station, { now: NOW }).status, "invalid");
});

test("live service collects public sources and excludes archived WU", async () => {
  resetElevationObservationCache();
  let requests = 0;
  const payload = await getElevationObservations({
    now: NOW,
    force: true,
    fallbackUrl: null,
    credentials: { weatherFlowApiKey: "wf-test", weatherUndergroundApiKey: "wu-test" },
    fetcher: async (url, options = {}) => {
      requests += 1;
      url = String(url);
      if (url.includes("weatherflow.com")) return response({ current_conditions: { time: NOW / 1000, air_temperature: 42, feels_like: 42, dew_point: 38, relative_humidity: 82, wind_avg: 2, wind_gust: 4, sea_level_pressure: 30.1, uv: 0, solar_radiation: 0, precip_rate: 0 } });
      if (url.includes("api.weather.com")) {
        const stationId = new URL(url).searchParams.get("stationId");
        return response({ observations: [{ stationID: stationId, obsTimeUtc: new Date(NOW - 2 * 60000).toISOString(), lat: 35.8, lon: -82.3, humidity: 80, winddir: 180, imperial: { temp: 41, heatIndex: 41, dewpt: 36, windSpeed: 3, windGust: stationId === "KNCBURNS30" ? 8 : 6, pressure: 30.1, precipRate: 0, precipTotal: 0 } }] });
      }
      if (url.includes("api.weather.gov")) return response({properties:{timestamp:new Date(NOW).toISOString(),temperature:{value:10,unitCode:"wmoUnit:degC"}}});
      if (url.includes("climate.ncsu.edu")) return response({ ob_et: "2026-08-20 08:35:00", temp: 39, dew: 36, rh: 84, ws: 5, gust: 8, sr: 0 });
      throw new Error(`Unexpected URL ${url} ${options.method || "GET"}`);
    }
  });
  assert.equal(payload.quality.status, "fresh");
  assert.equal(payload.quality.availableStations, payload.quality.requestedStations);
  assert.equal(payload.stations.filter((station) => station.id.startsWith("mountain-air-runway")).length, 0);
  const composite = payload.stations.find((station) => station.id === "mountain-air-ridge-composite");
  assert.equal(composite, undefined);
  assert.ok(payload.stations.every(s => s.provider !== "wunderground"));
  assert.ok(payload.stations.some(s => s.stationId === "KAVL"));
  const requestsAfterRefresh = requests;
  await getElevationObservations({ now: NOW + 60000, credentials: { weatherFlowApiKey: "wf-test", weatherUndergroundApiKey: "wu-test" }, fetcher: async () => { throw new Error("cache miss"); } });
  assert.equal(requests, requestsAfterRefresh);
});

test("shadow summary calculates bias and absolute error", () => {
  assert.deepEqual(summarizeSamples([{ residualF: -2 }, { residualF: 4 }]), { meanBiasF: 1, meanAbsoluteErrorF: 3, maxAbsoluteErrorF: 4 });
});

function observation(station, overrides = {}) {
  return { id: station.id, observedAt: new Date(NOW).toISOString(), temperatureF: 40, dewPointF: 35, humidityPct: 80, windMph: 2, gustMph: 4, ...overrides };
}

function response(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

test("Biltmore uses its dedicated observation endpoint", async () => {
 const {fetchProviderObservation}=await import("../lib/observations/providers.js");
 const station=STATION_BY_ID.get("tempest-237451");
 const result=await fetchProviderObservation(station,{credentials:{biltmoreTempestToken:"biltmore-test"},fetcher:async input=>{const u=new URL(input);assert.equal(u.pathname,"/swd/rest/observations/station/237451");assert.equal(u.searchParams.get("token"),"biltmore-test");return response({obs:[{timestamp:NOW/1000,air_temperature:20,relative_humidity:50,wind_avg:1}]});}});
 assert.equal(result.temperatureF,68);
});
