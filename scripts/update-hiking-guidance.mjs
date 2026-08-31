import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { OBSERVATION_STATIONS, STATION_BY_ID, stationsForProvider } from "../lib/observations/registry.js";
import { getElevationObservations } from "../lib/observations/service.js";
import { analyzeHikingStations } from "../lib/hiking/guidance.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "public", "data");
const jsonPath = path.join(outDir, "hiking-guidance.json");
// hiking.html is static presentation code; hiking-page.js reads this artifact.
const weatherFlowKey = process.env.WEATHERFLOW_API_KEY || null;
const weatherUndergroundKey = process.env.WEATHER_UNDERGROUND_API_KEY || process.env.WU_API_KEY || null;
const lightningSignalMaxAgeMs = 3 * 60 * 60 * 1000;
const observationMaxAgeMs = 3 * 60 * 60 * 1000;

const tempestStations = stationsForProvider("tempest").map((station) => ({
  id: station.providerStationId,
  name: station.name,
  role: station.role,
  elevationFt: station.elevationFt,
  url: station.url,
  lat: station.latitude,
  lon: station.longitude
}));

const ashevilleStationIds = new Set(["tempest-144737", "tempest-127602", "tempest-160562", "tempest-157700"]);

const userAgent = "828 Weather Direct hiking guidance (+https://avlweather.com)";

