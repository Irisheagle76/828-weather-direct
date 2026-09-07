import { normalizeTempestDeviceObservation } from "../tempest/normalize-observation.js";

const MPH_PER_MS = 2.2369362921;
const INCHES_PER_MM = 1 / 25.4;
const MB_PER_INHG = 33.8638866667;

export async function fetchStationObservation(station, options = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const env = options.env ?? process.env;
  const timeoutMs = options.timeoutMs ?? 10_000;

  switch (station.source.provider) {
    case "tempest":
      return fetchTempest(station, { fetchImpl, env, timeoutMs });
    case "wunderground":
      return fetchWunderground(station, { fetchImpl, env, timeoutMs });
    case "ncei":
      return fetchNcei(station, { fetchImpl, timeoutMs });
    case "econet":
      return fetchEconet(station, { fetchImpl, timeoutMs });
    default:
      throw new ObservationSourceError("unsupported_provider", `Provider ${station.source.provider} is not configured`);
  }
}

export async function fetchTempest(station, { fetchImpl = fetch, env = process.env, timeoutMs = 10_000 } = {}) {
  const token = env.TEMPEST_TOKEN;
  const apiKey = env.WEATHERFLOW_API_KEY;
  if (!token && !apiKey) throw new ObservationSourceError("missing_credentials", "Tempest credentials are not configured");

  if (!token) {
    const url = new URL("https://swd.weatherflow.com/swd/rest/better_forecast");
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("station_id", station.source.stationId);
    url.searchParams.set("units_temp", "f");
    url.searchParams.set("units_wind", "mph");
    url.searchParams.set("units_pressure", "mb");
    url.searchParams.set("units_distance", "mi");
    url.searchParams.set("units_precip", "in");
    const json = await fetchJson(url, { fetchImpl, timeoutMs });
    const current = json?.current_conditions;
    if (!current) throw new ObservationSourceError("empty_observation", "Tempest returned no current observation");
    return normalizeWeatherFlowForecast(current);
  }

  const url = new URL(`https://swd.weatherflow.com/swd/rest/observations/station/${encodeURIComponent(station.source.stationId)}`);
  url.searchParams.set("token", token);
  const json = await fetchJson(url, { fetchImpl, timeoutMs });
  const obs = json?.obs?.[0];
  if (!obs || typeof obs !== "object") throw new ObservationSourceError("empty_observation", "Tempest returned no station observation");
  return normalizeTempest(obs);
}

export async function fetchWunderground(station, { fetchImpl = fetch, env = process.env, timeoutMs = 10_000 } = {}) {
  const apiKey = env.WEATHER_UNDERGROUND_API_KEY ?? env.WU_API_KEY;
  if (!apiKey) throw new ObservationSourceError("missing_credentials", "Weather Underground credentials are not configured");

  const url = new URL("https://api.weather.com/v2/pws/observations/current");
  url.searchParams.set("stationId", station.source.stationId);
  url.searchParams.set("format", "json");
  url.searchParams.set("units", "e");
  url.searchParams.set("numericPrecision", "decimal");
  url.searchParams.set("apiKey", apiKey);
  const json = await fetchJson(url, { fetchImpl, timeoutMs });
  const obs = json?.observations?.[0];
  if (!obs) throw new ObservationSourceError("empty_observation", "Weather Underground returned no current observation");
  return normalizeWunderground(obs);
}

export function normalizeWeatherFlowForecast(current) {
  const seaLevelPressureMb = finite(current.sea_level_pressure);
  const stationPressureMb = finite(current.station_pressure);
  return compactObservation({
    observedAt: unixSecondsToIso(current.time),
    temperatureF: finite(current.air_temperature),
    dewPointF: finite(current.dew_point),
    humidityPct: finite(current.relative_humidity),
    windMph: finite(current.wind_avg),
    windGustMph: finite(current.wind_gust),
    windDirectionDeg: finite(current.wind_direction),
    seaLevelPressureMb,
    stationPressureMb,
    pressureDatum: seaLevelPressureMb != null ? "sea_level" : stationPressureMb != null ? "station" : null,
    precipitationRateInHr: finite(current.precip_rate),
    precipitationTodayIn: finite(current.precip_accum_local_day),
    solarRadiationWm2: finite(current.solar_radiation),
    uvIndex: finite(current.uv),
    lightningStrikeDistanceMi: finite(current.lightning_strike_last_distance),
    lightningStrikeCount: finite(current.lightning_strike_count_last_1hr)
  });
}

