import test from "node:test";
import assert from "node:assert/strict";
import { normalizeNwsGrid, parseValidTime } from "../lib/fall/nws-grid.js";
import { buildPayload, resetFallCachesForTest } from "../lib/api-routes/fall.js";

const NOW = Date.parse("2026-10-10T12:15:00Z");
const START = "2026-10-10T12:00:00+00:00";
const destination = { id: "test", name: "Test Ridge", latitude: 35.6, longitude: -82.5, elevationFeet: 5000, region: "Test", type: "ridge" };

test("NWS validTime parser handles multi-hour and day intervals", () => {
  assert.equal(parseValidTime(`${START}/PT6H`).hours, 6);
  assert.equal(parseValidTime(`${START}/P1DT6H`).hours, 30);
});

test("NWS grid normalization converts units and distributes accumulated precipitation", () => {
  const result = normalizeNwsGrid(gridFixture(), destination, { now: NOW, days: 1 });
  assert.equal(result.dataQuality.available, true);
  assert.equal(Math.round(result.hourly[0].temperatureF), 68);
  assert.equal(Number(result.hourly[0].windSpeed.toFixed(1)), 6.2);
  assert.equal(Number(result.hourly[0].visibilityMiles.toFixed(1)), 10);
  assert.equal(Number(result.hourly[0].precipitation.toFixed(2)), 0.5);
  assert.equal(Number(result.hourly[1].precipitation.toFixed(2)), 0.5);
  assert.equal(result.nws.gridElevationFeet, 3281);
  assert.equal(result.nws.elevationConfidence, "low");
  assert.ok(Number.isFinite(result.daily[0].sunrise));
  assert.ok(Number.isFinite(result.daily[0].sunset));
});

test("Fall API batches shared NWS grids and keeps partial destination results", async () => {
  resetFallCachesForTest();
  let gridRequests = 0;
  const fetcher = async (url, options) => {
    assert.match(options.headers["User-Agent"], /828WeatherDirect/);
    if (url.includes("/points/35.5951,")) return response({}, 500);
    if (url.includes("/points/")) return response({ properties: { gridId: "GSP", gridX: 1, gridY: 1, forecastGridData: "https://api.weather.gov/gridpoints/GSP/1,1", observationStations: "https://api.weather.gov/gridpoints/GSP/1,1/stations" } });
    gridRequests += 1;
    return response(gridFixture());
  };
  const payload = await buildPayload({ now: NOW, fetcher });
  assert.equal(payload.source, "NOAA/NWS forecast grids + 828 normalization");
  assert.equal(payload.quality.status, "partial");
  assert.equal(payload.destinations.length, 7);
  assert.equal(payload.quality.failures[0].id, "asheville");
  assert.equal(gridRequests, 1);
});

function gridFixture() {
  const property = (uom, value, validTime = `${START}/P1D`) => ({ uom, values: [{ validTime, value }] });
  return { properties: {
    updateTime: "2026-10-10T11:30:00Z",
    elevation: { unitCode: "wmoUnit:m", value: 1000 },
    temperature: property("wmoUnit:degC", 20),
    dewpoint: property("wmoUnit:degC", 10),
    relativeHumidity: property("wmoUnit:percent", 55),
    probabilityOfPrecipitation: property("wmoUnit:percent", 20),
    quantitativePrecipitation: property("wmoUnit:mm", 25.4, `${START}/PT2H`),
    skyCover: property("wmoUnit:percent", 30),
    windSpeed: property("wmoUnit:km_h-1", 10),
    windGust: property("wmoUnit:km_h-1", 20),
    visibility: property("wmoUnit:m", 16093.44)
  } };
}

function response(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, headers: { get: () => null }, json: async () => body };
}