function n(value) {
  const parsed = Number.parseFloat(String(value ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function round(value, digits = 0) {
  if (value == null || !Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function f(value, suffix = "") {
  return value == null ? "n/a" : `${Math.round(value)}${suffix}`;
}

function uvFromSolar(solarWm2) {
  if (solarWm2 == null) return null;
  return Math.max(0, Math.min(11, Math.round(solarWm2 / 115)));
}

function displayUv(station) {
  const uv = station.uv ?? uvFromSolar(station.solarWm2);
  return uv == null ? "n/a" : `UV ${uv}${station.uv == null ? " est." : ""}`;
}

function hasLightningSignal(station, thresholdMiles = 10) {
  const lastStrikeAt = station.lightningLastEpoch ? new Date(station.lightningLastEpoch).getTime() : null;
  const hasRecentLastStrike = Number.isFinite(lastStrikeAt) && (Date.now() - lastStrikeAt) <= lightningSignalMaxAgeMs;
  return Boolean(
    (station.lightningStrikes1h ?? 0) > 0 ||
    (station.lightningStrikes3h ?? 0) > 0 ||
    (
      hasRecentLastStrike &&
      station.lightningLastDistanceMiles != null &&
      station.lightningLastDistanceMiles <= thresholdMiles
    )
  );
}

function lightningDetail(station) {
  if (!station) return null;

  const parts = [];
  if ((station.lightningStrikes1h ?? 0) > 0) {
    parts.push(`${station.lightningStrikes1h} strike${station.lightningStrikes1h === 1 ? "" : "s"} in the last hour`);
  }
  if ((station.lightningStrikes3h ?? 0) > 0) {
    parts.push(`${station.lightningStrikes3h} strike${station.lightningStrikes3h === 1 ? "" : "s"} in the last 3 hours`);
  }

  if (station.lightningLastDistanceMsg) {
    parts.push(`last strike ${station.lightningLastDistanceMsg}`);
  } else if (station.lightningLastDistanceMiles != null) {
    parts.push(`last strike about ${f(station.lightningLastDistanceMiles, " miles")} away`);
  }

  if (station.lightningLastEpoch) {
    parts.push(`last detected ${localTime(station.lightningLastEpoch)}`);
  }

  return parts.join(" · ");
}

function heatFeel(station) {
  const wbgt = station.wbgtF;
  const temp = station.temperatureF;
  if (wbgt != null) {
    if (wbgt >= 82) return { label: "Heat caution", detail: `trail heat ${f(wbgt, "°")}` };
    if (wbgt >= 74) return { label: "Warm effort", detail: `trail heat ${f(wbgt, "°")}` };
    if (wbgt >= 65) return { label: "Comfortable", detail: `trail heat ${f(wbgt, "°")}` };
    return { label: "Easy", detail: `trail heat ${f(wbgt, "°")}` };
  }
  if (temp != null && temp <= 58) return { label: "Cool layer", detail: f(temp, "°") };
  if (temp != null && temp >= 78) return { label: "Warm", detail: f(temp, "°") };
  return { label: "Comfortable", detail: temp == null ? "" : f(temp, "°") };
}

function friendlyWind(station) {
  if (station.windMph == null) return "n/a";
  if (station.windMph === 0) return "Calm";
  const direction = normalizeDirection(station.windDirection);
  const base = `${direction ? `${direction} at ` : ""}${f(station.windMph)} mph`;
  const gust = station.gustMph != null && station.gustMph > station.windMph ? `, gusting to ${f(station.gustMph)} mph` : "";
  return `${base}${gust}`;
}

function normalizeDirection(direction) {
  if (!direction || direction === "N/A") return "";
  const text = String(direction).trim();
  if (/^(var|vrb|variable)$/i.test(text)) return "Variable";
  const degree = text.match(/^(-?\d+(?:\.\d+)?)deg$/i);
  if (!degree) return text;
  return degreesToCardinal(Number(degree[1]));
}

function degreesToCardinal(degrees) {
  if (!Number.isFinite(degrees)) return "";
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return dirs[Math.round((((degrees % 360) + 360) % 360) / 22.5) % 16];
}

function localTime(iso) {
  if (!iso) return "unavailable";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(iso));
}

function asOfTime(iso) {
  return localTime(iso).replace(/\s([AP])M$/, (_, meridiem) => `${meridiem.toLowerCase()}m ET`);
}

function easternWallClockDate(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (!match) return null;
  const [, year, month, day, hour, minute, second] = match.map(Number);
  const wallClockUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  const probe = new Date(wallClockUtc);
  const offsetPart = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    timeZoneName: "shortOffset"
  }).formatToParts(probe).find((part) => part.type === "timeZoneName")?.value || "";
  const offset = offsetPart.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!offset) return null;
  const sign = offset[1] === "-" ? -1 : 1;
  const offsetMinutes = sign * (Number(offset[2]) * 60 + Number(offset[3] || 0));
  return new Date(wallClockUtc - offsetMinutes * 60 * 1000);
}

function easternWallClockAgeMs(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (!match) return null;
  const [, year, month, day, hour, minute, second] = match.map(Number);
  const observedWallClock = Date.UTC(year, month - 1, day, hour, minute, second);
  const nowParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(new Date());
  const now = Object.fromEntries(nowParts.map((part) => [part.type, part.value]));
  const nowWallClock = Date.UTC(
    Number(now.year),
    Number(now.month) - 1,
    Number(now.day),
    Number(now.hour),
    Number(now.minute),
    Number(now.second)
  );
  return nowWallClock - observedWallClock;
}

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function htmlValue(value) {
  return esc(value).replace(/degF/g, "&deg;F").replace(/°F/g, "&deg;F").replace(/°/g, "&deg;");
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function hikerScore(g) {
  const factors = [];
  let penalty = 0;
  const add = (amount, label) => {
    const value = round(amount, 1);
    if (value > 0) {
      penalty += value;
      factors.push({ label, penalty: value });
    }
  };

  if (g.lightning?.active) add(45, "Nearby lightning");
  add(g.fogRisk === "Elevated" ? 8 : g.fogRisk === "Patchy pockets" ? 4 : 0, "Fog or damp trail risk");
  add(g.maxUv == null ? 0 : clamp((g.maxUv - 2) * 2, 0, 18), "UV exposure");
  add(g.maxSolar == null ? 0 : clamp((g.maxSolar - 500) / 120, 0, 5), "Solar exposure");
  add(g.maxGust == null ? 0 : clamp((g.maxGust - 12) * 0.9, 0, 18), "Wind on exposed terrain");
  add(g.maxWbgt == null ? 0 : clamp((g.maxWbgt - 65) * 0.75, 0, 20), "Heat stress");
  add(g.maxTemp == null || g.maxWbgt != null ? 0 : clamp((g.maxTemp - 78) * 0.6, 0, 10), "Warm air temperature");
  add(g.maxRainRate == null ? 0 : clamp(g.maxRainRate * 80, 0, 12), "Active rain");
  add(g.maxRainToday == null ? 0 : clamp((g.maxRainToday - 0.1) * 8, 0, 8), "Wet ground");
  add(g.mitchellDrop == null ? 0 : clamp((g.mitchellDrop - 10) * 0.4, 0, 7), "High-peak temperature drop");
  add(g.localTempSpread == null ? 0 : clamp((g.localTempSpread - 4) * 0.6, 0, 8), "Local microclimate spread");

  const score = Math.round(clamp(92 - penalty, 0, 100));
  return { score, factors };
}

function hikerScoreLabel(score, lightningActive = false) {
  if (lightningActive) return "Alert";
  if (score >= 84) return "Great";
  if (score >= 70) return "Good";
  if (score >= 55) return "Mixed";
  return "Use care";
}

async function readPrevious() {
  try {
    return JSON.parse(await fs.readFile(jsonPath, "utf8"));
  } catch {
    return null;
  }
}

async function fetchTempest(station) {
  if (!weatherFlowKey) throw new Error("WEATHERFLOW_API_KEY is not configured");
  const params = new URLSearchParams({
    api_key: weatherFlowKey,
    station_id: station.id,
    units_temp: "f",
    units_wind: "mph",
    units_pressure: "inhg",
    units_distance: "mi",
    units_precip: "in",
    units_other: "imperial",
    units_direction: "cardinal"
  });
  const response = await fetch(`https://swd.weatherflow.com/swd/rest/better_forecast?${params}`, {
    headers: { "user-agent": userAgent }
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  const data = await response.json();
  const c = data.current_conditions || {};
  const observedAt = Number.isFinite(Number(c.time)) ? new Date(Number(c.time) * 1000) : null;
  const ageMs = observedAt ? Date.now() - observedAt.getTime() : NaN;
  if (!observedAt || !Number.isFinite(ageMs) || ageMs < -5 * 60 * 1000 || ageMs > observationMaxAgeMs) {
    throw new Error(`Tempest ${station.id} observation is stale or missing`);
  }
  return {
    source: "Tempest",
    id: `tempest-${station.id}`,
    stationId: station.id,
    name: station.name,
    role: station.role,
    elevationFt: station.elevationFt,
    url: station.url,
    lat: station.lat,
    lon: station.lon,
    status: "live",
    observedAt: observedAt.toISOString(),
    conditions: c.conditions ?? "Unknown",
    temperatureF: n(c.air_temperature),
    feelsLikeF: n(c.feels_like),
    dewPointF: n(c.dew_point),
    humidityPct: n(c.relative_humidity),
    windMph: n(c.wind_avg),
    gustMph: n(c.wind_gust),
    windDirection: c.wind_direction_cardinal ?? null,
    uv: n(c.uv),
    solarWm2: n(c.solar_radiation),
    lightningStrikes1h: n(c.lightning_strike_count_last_1hr),
    lightningStrikes3h: n(c.lightning_strike_count_last_3hr),
    lightningLastDistanceMiles: n(c.lightning_strike_last_distance),
    lightningLastDistanceMsg: c.lightning_strike_last_distance_msg ?? null,
    lightningLastEpoch: c.lightning_strike_last_epoch ? new Date(c.lightning_strike_last_epoch * 1000).toISOString() : null,
    wbgtF: n(c.wet_bulb_globe_temperature),
    wetBulbF: n(c.wet_bulb_temperature),
    rainTodayIn: n(c.precip_accum_local_day),
    rainRateInHr: n(c.precip_rate ?? 0),
    pressureTrend: c.pressure_trend ?? null
  };
}

async function fetchEconetStation(station) {
  const response = await fetch("https://products.climate.ncsu.edu/oper/cardinal/scout/panels/php/ajax_currentConditions.php", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "user-agent": userAgent
    },
    body: `station=${encodeURIComponent(station.providerStationId)}`
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  const data = await response.json();
  const latest = data?.latest || {};
  const observedAt = easternWallClockDate(latest.ob);
  const ageMs = easternWallClockAgeMs(latest.ob);
  if (!latest.ob || !observedAt || !Number.isFinite(ageMs) || ageMs < -5 * 60 * 1000 || ageMs > observationMaxAgeMs) {
    throw new Error(`NC ECONet ${station.providerStationId} observation is stale or missing`);
  }

  return {
    source: `NC ECONet ${station.providerStationId}`,
    id: station.id,
    stationId: station.providerStationId,
    name: station.name,
    role: station.role,
    elevationFt: n(data?.meta?.elev) ?? station.elevationFt,
    url: station.url,
    lat: station.latitude,
    lon: station.longitude,
    status: "live",
    observedAt: observedAt.toISOString(),
    conditions: "Current conditions",
    temperatureF: n(latest.air_temp),
    feelsLikeF: n(latest.air_temp),
    dewPointF: n(latest.dew),
    humidityPct: n(latest.rh),
    windMph: n(latest.wind_speed),
    gustMph: n(latest.wind_gust),
    windDirection: latest.wind_dir_deg == null ? null : `${latest.wind_dir_deg}deg`,
    uv: null,
    solarWm2: n(latest.sr),
    wbgtF: null,
    wetBulbF: null,
    rainTodayIn: null,
    rainRateInHr: null,
    pressureTrend: null
  };
}

async function fetchMitchell() {
  return fetchEconetStation(STATION_BY_ID.get("mount-mitchell"));
}

async function fetchFryingPan() {
  return fetchEconetStation(STATION_BY_ID.get("frying-pan-pisgah-ridgeline"));
}

async function fetchWeatherUndergroundStation(station) {
  if (!weatherUndergroundKey) throw new Error("WEATHER_UNDERGROUND_API_KEY is not configured");
  const params = new URLSearchParams({
    stationId: station.stationId,
    format: "json",
    units: "e",
    numericPrecision: "decimal",
    apiKey: weatherUndergroundKey
  });
  const response = await fetch(`https://api.weather.com/v2/pws/observations/current?${params}`, {
    headers: { "user-agent": userAgent }
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  const data = await response.json();
  const observation = data.observations?.[0];
  if (!observation) throw new Error("Weather Underground returned no current observation");
  const observedAt = observation.obsTimeUtc ? new Date(observation.obsTimeUtc) : null;
  const ageMs = observedAt ? Date.now() - observedAt.getTime() : NaN;
  if (!observedAt || !Number.isFinite(ageMs) || ageMs < -5 * 60 * 1000 || ageMs > observationMaxAgeMs) {
    throw new Error(`Weather Underground ${station.stationId} observation is stale or missing`);
  }
  const imperial = observation.imperial || {};
  return {
    source: "Weather Underground",
    id: station.id,
    stationId: observation.stationID || station.stationId,
    name: station.name,
    role: station.role,
    elevationFt: station.elevationFt,
    url: station.url,
    lat: n(observation.lat),
    lon: n(observation.lon),
    status: "live",
    observedAt: observedAt.toISOString(),
    conditions: "Current conditions",
    temperatureF: n(imperial.temp),
    feelsLikeF: n(imperial.heatIndex) ?? n(imperial.windChill) ?? n(imperial.temp),
    dewPointF: n(imperial.dewpt),
    humidityPct: n(observation.humidity),
    windMph: n(imperial.windSpeed),
    gustMph: n(imperial.windGust),
    windDirection: observation.winddir == null ? null : `${observation.winddir}deg`,
    uv: n(observation.uv),
    solarWm2: n(observation.solarRadiation),
    wbgtF: null,
    wetBulbF: null,
    rainTodayIn: n(imperial.precipTotal),
    rainRateInHr: n(imperial.precipRate),
    pressureTrend: null
  };
}

async function fetchMaxPatch() {
  return fetchWeatherUndergroundStation(weatherUndergroundConfig("max-patch"));
}

async function fetchBarnardsville() {
  return fetchWeatherUndergroundStation(weatherUndergroundConfig("barnardsville-craggy-north-flank"));
}

async function fetchBurnsvilleHighRidge() {
  return fetchWeatherUndergroundStation(weatherUndergroundConfig("burnsville-northern-high-country"));
}

async function fetchLaurelRidge() {
  return fetchWeatherUndergroundStation(weatherUndergroundConfig("laurel-ridge-craggy-south-flank"));
}

async function fetchMountainAirComposite() {
  const components = await Promise.all([
    fetchWeatherUndergroundStation(weatherUndergroundConfig("mountain-air-runway-14")),
    fetchWeatherUndergroundStation(weatherUndergroundConfig("mountain-air-runway-32"))
  ]);
  const observedTimes = components.map((component) => Date.parse(component.observedAt)).filter(Number.isFinite);
  return {
    source: "Weather Underground composite",
    id: "mountain-air-ridge-composite",
    stationId: "KNCBURNS29+KNCBURNS30",
    componentStationIds: components.map((component) => component.stationId),
    name: "Mountain Air Ridge Composite",
    role: "regional exposed high-country cross-check",
    elevationFt: Math.round(averageFinite(components.map((component) => component.elevationFt))),
    url: "https://www.wunderground.com/dashboard/pws/KNCBURNS29",
    lat: averageFinite(components.map((component) => component.lat)),
    lon: averageFinite(components.map((component) => component.lon)),
    status: "live",
    observedAt: new Date(Math.min(...observedTimes)).toISOString(),
    conditions: "Composite current conditions",
    temperatureF: averageFinite(components.map((component) => component.temperatureF)),
    feelsLikeF: averageFinite(components.map((component) => component.feelsLikeF)),
    dewPointF: averageFinite(components.map((component) => component.dewPointF)),
    humidityPct: averageFinite(components.map((component) => component.humidityPct)),
    windMph: averageFinite(components.map((component) => component.windMph)),
    gustMph: maxFinite(components.map((component) => component.gustMph)),
    windDirection: null,
    uv: averageFinite(components.map((component) => component.uv)),
    solarWm2: averageFinite(components.map((component) => component.solarWm2)),
    wbgtF: null,
    wetBulbF: null,
    rainTodayIn: averageFinite(components.map((component) => component.rainTodayIn)),
    rainRateInHr: averageFinite(components.map((component) => component.rainRateInHr)),
    pressureTrend: null
  };
}

function averageFinite(values) {
  const usable = values.filter(Number.isFinite);
  return usable.length ? usable.reduce((sum, value) => sum + value, 0) / usable.length : null;
}

function maxFinite(values) {
  const usable = values.filter(Number.isFinite);
  return usable.length ? Math.max(...usable) : null;
}

function weatherUndergroundConfig(id) {
  const station = STATION_BY_ID.get(id);
  if (!station || station.provider !== "wunderground") throw new Error(`Weather Underground registry station not found: ${id}`);
  return { id: station.id, stationId: station.providerStationId, name: station.name, role: station.role, elevationFt: station.elevationFt, url: station.url };
}

async function withFallback(fetcher, id, previousById) {
  try {
    return await fetcher();
  } catch (error) {
    const previous = previousById.get(id);
    if (previous) {
      return { ...previous, status: "stale", error: error.message };
    }
    return { id, name: id, status: "unavailable", error: error.message };
  }
}

function spread(stations) {
  const temps = stations.map((s) => s.temperatureF).filter((v) => v != null);
  return temps.length ? Math.max(...temps) - Math.min(...temps) : null;
}

function analyze(stations) {
  const usable = stations.filter((s) => s.temperatureF != null);
  const asheville = stations.filter((s) => ashevilleStationIds.has(s.id));
  const localTempSpread = spread(asheville);
  const highs = stations.filter((s) => s.id === "tempest-160562" || s.id === "tempest-157700");
  const highStationSpread = spread(highs);
  const lower = stations.find((s) => s.id === "tempest-144737");
  const high = highs.find((s) => s.temperatureF != null);
  const mitchell = stations.find((s) => s.id === "mount-mitchell");
  const localAvg = asheville.filter((s) => s.temperatureF != null).reduce((sum, s, _, arr) => sum + s.temperatureF / arr.length, 0);
  const lapseRate = lower?.temperatureF != null && high?.temperatureF != null
    ? (lower.temperatureF - high.temperatureF) / ((high.elevationFt - lower.elevationFt) / 1000)
    : null;
  const mitchellDrop = localAvg && mitchell?.temperatureF != null ? localAvg - mitchell.temperatureF : null;
  const wncLapseRate = lower?.temperatureF != null && mitchell?.temperatureF != null
    ? (lower.temperatureF - mitchell.temperatureF) / ((mitchell.elevationFt - lower.elevationFt) / 1000)
    : null;
  const dewSpreads = usable.map((s) => s.temperatureF - s.dewPointF).filter((v) => Number.isFinite(v));
  const minDewSpread = dewSpreads.length ? Math.min(...dewSpreads) : null;
  const maxUv = Math.max(...usable.map((s) => s.uv ?? uvFromSolar(s.solarWm2) ?? 0));
  const maxSolar = Math.max(...usable.map((s) => s.solarWm2 ?? 0));
  const maxGust = Math.max(...usable.map((s) => s.gustMph ?? s.windMph ?? 0));
  const maxTemp = Math.max(...usable.map((s) => s.temperatureF ?? -Infinity));
  const maxWbgt = Math.max(...usable.map((s) => s.wbgtF ?? -Infinity));
  const maxRainRate = Math.max(...usable.map((s) => s.rainRateInHr ?? 0));
  const maxRainToday = Math.max(...usable.map((s) => s.rainTodayIn ?? 0));
  const lightningStations = stations.filter((s) => s.source === "Tempest" && hasLightningSignal(s));
  const nearestLightningStation = lightningStations
    .slice()
    .sort((a, b) => (a.lightningLastDistanceMiles ?? Infinity) - (b.lightningLastDistanceMiles ?? Infinity))[0] || null;
  const lightningActive = lightningStations.length > 0;
  const lightningCounts1h = lightningStations.reduce((sum, station) => sum + (station.lightningStrikes1h ?? 0), 0);
  const lightningCounts3h = lightningStations.reduce((sum, station) => sum + (station.lightningStrikes3h ?? 0), 0);
  const lightningDetails = lightningDetail(nearestLightningStation);
  const fogRisk = minDewSpread == null ? "Unknown" : minDewSpread <= 4 ? "Elevated" : minDewSpread <= 8 ? "Patchy pockets" : "Low";
  const overall = lightningActive
    ? "Lightning nearby, avoid exposed terrain"
    : maxTemp >= 84 || maxWbgt >= 78
      ? "Warm, choose shade"
      : maxUv >= 7
        ? "Good, watch sun"
        : maxGust >= 25
          ? "Good, watch wind"
          : "Good for most hikes";
  const bestWindow = lightningActive
    ? "Stay off exposed ridges, balds, summits, and open slopes until the lightning signal clears."
    : maxTemp >= 78 || maxUv >= 7
      ? "Forest shade is the friendliest choice; open ridges and pavement will feel warmer."
      : fogRisk === "Elevated"
        ? "Good overall, but expect damp pockets, wet leaves, or low cloud early."
        : "Most nearby trails look friendly, with normal mountain checks.";
  const hikerNarrative = lightningActive
    ? `Tempest lightning may be in the vicinity of your hike. ${nearestLightningStation ? `${nearestLightningStation.name} reported ${lightningDetails || "a recent lightning signal"}.` : "A nearby Tempest station reported a recent lightning signal."} Stay alert and avoid exposed ridges, balds, summits, and open slopes until the signal clears.`
    : `If you are heading out, Asheville-area trails look ${overall.toLowerCase()}. The nearby readings sit within about ${f(localTempSpread, "degF")} of each other, so elevation alone may not change the feel very much. The two high Asheville readings ${highStationSpread != null && highStationSpread >= 4 ? "differ enough to show local microclimates at work" : "are telling a similar ridge story"}, which means shade, slope, and open exposure still matter. Mount Mitchell is about ${f(mitchellDrop, "degF")} cooler than the Asheville-area readings, so high-peak hikes deserve an extra layer and a separate comfort check. ${fogRisk === "Elevated" ? "Moisture is close enough for fog, low cloud, or wet leaves in sheltered spots." : "Fog is not the main signal right now."} ${maxSolar >= 500 || maxUv >= 5 ? "Open routes need sun awareness and steady water; forested trails should feel more forgiving." : "Sun exposure is manageable, especially under canopy."}`;
  const scoreInput = {
    localTempSpread: round(localTempSpread, 1),
    mitchellDrop: round(mitchellDrop, 1),
    fogRisk,
    maxUv: maxUv === -Infinity ? null : maxUv,
    maxSolar: maxSolar === -Infinity ? null : round(maxSolar),
    maxGust: maxGust === -Infinity ? null : round(maxGust, 1),
    maxTemp: maxTemp === -Infinity ? null : round(maxTemp, 1),
    maxWbgt: maxWbgt === -Infinity ? null : round(maxWbgt, 1),
    maxRainRate: maxRainRate === -Infinity ? null : round(maxRainRate, 2),
    maxRainToday: maxRainToday === -Infinity ? null : round(maxRainToday, 2),
    lightning: { active: lightningActive }
  };
  const scoreResult = hikerScore(scoreInput);
  const scoreLabel = hikerScoreLabel(scoreResult.score, lightningActive);
  const bullets = [
    lightningActive
      ? `Lightning alert: ${nearestLightningStation ? nearestLightningStation.name : "Tempest"} reports nearby lightning. Stay off exposed terrain.`
      : `${overall}: ${bestWindow}`,
    localTempSpread == null ? "Local temperature spread unavailable." : `Asheville-area spread is about ${f(localTempSpread, "degF")}.`,
    highStationSpread != null && highStationSpread >= 4 ? "High Asheville readings show a microclimate split." : "High Asheville readings broadly agree.",
    mitchellDrop == null ? "Mount Mitchell comparison unavailable." : `Mount Mitchell is about ${f(mitchellDrop, "degF")} cooler than the Asheville-area readings.`,
    fogRisk === "Elevated" ? "Fog/low cloud or damp vegetation may linger in pockets." : "Fog risk is not the lead concern.",
    maxGust >= 20 ? "Wind matters on exposed terrain." : "Wind is light at the reporting sites.",
    maxUv >= 5 || maxSolar >= 500 ? "Sun exposure matters on open routes." : "Sun exposure is manageable right now."
  ];
  return {
    overall,
    bestWindow,
    hikerNarrative,
    bullets,
    hikerScore: scoreResult.score,
    hikerScoreLabel: scoreLabel,
    hikerScoreFactors: scoreResult.factors,
    localTempSpread: round(localTempSpread, 1),
    highStationSpread: round(highStationSpread, 1),
    lapseRate: round(lapseRate, 1),
    mitchellDrop: round(mitchellDrop, 1),
    wncLapseRate: round(wncLapseRate, 1),
    fogRisk,
    maxUv: maxUv === -Infinity ? null : maxUv,
    maxSolar: maxSolar === -Infinity ? null : round(maxSolar),
    maxGust: maxGust === -Infinity ? null : round(maxGust, 1),
    maxTemp: maxTemp === -Infinity ? null : round(maxTemp, 1),
    maxWbgt: maxWbgt === -Infinity ? null : round(maxWbgt, 1),
    maxRainRate: maxRainRate === -Infinity ? null : round(maxRainRate, 2),
    maxRainToday: maxRainToday === -Infinity ? null : round(maxRainToday, 2),
    lightning: {
      active: lightningActive,
      stationName: nearestLightningStation?.name ?? null,
      details: lightningDetails,
      lastDistanceMiles: nearestLightningStation?.lightningLastDistanceMiles ?? null,
      lastDistanceMsg: nearestLightningStation?.lightningLastDistanceMsg ?? null,
      lastObservedAt: nearestLightningStation?.lightningLastEpoch ?? null,
      strikeCount1h: lightningCounts1h,
      strikeCount3h: lightningCounts3h,
      summary: lightningActive
        ? `Tempest lightning may be in the vicinity of the hike. ${nearestLightningStation?.name ? `${nearestLightningStation.name} is the closest lightning signal.` : ""} Stay alert and avoid exposed ridges, balds, summits, and open slopes until the signal clears.`
        : "No nearby Tempest lightning signal is active right now."
    }
  };
}

function renderHtml(payload) {
  const s = payload.stations;
  const g = payload.guidance;
  const lightningActive = Boolean(g.lightning?.active);
  const sortedStations = [...s].sort((a, b) => a.elevationFt - b.elevationFt);
  const diagnostics = [
    ["Local spread", f(g.localTempSpread, "degF"), "Temperature range across the Asheville-area readings."],
    ["High split", f(g.highStationSpread, "degF"), "Difference between the two high Asheville readings."],
    ["Mitchell drop", f(g.mitchellDrop, "degF"), "Cooling from Asheville-area readings to Mount Mitchell."],
    ["Fog risk", g.fogRisk, "Based on the tightest temperature/dew point spread."],
    ["Highest UV", f(g.maxUv), "Peak UV reading or estimate from the reporting sites."],
    ["Peak gust", f(g.maxGust, " mph"), "Highest gust among the reporting sites."]
  ];
  const trailCards = [
    lightningActive
      ? ["Best bet", "Sheltered low-elevation routes only if you must go; exposed terrain is a no-go until the lightning clears."]
      : ["Best bet", g.maxUv >= 5 || g.maxSolar >= 500 ? "Forested trails, shaded slopes, and routes with easy water breaks." : "Most nearby trails should feel comfortable."],
    lightningActive
      ? ["Use care", "Open ridges, balds, summits, overlooks, and pavement are the places to avoid."]
      : ["Use care", g.maxUv >= 5 || g.maxSolar >= 500 ? "Open ridges, overlooks, pavement, and exposed rock." : "Typical mountain exposure: changing clouds, damp pockets, and breezy gaps."],
    ["Pack mindset", g.mitchellDrop >= 10 ? "Water and sun protection locally; add a layer for high peaks." : "Water, basic sun protection, and normal mountain layers."]
  ];
  const comparisonCards = [
    ["Mountain vs Asheville", g.mitchellDrop == null ? "Mount Mitchell comparison is unavailable right now." : `Mount Mitchell is about ${f(g.mitchellDrop, "degF")} cooler than the Asheville-area readings.`],
    ["Ridge vs Valley", g.highStationSpread != null && g.highStationSpread >= 4 ? "Nearby ridge readings show a microclimate split, so shade, slope, and exposure still matter." : "High Asheville readings broadly agree, but exposed ridges can still change the feel."],
    ["Sun exposure", g.maxUv >= 5 || g.maxSolar >= 500 ? "Open overlooks, rock, and pavement need sun awareness and steady water." : "Sun exposure is manageable now, especially under canopy."],
    ["Wind check", g.maxGust >= 20 ? "Wind matters on exposed terrain and higher gaps." : "Wind is light at the reporting sites, so comfort is mostly about sun, shade, and layers."]
  ];
  const score = Number.isFinite(g.hikerScore) ? g.hikerScore : hikerScore(g).score;
  const scoreLabel = g.hikerScoreLabel || hikerScoreLabel(score, lightningActive);
  const tldrBullets = [
    lightningActive ? "Tempest lightning is nearby. Avoid exposed terrain until the signal clears." : g.bestWindow,
    g.localTempSpread == null ? "Local temperature spread unavailable." : `Asheville-area spread is about ${f(g.localTempSpread, "degF")}.`,
    g.mitchellDrop == null ? "Mount Mitchell comparison unavailable." : `Mount Mitchell is about ${f(g.mitchellDrop, "degF")} cooler than Asheville.`,
    g.maxGust >= 20 ? "Wind matters on exposed terrain." : "Wind is light; sun exposure is the main watch item."
  ];
  const profileXs = sortedStations.map((_, index) => 145 + index * (810 / Math.max(1, sortedStations.length - 1)));
  const profileLabelLines = (name) => ({
    "High Asheville East": ["High Asheville", "East"],
    "High Asheville North": ["High Asheville", "North"],
    "Waynesville / Haywood Valley": ["Waynesville", "Valley"],
    "Black Mountain / Swannanoa Valley": ["Black Mountain", "Valley"],
    "Southern Haywood / Pisgah Approach West": ["Pisgah", "West"],
    "Southern Haywood / Pisgah Approach East": ["Pisgah", "East"],
    "Mount Mitchell East Slope / Alpine Village": ["Mitchell", "East Slope"],
    "Western Pisgah High Shoulder": ["Western Pisgah", "Shoulder"],
    "Barnardsville / Craggy North Flank": ["Craggy", "North"],
    "Burnsville Northern High Country": ["Burnsville", "High Country"],
    "Laurel Ridge / Craggy South Flank": ["Laurel Ridge", "Craggy"],
    "Mountain Air Ridge Composite": ["Mountain Air", "Ridge"],
    "Frying Pan / Pisgah Ridgeline": ["Frying Pan", "Pisgah"],
    "Mount Mitchell": ["Mount", "Mitchell"]
  }[name] || [name]);
  const profileBottomName = (name) => ({
    "Waynesville / Haywood Valley": "Waynesville",
    "Black Mountain / Swannanoa Valley": "Black Mtn",
    "Southern Haywood / Pisgah Approach West": "Pisgah W",
    "Southern Haywood / Pisgah Approach East": "Pisgah E",
    "Mount Mitchell East Slope / Alpine Village": "Mitchell E",
    "Western Pisgah High Shoulder": "W Pisgah",
    "Barnardsville / Craggy North Flank": "Craggy N",
    "Burnsville Northern High Country": "Burnsville",
    "Laurel Ridge / Craggy South Flank": "Laurel",
    "Mountain Air Ridge Composite": "Mt Air",
    "Frying Pan / Pisgah Ridgeline": "Frying Pan"
  }[name] || name.replace(" Weather Tower", "").replace("Asheville ", ""));
  const profileStations = sortedStations.map((x, index) => {
    const y = Math.round(440 - ((x.elevationFt - 1000) / 6000) * 320);
    const nameLines = profileLabelLines(x.name);
    const zone = x.elevationFt >= 6000 ? "WNC high peak" : x.elevationFt >= 3200 ? "High Asheville ridge" : x.elevationFt >= 2300 ? "Mid Asheville" : "Lower Asheville";
    return { ...x, x: profileXs[index] ?? 900, y, nameLines, zone };
  });
  const ridgePath = profileStations.map((x, index) => `${index === 0 ? "M" : "L"} ${x.x} ${x.y}`).join(" ");
  const areaPath = `${ridgePath} L 1065 450 L 55 450 Z`;
  const lightningBanner = g.lightning?.active ? `
    <section class="lightning-banner" role="alert" aria-live="assertive">
      <div class="lightning-mark" aria-hidden="true">⚡</div>
      <div class="lightning-copy">
        <div class="lightning-kicker">Lightning alert</div>
        <h2>Tempest lightning may be in the vicinity of your hike</h2>
        <p>${htmlValue(g.lightning.summary)}</p>
        ${g.lightning.details ? `<div class="lightning-meta">${htmlValue(g.lightning.details)}</div>` : ""}
      </div>
    </section>
  ` : "";
  const elevationProfile = profileStations.map((x, index) => {
    const labelY = x.name === "Mount Mitchell" ? 28 : [72, 126, 180, 234][index % 4];
    const bottomName = profileBottomName(x.name);
    return `<g class="profile-site">
      <line class="profile-stem" x1="${x.x}" y1="${x.y + 13}" x2="${x.x}" y2="450" />
      <line class="profile-label-stem" x1="${x.x}" y1="${Math.max(46, labelY + 8)}" x2="${x.x}" y2="${Math.max(46, x.y - 15)}" />
      <circle class="profile-dot" cx="${x.x}" cy="${x.y}" r="10" />
      <text class="profile-label" x="${x.x}" y="${labelY}" text-anchor="middle">
        ${x.nameLines.map((line, i) => `<tspan x="${x.x}" dy="${i === 0 ? 0 : 20}">${esc(line)}</tspan>`).join("")}
      </text>
      <text class="profile-elev" x="${x.x}" y="${labelY + (x.nameLines.length * 20) + 14}" text-anchor="middle">${f(x.elevationFt, " ft")}</text>
      <circle class="profile-base-dot" cx="${x.x}" cy="450" r="4" />
      <text class="profile-bottom-name" x="${x.x}" y="480" text-anchor="middle">${esc(bottomName)}</text>
      <text class="profile-bottom-temp" x="${x.x}" y="505" text-anchor="middle">${f(x.temperatureF, "°")}</text>
    </g>`;
  }).join("");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>828 Hiking Guidance</title>
  <link rel="stylesheet" href="css/hiking.css?v=${Date.now()}" />
</head>
<body>
  <header class="hiking-header">
    <div>
      <div class="brand-title">828 Hiking Guidance</div>
      <div class="brand-sub">Elevation-aware trail weather for Asheville and the WNC high peaks</div>
    </div>
    <div class="status-pill">${esc(g.overall)}</div>
  </header>

  <main class="hiking-wrap">
    ${lightningBanner}
    <section class="hikerscore-hero panel panel-read ${g.lightning?.active ? "panel-lightning" : ""}">
      <div class="hikerscore-main">
        <div class="kicker">HikerScore</div>
        <div class="score-row">
          <div class="score-badge">
            <strong>${score}</strong>
            <span>${esc(scoreLabel)}</span>
          </div>
          <div class="score-copy">
            <div class="status-pill hero-status">${esc(g.lightning?.active ? "Lightning alert" : "Good, watch sun")}</div>
            <h1>${esc(g.bestWindow)}</h1>
          </div>
        </div>

        <div class="stat-chip-row" aria-label="Quick hiking stats">
          <div class="stat-chip"><span>Asheville spread</span><strong>${htmlValue(f(g.localTempSpread, "degF"))}</strong></div>
          <div class="stat-chip"><span>Mitchell drop</span><strong>${htmlValue(f(g.mitchellDrop, "degF"))}</strong></div>
          <div class="stat-chip"><span>Peak UV</span><strong>${esc(f(g.maxUv))}</strong></div>
        </div>

        <details class="hiker-details">
          <summary>Full hiker read</summary>
          <p>${htmlValue(g.hikerNarrative)}</p>
        </details>

        <div class="meta">Updated ${localTime(payload.generatedAt)} &middot; ${s.filter((x) => x.status === "live").length}/${s.length} readings live</div>
      </div>

      <aside class="tldr-card">
        <div class="kicker">TL;DR</div>
        <ul>${tldrBullets.map((b) => `<li>${htmlValue(b)}</li>`).join("")}</ul>
      </aside>
    </section>

    <section class="panel panel-choice">
      <div class="section-title"><span>Trail choice</span><h2>What this means on foot</h2></div>
      <div class="trail-grid trail-grid-three">${trailCards.map(([a, b]) => `<div class="mini-card"><strong>${esc(a)}</strong><span>${esc(b)}</span></div>`).join("")}</div>
    </section>

    <section class="panel panel-profile">
      <div class="section-title"><span>Where these readings are</span><h2>Elevation profile</h2></div>
      <p class="profile-intro">A quick visual of the reporting sites, from lower Asheville up to Mount Mitchell. This helps explain what "high Asheville" and "high peaks" mean in the trail guidance.</p>
      <div class="profile-art" role="img" aria-label="Elevation profile of Asheville-area weather readings up to Mount Mitchell">
        <svg viewBox="0 0 1080 540" preserveAspectRatio="xMidYMid meet">
          <defs>
            <linearGradient id="profileFill" x1="0" x2="1" y1="1" y2="0">
              <stop offset="0%" stop-color="#5bd27c" />
              <stop offset="52%" stop-color="#4eb4c8" />
              <stop offset="100%" stop-color="#357cff" />
            </linearGradient>
          </defs>
          <rect class="profile-bg" x="0" y="0" width="1080" height="540" rx="22" />
          <text class="profile-axis-title" x="96" y="90">ELEVATION (FT)</text>
          <line class="profile-axis" x1="94" y1="220" x2="94" y2="450" />
          ${[7000,6000,5000,4000,3000,2000,1000].map((tick) => {
            const y = Math.round(450 - ((tick - 1000) / 6000) * 320);
            return `<g><line class="profile-tick" x1="88" y1="${y}" x2="94" y2="${y}" /><text class="profile-tick-label" x="78" y="${y + 6}" text-anchor="end">${tick.toLocaleString()}</text></g>`;
          }).join("")}
          <path class="profile-area" d="${areaPath}" />
          <path class="profile-ridge" d="${ridgePath}" />
          <path class="profile-forest" d="M55 450 C110 405 158 428 205 392 C246 365 282 414 330 376 C372 344 420 390 468 354 C514 318 556 378 604 328 C650 286 704 354 750 294 C796 232 840 324 886 242 C922 170 948 214 984 112 C1020 158 1046 160 1065 176 L1065 450 Z" />
          ${elevationProfile}
        </svg>
      </div>
    </section>

    <section class="panel panel-compare">
      <div class="section-title"><span>Trail comparisons</span><h2>What changes by route type</h2></div>
      <div class="comparison-grid">${comparisonCards.map(([a, b]) => `<div class="comparison-card"><strong>${esc(a)}</strong><span>${htmlValue(b)}</span></div>`).join("")}</div>
    </section>

    <section class="panel panel-data">
      <div class="section-title"><span>Important hiker data</span><h2>Elevation and comfort signals</h2></div>
      <div class="diagnostic-grid">${diagnostics.map(([a, b, c]) => `<div class="metric-card"><span>${esc(a)}</span><strong>${htmlValue(b)}</strong><p>${esc(c)}</p></div>`).join("")}</div>
    </section>

    <section class="panel panel-table">
      <div class="section-title section-title-row"><span>Station check</span><h2>Current readings by elevation</h2><em>As of ${asOfTime(payload.generatedAt)}</em></div>
      <div class="station-grid">
        ${sortedStations.map((x) => {
          const feel = heatFeel(x);
          return `<a class="station-card" href="${esc(x.url)}">
          <div class="station-card-top">
            <div>
              <strong>${esc(x.name)}</strong>
              <span class="station-elevation">${f(x.elevationFt, " ft")}</span>
            </div>
            <div class="station-temp">${htmlValue(f(x.temperatureF, "°"))}</div>
          </div>
          <div class="station-feel"><span>${esc(feel.label)}</span><strong>${htmlValue(feel.detail)}</strong></div>
          <div class="station-metrics">
            <span><b>Source</b>${esc(x.source)}</span>
            <span><b>Dew</b>${htmlValue(f(x.dewPointF, "°"))}</span>
            <span><b>Humid</b>${f(x.humidityPct, "%")}</span>
            <span><b>Wind</b>${esc(friendlyWind(x))}</span>
            <span><b>UV</b>${esc(displayUv(x))}</span>
          </div>
        </a>`;
        }).join("")}
      </div>
    </section>
  </main>

  <footer class="site-footer">
    <div class="footer-inner">
      <div class="footer-brand">
        <div class="footer-logo">828 Weather Direct</div>
        <div class="footer-tagline">
          Hyper-local weather, written for how it actually feels across Western North Carolina.
        </div>
      </div>

      <div class="footer-links">
        <a href="/">Home</a>
        <a href="/forecast.html">Forecast</a>
        <a href="/hiking.html">Hiking Guidance</a>
        <a href="https://www.linkedin.com/in/timballisty">About</a>
        <a href="mailto:tballisty@gmail.com">Contact</a>
      </div>

      <div class="footer-meta">
        <div>Data: Tempest • Weather Underground • NC ECONet</div>
        <div>Serving Asheville and the greater 828 region</div>
        <div class="footer-disclaimer">
          For general awareness only—not a substitute for official forecasts, warnings, or trail advisories.
        </div>
      </div>

      <div class="footer-bottom">
        &copy; 2026 828 Weather Direct
      </div>
    </div>
  </footer>
</body>
</html>
`;
}

const previous = await readPrevious();
const previousById = new Map((previous?.stations || []).map((s) => [s.id, s]));
if (!weatherFlowKey || !weatherUndergroundKey) {
  throw new Error("Hiking refresh requires WEATHERFLOW_API_KEY and WEATHER_UNDERGROUND_API_KEY before writing a new artifact");
}
const observationPayload = await getElevationObservations({ force: true, fallbackUrl: null });
const observationById = new Map(observationPayload.stations.map((station) => [station.id, station]));
const failureById = new Map(observationPayload.quality.failures.map((failure) => [failure.id, failure]));
const stations = OBSERVATION_STATIONS
  .filter((station) => !station.componentOnly && station.provider !== "composite")
  .map((definition) => {
    const observation = observationById.get(definition.id);
    if (observation) return { ...observation, error: failureById.get(definition.id)?.reason || null };
    const failure = failureById.get(definition.id);
    return {
      id: definition.id,
      stationId: definition.providerStationId,
      provider: definition.provider,
      source: definition.provider,
      name: definition.name,
      role: definition.role,
      elevationFt: definition.elevationFt,
      url: definition.url,
      lat: definition.latitude,
      lon: definition.longitude,
      status: "unavailable",
      error: failure?.reason || "No observation returned"
    };
  });
const composites = observationPayload.stations.filter((station) => station.provider === "composite");
stations.push(...composites);
if (observationPayload.quality.status !== "fresh") {
  throw new Error(`Hiking observation refresh is ${observationPayload.quality.status}: ${observationPayload.quality.failures.length} feed failures; refusing to write a partial artifact`);
}
const payload = {
  generatedAt: new Date().toISOString(),
  stations,
  guidance: analyzeHikingStations(stations)
};

await fs.mkdir(outDir, { recursive: true });
await fs.writeFile(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(`Updated ${path.relative(root, jsonPath)}; live hiking page reads this data client-side.`);