export async function fetchNcei(station, { fetchImpl = fetch, timeoutMs = 10_000 } = {}) {
  const json = await fetchJson(station.source.endpoint, { fetchImpl, timeoutMs });
  const sensorData = json?.sensors
    ?.flatMap((sensor) => sensor?.data ?? [])
    ?.find((data) => Number.isFinite(Number(data?.temp_out)));
  if (!sensorData) throw new ObservationSourceError("empty_observation", "NCEI returned no Grove Arcade observation");
  return normalizeNcei(sensorData);
}

export async function fetchEconet(station, { fetchImpl = fetch, timeoutMs = 10_000 } = {}) {
  const url = new URL("https://econet.climate.ncsu.edu/m/current/currentconditions.php");
  url.searchParams.set("station", station.source.stationId);
  const json = await fetchJson(url, { fetchImpl, timeoutMs });
  if (!json?.ob_et && !json?.ob) throw new ObservationSourceError("empty_observation", "ECONet returned no current observation");
  return normalizeEconet(json);
}

export function normalizeTempest(obs) {
  const normalized = normalizeTempestDeviceObservation(obs);
  const seaLevelPressureMb = finite(normalized.sea_level_pressure ?? normalized.pressure);
  const stationPressureMb = finite(normalized.station_pressure);
  return compactObservation({
    observedAt: timestampToIso(normalized.timestamp),
    temperatureF: cToF(normalized.air_temperature),
    dewPointF: cToF(normalized.dew_point),
    humidityPct: finite(normalized.relative_humidity),
    windMph: multiply(normalized.wind_avg, MPH_PER_MS),
    windGustMph: multiply(normalized.wind_gust, MPH_PER_MS),
    windDirectionDeg: finite(normalized.wind_direction),
    seaLevelPressureMb,
    stationPressureMb,
    pressureDatum: seaLevelPressureMb != null ? "sea_level" : stationPressureMb != null ? "station" : null,
    precipitationRateInHr: multiply(normalized.precipRate, INCHES_PER_MM),
    precipitationTodayIn: multiply(normalized.precipAccumLocalDay, INCHES_PER_MM),
    solarRadiationWm2: finite(normalized.solar_radiation),
    uvIndex: finite(normalized.uv),
    lightningStrikeDistanceMi: multiply(normalized.lightningStrikeDistance, 0.621371),
    lightningStrikeCount: finite(normalized.lightningStrikeCount)
  });
}

export function normalizeWunderground(obs) {
  const units = obs.imperial ?? {};
  const reportedPressureMb = multiply(units.pressure, MB_PER_INHG);
  return compactObservation({
    observedAt: obs.obsTimeUtc ?? unixSecondsToIso(obs.epoch),
    temperatureF: finite(units.temp),
    dewPointF: finite(units.dewpt),
    humidityPct: finite(obs.humidity),
    windMph: finite(units.windSpeed),
    windGustMph: finite(units.windGust),
    windDirectionDeg: finite(obs.winddir),
    reportedPressureMb,
    pressureDatum: reportedPressureMb == null ? null : "ambiguous",
    precipitationRateInHr: finite(units.precipRate),
    precipitationTodayIn: finite(units.precipTotal),
    solarRadiationWm2: finite(obs.solarRadiation),
    uvIndex: finite(obs.uv),
    providerQcStatus: obs.qcStatus ?? null
  });
}

export function normalizeNcei(data) {
  const seaLevelPressureMb = multiply(data.bar, MB_PER_INHG);
  const stationPressureMb = multiply(data.bar_absolute, MB_PER_INHG);
  return compactObservation({
    observedAt: unixSecondsToIso(data.ts),
    temperatureF: finite(data.temp_out),
    dewPointF: finite(data.dew_point),
    humidityPct: finite(data.hum_out),
    windMph: finite(data.wind_speed),
    windGustMph: finite(data.wind_gust_10_min),
    windDirectionDeg: finite(data.wind_dir),
    seaLevelPressureMb,
    stationPressureMb,
    pressureDatum: seaLevelPressureMb != null ? "sea_level" : stationPressureMb != null ? "station" : null,
    precipitationRateInHr: finite(data.rain_rate_in),
    precipitationTodayIn: finite(data.rain_day_in),
    precipitationLastHourIn: finite(data.rain_60_min_in),
    precipitation24HourIn: finite(data.rain_24_hr_in),
    solarRadiationWm2: finite(data.solar_rad),
    uvIndex: finite(data.uv)
  });
}

