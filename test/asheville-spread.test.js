import test from "node:test";
import assert from "node:assert/strict";
import { ASHEVILLE_STATIONS, publicStationMetadata } from "../lib/asheville-spread/stations.js";
import {
  normalizeEconet,
  normalizeNcei,
  normalizeTempest,
  normalizeWunderground
} from "../lib/asheville-spread/providers.js";
import { harmonizePressureObservations, stationToElevationAdjustedPressureMb } from "../lib/asheville-spread/pressure.js";
import { assessObservation } from "../lib/asheville-spread/quality.js";
import { buildAshevilleSpread } from "../lib/asheville-spread/service.js";

test("station registry contains 28 unique active physical stations and deduplicates Grove Arcade", () => {
  assert.equal(ASHEVILLE_STATIONS.length, 28);
  assert.equal(new Set(ASHEVILLE_STATIONS.map((station) => station.id)).size, 28);

  const aliases = ASHEVILLE_STATIONS.flatMap((station) => station.aliases);
  assert.equal(new Set(aliases).size, aliases.length);

  const grove = ASHEVILLE_STATIONS.find((station) => station.id === "grove-arcade");
  assert.equal(grove.source.provider, "ncei");
  assert.ok(grove.aliases.includes("wunderground:KNCASHEV475"));
  assert.ok(grove.aliases.includes("pwsweather:C9566"));

  const woodfin = ASHEVILLE_STATIONS.find((station) => station.id === "woodfin");
  assert.equal(woodfin.scope, "metro");
  assert.equal(woodfin.source.stationId, "KNCWOODF17");

  const unca = ASHEVILLE_STATIONS.find((station) => station.id === "unc-asheville");
  assert.equal(unca.elevationFt, 2357);
  assert.equal(unca.latitude, 35.621802282303385);

  const leicester = ASHEVILLE_STATIONS.find((station) => station.id === "leicester");
  assert.deepEqual(leicester, {
    id: "leicester",
    name: "Leicester",
    area: "Northwest Asheville / Leicester",
    latitude: 35.650065,
    longitude: -82.679968,
    elevationFt: 2014,
    exposure: "Rural residential, open field, few trees",
    publicCoordinatePrecision: 3,
    source: { provider: "wunderground", stationId: "KNCASHEV370" },
    aliases: ["wunderground:KNCASHEV370"]
  });
  assert.deepEqual(publicStationMetadata(leicester).location, {
    latitude: 35.65,
    longitude: -82.68,
    precision: "neighborhood"
  });
  for (const retiredId of ["biltmore-village", "asheville-high-school", "biltmore-estate"]) {
    assert.equal(ASHEVILLE_STATIONS.some((station) => station.id === retiredId), false);
  }

  assert.equal(ASHEVILLE_STATIONS.filter((station) => station.scope === "metro").length, 4);
  assert.equal(ASHEVILLE_STATIONS.filter((station) => station.scope === "corridor").length, 8);
  assert.deepEqual(
    [...new Set(ASHEVILLE_STATIONS.filter((station) => station.scope === "corridor").map((station) => station.corridor))].sort(),
    ["east", "north", "south", "west"]
  );
});

test("residential coordinates are generalized in public metadata", () => {
  const station = ASHEVILLE_STATIONS.find((item) => item.id === "north-haw-creek");
  assert.equal(station.name, "North Haw Creek");
  assert.deepEqual(station.source, { provider: "tempest", stationId: "127602" });
  const metadata = publicStationMetadata(station);
  assert.deepEqual(metadata.location, {
    latitude: 35.616,
    longitude: -82.506,
    precision: "neighborhood"
  });
});

test("provider normalizers produce a common observation shape", () => {
  const tempest = normalizeTempest([
    1_788_522_780, 0, 2, 4, 225, 3, 940, 20, 50, 1000, 3, 450, 0.5, 1, 10, 2, 2.7, 1, 5
  ]);
  assert.equal(tempest.temperatureF, 68);
  assert.equal(tempest.windMph, 4.474);
  assert.equal(tempest.precipitationTodayIn, 0.197);

  const tempestObject = normalizeTempest({
    timestamp: 1_788_522_780,
    air_temperature: 20,
    dew_point: 10,
    relative_humidity: 50,
    wind_avg: 2,
    wind_gust: 4,
    wind_direction: 225,
    station_pressure: 940,
    precip_rate: 0.4,
    precip_accum_local_day: 5,
    uv: 3,
    solar_radiation: 450
  });
  assert.equal(tempestObject.temperatureF, 68);
  assert.equal(tempestObject.dewPointF, 50);
  assert.equal(tempestObject.windMph, 4.474);
  assert.equal(tempestObject.precipitationTodayIn, 0.197);

  const wunderground = normalizeWunderground({
    obsTimeUtc: "2026-09-04T12:00:00Z",
    humidity: 55,
    winddir: 180,
    solarRadiation: 500,
    uv: 4,
    qcStatus: 1,
    imperial: { temp: 72.4, dewpt: 55, windSpeed: 3, windGust: 8, pressure: 30.01, precipRate: 0, precipTotal: 0.1 }
  });
  assert.equal(wunderground.temperatureF, 72.4);
  assert.equal(wunderground.reportedPressureMb, 1016.255);
  assert.equal(wunderground.pressureDatum, "ambiguous");
  assert.equal(wunderground.providerQcStatus, 1);

  const ncei = normalizeNcei({
    ts: 1_788_522_780,
    temp_out: 69,
    dew_point: 66,
    hum_out: 89,
    wind_speed: 1,
    wind_gust_10_min: 3,
    wind_dir: 300,
    bar: 30.084,
    bar_absolute: 27.74,
    rain_rate_in: 0,
    rain_day_in: 0,
    solar_rad: 26,
    uv: 0
  });
  assert.equal(ncei.stationPressureMb, 939.384);
  assert.equal(ncei.seaLevelPressureMb, 1018.761);

  const econet = normalizeEconet({
    ob_et: "2026-09-04 07:19:00",
    active: 1,
    temp: 66.2,
    dew: 64.8,
    rh: 95,
    ws: 0,
    gust: 1,
    wd: 207,
    pres: 935.406,
    precip: 0,
    precip_24h: 0,
    precip_7d: 0,
    sr: 6.92,
    wbgt: 65.5
  });
  assert.equal(econet.observedAt, "2026-09-04T11:19:00.000Z");
  assert.equal(econet.stationPressureMb, 935.406);
});