export function normalizeEconet(data) {
  const stationPressureMb = finite(data.pres);
  return compactObservation({
    observedAt: parseEconetTimestamp(data.ob_et ?? data.ob),
    temperatureF: finite(data.temp),
    dewPointF: finite(data.dew),
    humidityPct: finite(data.rh),
    windMph: finite(data.ws),
    windGustMph: finite(data.gust),
    windDirectionDeg: finite(data.wd),
    stationPressureMb,
    pressureDatum: stationPressureMb == null ? null : "station",
    precipitationLastHourIn: finite(data.precip),
    precipitation24HourIn: finite(data.precip_24h),
    precipitation7DayIn: finite(data.precip_7d),
    solarRadiationWm2: finite(data.sr),
    wetBulbGlobeTemperatureF: finite(data.wbgt),
    providerQcStatus: data.active === 1 ? "active" : "inactive"
  });
}

async function fetchJson(url, { fetchImpl, timeoutMs }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      signal: controller.signal,
      headers: { accept: "application/json", "user-agent": "avlweather.com Asheville Spread/1.0" }
    });
    if (!response.ok) throw new ObservationSourceError("upstream_http", `Observation source returned HTTP ${response.status}`, response.status);
    return await response.json();
  } catch (error) {
    if (error?.name === "AbortError") throw new ObservationSourceError("upstream_timeout", "Observation source timed out");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function compactObservation(values) {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, round(value)]));
}

function finite(value) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function multiply(value, factor) {
  const number = finite(value);
  return number == null ? null : number * factor;
}

function round(value) {
  return typeof value === "number" && Number.isFinite(value) ? Number(value.toFixed(3)) : value ?? null;
}

function cToF(value) {
  const celsius = finite(value);
  return celsius == null ? null : (celsius * 9) / 5 + 32;
}

function unixSecondsToIso(value) {
  const seconds = finite(value);
  return seconds == null ? null : new Date(seconds * 1000).toISOString();
}

function timestampToIso(value) {
  const timestamp = finite(value);
  if (timestamp == null) return null;
  const date = new Date(timestamp < 1e12 ? timestamp * 1000 : timestamp);
  return Number.isNaN(date.valueOf()) ? null : date.toISOString();
}

function parseEconetTimestamp(value) {
  if (!value) return null;
  const normalized = String(value).includes("T") ? String(value) : String(value).replace(" ", "T");
  if (/(?:Z|[+-]\d\d:?\d\d)$/.test(normalized)) {
    const date = new Date(normalized);
    return Number.isNaN(date.valueOf()) ? null : date.toISOString();
  }

  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/);
  if (!match) return null;
  const [, year, month, day, hour, minute, second] = match.map(Number);
  const localAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  let timestamp = localAsUtc - timeZoneOffsetMs(localAsUtc, "America/New_York");
  timestamp = localAsUtc - timeZoneOffsetMs(timestamp, "America/New_York");
  const date = new Date(timestamp);
  return Number.isNaN(date.valueOf()) ? null : date.toISOString();
}

function timeZoneOffsetMs(timestamp, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(new Date(timestamp));
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
  return Date.UTC(values.year, values.month - 1, values.day, values.hour, values.minute, values.second) - timestamp;
}

function deriveDewPointC(tempValue, humidityValue) {
  const tempC = finite(tempValue);
  const humidity = finite(humidityValue);
  if (tempC == null || humidity == null || humidity <= 0) return null;
  const a = 17.27;
  const b = 237.7;
  const alpha = (a * tempC) / (b + tempC) + Math.log(humidity / 100);
  return (b * alpha) / (a - alpha);
}

export class ObservationSourceError extends Error {
  constructor(code, message, upstreamStatus = null) {
    super(message);
    this.name = "ObservationSourceError";
    this.code = code;
    this.upstreamStatus = upstreamStatus;
  }
}