test("pressure harmonization separates station pressure from sea-level pressure", () => {
  const adjusted = stationToElevationAdjustedPressureMb(934.305,2245);
  assert.ok(adjusted > 1012 && adjusted < 1020);

  const stations = harmonizePressureObservations([
    { id: "reference", elevationFt: 2331, observation: { pressureDatum: "sea_level", seaLevelPressureMb: 1016.4 } },
    { id: "raw-station", elevationFt: 2245, observation: { pressureDatum: "ambiguous", reportedPressureMb: 934.305 } },
    { id: "already-reduced", elevationFt: 2200, observation: { pressureDatum: "ambiguous", reportedPressureMb: 1014.2 } },
    { id: "explicit-station", elevationFt: 2357, observation: { pressureDatum: "station", stationPressureMb: 931.929 } }
  ]);

  assert.equal(stations[1].observation.pressureNormalization,"inferred_station_elevation_reduced");
  assert.equal(stations[2].observation.pressureNormalization,"inferred_sea_level");
  assert.equal(stations[3].observation.pressureNormalization,"elevation_reduced_station");
  assert.ok(stations.every((station) => station.observation.normalizedPressureMb > 1000));
});

test("quality assessment excludes stale and implausible observations", () => {
  const now = Date.parse("2026-09-04T12:00:00Z");
  assert.deepEqual(
    assessObservation({ observedAt: "2026-09-04T11:55:00Z", temperatureF: 70, humidityPct: 60 }, now),
    { freshness: "fresh", ageMinutes: 5, usable: true, flags: [] }
  );

  const stale = assessObservation({ observedAt: "2026-09-04T10:00:00Z", temperatureF: 150 }, now);
  assert.equal(stale.freshness, "stale");
  assert.equal(stale.usable, false);
  assert.ok(stale.flags.includes("temperature_out_of_range"));
});

test("spread service reports temperature range without counting unavailable stations", async () => {
  const stations = [
    {
      id: "cool",
      name: "Cool",
      area: "A",
      latitude: 35.5,
      longitude: -82.5,
      elevationFt: 2000,
      exposure: "Open",
      source: { provider: "fixture", stationId: "one" },
      aliases: ["fixture:one"]
    },
    {
      id: "warm",
      name: "Warm",
      area: "B",
      latitude: 35.6,
      longitude: -82.6,
      elevationFt: 2300,
      exposure: "Open",
      source: { provider: "fixture", stationId: "two" },
      aliases: ["fixture:two"]
    },
    {
      id: "offline",
      name: "Offline",
      area: "C",
      latitude: 35.7,
      longitude: -82.7,
      elevationFt: 2200,
      exposure: "Open",
      enabled: false,
      unavailableReason: "Fixture unavailable",
      source: { provider: "fixture", stationId: "three" },
      aliases: ["fixture:three"]
    }
  ];
  const nowMs = Date.parse("2026-09-04T12:00:00Z");
  const payload = await buildAshevilleSpread({
    stations,
    nowMs,
    fetcher: async (station) => ({
      observedAt: "2026-09-04T11:58:00Z",
      temperatureF: station.id === "cool" ? 66 : 72,
      humidityPct: 50
    })
  });

  assert.equal(payload.network.stationCount, 3);
  assert.equal(payload.summary.reportingStationCount, 2);
  assert.equal(payload.summary.temperatureSpreadF, 6);
  assert.equal(payload.summary.coolest.stationId, "cool");
  assert.equal(payload.summary.warmest.stationId, "warm");
});

test("metro context does not change the core Asheville spread", async () => {
  const station = (id, temperatureF, scope) => ({
    id,
    name: id,
    area: id,
    latitude: 35.6,
    longitude: -82.6,
    elevationFt: 2200,
    exposure: "Open",
    scope,
    source: { provider: "fixture", stationId: id },
    aliases: [`fixture:${id}`],
    temperatureF
  });
  const stations = [station("core-cool", 60), station("core-warm", 70), station("metro-cold", 50, "metro")];
  const payload = await buildAshevilleSpread({
    stations,
    nowMs: Date.parse("2026-09-04T12:00:00Z"),
    fetcher: async (item) => ({ observedAt: "2026-09-04T11:58:00Z", temperatureF: item.temperatureF, humidityPct: 50 })
  });

  assert.equal(payload.summary.temperatureSpreadF, 10);
  assert.equal(payload.summary.coolest.stationId, "core-cool");
  assert.equal(payload.summary.regionalTemperatureSpreadF, 20);
  assert.equal(payload.summary.regionalCoolest.stationId, "metro-cold");
  assert.equal(payload.summary.metroStationCount, 1);
  assert.equal(payload.summary.corridorStationCount, 0);
});
