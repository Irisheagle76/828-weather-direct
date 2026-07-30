import { WATERFALLS, RIVERS } from "../../public/js/water/water-data.js";

const ASHEVILLE = {
  id: "asheville-weather-context",
  lat: 35.5951,
  lon: -82.5515
};

const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";
const MRMS_QPE_URL = "https://mapservices.weather.noaa.gov/raster/rest/services/obs/mrms_qpe/ImageServer/getSamples";
const USGS_IV_URL = "https://waterservices.usgs.gov/nwis/iv/";
const USGS_STATS_URL = "https://waterservices.usgs.gov/nwis/stat/";
const REQUEST_TIMEOUT_MS = 12_000;

function round(value, digits = 2) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeTimestamp(value) {
  const n = Number(value);
  if (Number.isFinite(n)) return n < 1e12 ? n * 1000 : n;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

export function mrmsMillimetersToInches(value) {
  const millimeters = numberOrNull(value);
  return millimeters !== null && millimeters >= 0 ? round(millimeters / 25.4) : null;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "User-Agent": "828 Weather Direct water conditions (avlweather.com)",
        ...(options.headers || {})
      }
    });
  } finally {
    clearTimeout(timeout);
  }
}

export function buildRainfallWindows(times = [], precipitation = [], nowMs = Date.now()) {
  const windows = [
    ["rain6h", 6],
    ["rain24h", 24],
    ["rain3d", 72],
    ["rain7d", 168],
    ["rain14d", 336]
  ];
  const rows = times.map((time, index) => ({
    time: normalizeTimestamp(time),
    amount: numberOrNull(precipitation[index])
  })).filter((row) =>
    Number.isFinite(row.time) &&
    Number.isFinite(row.amount) &&
    row.time <= nowMs + 15 * 60 * 1000
  );

  if (!rows.length) {
    return {
      available: false,
      source: "Open-Meteo modeled precipitation",
      observedThrough: null
    };
  }

  const result = Object.fromEntries(windows.map(([key, hours]) => {
    const start = nowMs - hours * 60 * 60 * 1000;
    const total = rows.reduce((sum, row) => row.time > start ? sum + Math.max(0, row.amount) : sum, 0);
    return [key, round(total)];
  }));

  return {
    ...result,
    available: true,
    source: "Open-Meteo HRRR/GFS modeled precipitation",
    observedThrough: new Date(Math.max(...rows.map((row) => row.time))).toISOString()
  };
}

function thunderRiskFromForecast(times = [], weatherCodes = [], precipitationProbability = [], nowMs = Date.now()) {
  const end = nowMs + 12 * 60 * 60 * 1000;
  let risk = 0;

  times.forEach((time, index) => {
    const ts = normalizeTimestamp(time);
    if (!Number.isFinite(ts) || ts < nowMs - 60 * 60 * 1000 || ts > end) return;
    const code = Number(weatherCodes[index]);
    const probability = Math.max(0, Math.min(1, Number(precipitationProbability[index] || 0) / 100));
    if ([95, 96, 99].includes(code)) risk = Math.max(risk, 0.55 + probability * 0.4);
    else if ([80, 81, 82].includes(code)) risk = Math.max(risk, probability * 0.45);
    else risk = Math.max(risk, probability * 0.2);
  });

  return round(Math.min(1, risk), 2);
}

function normalizeOpenMeteoResponse(payload) {
  const current = payload?.current || {};
  return {
    rainfall: buildRainfallWindows(
      payload?.hourly?.time || [],
      payload?.hourly?.precipitation || []
    ),
    weather: {
      airTempF: numberOrNull(current.temperature_2m),
      windMph: numberOrNull(current.wind_speed_10m),
      thunderstormRisk: thunderRiskFromForecast(
        payload?.hourly?.time || [],
        payload?.hourly?.weather_code || [],
        payload?.hourly?.precipitation_probability || []
      ),
      observedAt: current.time ? new Date(normalizeTimestamp(current.time)).toISOString() : null,
      source: "Open-Meteo HRRR/GFS weather guidance"
    }
  };
}

async function fetchModeledConditions(locations) {
  const params = new URLSearchParams({
    latitude: locations.map((location) => location.lat).join(","),
    longitude: locations.map((location) => location.lon).join(","),
    hourly: "precipitation,precipitation_probability,weather_code",
    current: "temperature_2m,wind_speed_10m,weather_code",
    past_hours: "336",
    forecast_hours: "12",
    temperature_unit: "fahrenheit",
    wind_speed_unit: "mph",
    precipitation_unit: "inch",
    timeformat: "unixtime",
    timezone: "America/New_York"
  });
  const response = await fetchWithTimeout(`${OPEN_METEO_URL}?${params}`);
  if (!response.ok) throw new Error(`Open-Meteo returned ${response.status}`);
  const payload = await response.json();
  const list = Array.isArray(payload) ? payload : [payload];
  if (list.length !== locations.length) throw new Error("Open-Meteo returned an incomplete location set");
  return Object.fromEntries(locations.map((location, index) => [
    location.id,
    normalizeOpenMeteoResponse(list[index])
  ]));
}

async function fetchMrmsWindow(locations, hours) {
  const geometry = {
    points: locations.map((location) => [location.lon, location.lat]),
    spatialReference: { wkid: 4326 }
  };
  const mosaicRule = {
    mosaicMethod: "esriMosaicAttribute",
    where: `name='conus_QPE_${String(hours).padStart(2, "0")}H'`,
    sortField: "idp_validendtime",
    sortValue: "0",
    ascending: false
  };
  const params = new URLSearchParams({
    geometry: JSON.stringify(geometry),
    geometryType: "esriGeometryMultipoint",
    inSR: "4326",
    returnFirstValueOnly: "true",
    outFields: "name,idp_validendtime",
    mosaicRule: JSON.stringify(mosaicRule),
    f: "json"
  });
  const response = await fetchWithTimeout(`${MRMS_QPE_URL}?${params}`);
  if (!response.ok) throw new Error(`NOAA MRMS returned ${response.status}`);
  const payload = await response.json();
  if (!Array.isArray(payload.samples)) throw new Error("NOAA MRMS returned no samples");

  return Object.fromEntries(payload.samples.map((sample) => {
    const location = locations[Number(sample.locationId)];
    const value = numberOrNull(sample.value);
    const validMs = numberOrNull(sample.attributes?.idp_validendtime);
    return [location?.id, {
      // The raw MRMS mosaic stores liquid accumulation in millimeters.
      value: mrmsMillimetersToInches(value),
      observedThrough: validMs ? new Date(validMs).toISOString() : null
    }];
  }).filter(([id]) => id));
}

async function fetchMrmsRainfall(locations) {
  const [rain6h, rain24h, rain72h] = await Promise.all([
    fetchMrmsWindow(locations, 6),
    fetchMrmsWindow(locations, 24),
    fetchMrmsWindow(locations, 72)
  ]);

  return Object.fromEntries(locations.map((location) => {
    const six = rain6h[location.id];
    const day = rain24h[location.id];
    const threeDays = rain72h[location.id];
    const available = [six?.value, day?.value, threeDays?.value].every(Number.isFinite);
    return [location.id, {
      available,
      rain6h: six?.value ?? null,
      rain24h: day?.value ?? null,
      rain3d: threeDays?.value ?? null,
      observedThrough: threeDays?.observedThrough || day?.observedThrough || six?.observedThrough || null
    }];
  }));
}

function mergeRainfallSources(modeledRainfall, mrmsRainfall) {
  if (!mrmsRainfall?.available) return modeledRainfall;
  const rain6h = Math.max(0, mrmsRainfall.rain6h);
  const rain24h = Math.max(rain6h, mrmsRainfall.rain24h);
  const rain3d = Math.max(rain24h, mrmsRainfall.rain3d);
  const rain7d = Math.max(rain3d, numberOrNull(modeledRainfall?.rain7d) || 0);
  const rain14d = Math.max(rain7d, numberOrNull(modeledRainfall?.rain14d) || 0);
  return {
    rain6h: round(rain6h),
    rain24h: round(rain24h),
    rain3d: round(rain3d),
    rain7d: round(rain7d),
    rain14d: round(rain14d),
    available: true,
    source: "NOAA MRMS radar-estimated rain (6-72h) + Open-Meteo antecedent estimate",
    observedThrough: mrmsRainfall.observedThrough || modeledRainfall?.observedThrough || null
  };
}

function todayEasternParts() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "numeric",
    day: "numeric"
  }).formatToParts(new Date());
  return {
    month: Number(parts.find((part) => part.type === "month")?.value),
    day: Number(parts.find((part) => part.type === "day")?.value)
  };
}

export function parseUSGSInstantaneousValues(payload, nowMs = Date.now()) {
  const byGauge = {};
  const series = payload?.value?.timeSeries || [];

  series.forEach((item) => {
    const gaugeId = item.sourceInfo?.siteCode?.[0]?.value;
    const parameter = item.variable?.variableCode?.[0]?.value;
    const readings = (item.values || []).flatMap((group) => group.value || [])
      .map((reading) => ({
        value: numberOrNull(reading.value),
        time: normalizeTimestamp(reading.dateTime),
        dateTime: reading.dateTime || null
      }))
      .filter((reading) => Number.isFinite(reading.value) && Number.isFinite(reading.time))
      .sort((a, b) => a.time - b.time);
    if (!gaugeId || !parameter || !readings.length) return;

    const latest = readings[readings.length - 1];
    byGauge[gaugeId] ||= { gaugeId, quality: {} };
    const gauge = byGauge[gaugeId];

    if (parameter === "00060") {
      gauge.dischargeCfs = latest.value;
      const target = nowMs - 12 * 60 * 60 * 1000;
      const prior = readings.reduce((best, reading) =>
        Math.abs(reading.time - target) < Math.abs(best.time - target) ? reading : best
      , readings[0]);
      if (prior.value > 0 && Math.abs(prior.time - target) <= 4 * 60 * 60 * 1000) {
        gauge.trend12hPct = round(((latest.value - prior.value) / prior.value) * 100, 1);
        gauge.trendReferenceAt = prior.dateTime;
      }
    }
    if (parameter === "00065") gauge.gaugeHeightFt = latest.value;
    if (parameter === "00010") {
      gauge.waterTempF = (latest.value * 9) / 5 + 32;
      gauge.quality.waterTempF = gauge.waterTempF;
    }
    if (parameter === "00095") gauge.quality.specificConductance = latest.value;
    if (parameter === "00300") gauge.quality.dissolvedOxygen = latest.value;
    if (parameter === "00400") gauge.quality.ph = latest.value;
    if (parameter === "63680" || parameter === "99133") gauge.quality.turbidity = latest.value;
    gauge.observedAt = latest.dateTime || gauge.observedAt;
    gauge.quality.observedAt = latest.dateTime || gauge.quality.observedAt;
  });

  return byGauge;
}

export function parseUSGSDailyMedianStats(text, month, day) {
  const byGauge = {};
  String(text || "").split(/\r?\n/).forEach((line) => {
    if (!line || line.startsWith("#") || line.startsWith("agency_cd") || line.startsWith("5s")) return;
    const cols = line.split("\t");
    const gaugeId = cols[1];
    if (!gaugeId || Number(cols[5]) !== month || Number(cols[6]) !== day) return;
    byGauge[gaugeId] = {
      normalMedianCfs: numberOrNull(cols[10]),
      normalStartYear: numberOrNull(cols[7]),
      normalEndYear: numberOrNull(cols[8]),
      normalSampleCount: numberOrNull(cols[9])
    };
  });
  return byGauge;
}

async function fetchUSGSGauges(gaugeIds) {
  const ids = [...new Set(gaugeIds.filter(Boolean))];
  const { month, day } = todayEasternParts();
  const ivParams = new URLSearchParams({
    format: "json",
    sites: ids.join(","),
    parameterCd: "00060,00065,00010,00095,00300,00400,63680,99133",
    siteStatus: "all",
    period: "P3D"
  });
  const statParams = new URLSearchParams({
    format: "rdb",
    sites: ids.join(","),
    statReportType: "daily",
    statTypeCd: "median",
    parameterCd: "00060"
  });

  const [ivResponse, statResponse] = await Promise.all([
    fetchWithTimeout(`${USGS_IV_URL}?${ivParams}`),
    fetchWithTimeout(`${USGS_STATS_URL}?${statParams}`)
  ]);
  if (!ivResponse.ok || !statResponse.ok) throw new Error("USGS gauge request failed");

  const [ivPayload, statText] = await Promise.all([ivResponse.json(), statResponse.text()]);
  const liveByGauge = parseUSGSInstantaneousValues(ivPayload);
  const normalByGauge = parseUSGSDailyMedianStats(statText, month, day);

  return Object.fromEntries(ids.map((gaugeId) => {
    const live = liveByGauge[gaugeId] || {};
    const normal = normalByGauge[gaugeId] || {};
    const dischargeCfs = numberOrNull(live.dischargeCfs);
    const normalMedianCfs = numberOrNull(normal.normalMedianCfs);
    return [gaugeId, {
      gaugeId,
      dischargeCfs,
      gaugeHeightFt: numberOrNull(live.gaugeHeightFt),
      waterTempF: numberOrNull(live.waterTempF),
      quality: live.quality && Object.keys(live.quality).length ? live.quality : null,
      normalMedianCfs,
      percentNormal: dischargeCfs !== null && normalMedianCfs > 0
        ? Math.round((dischargeCfs / normalMedianCfs) * 100)
        : null,
      trend12hPct: numberOrNull(live.trend12hPct),
      trendReferenceAt: live.trendReferenceAt || null,
      normalStartYear: normal.normalStartYear || null,
      normalEndYear: normal.normalEndYear || null,
      normalSampleCount: normal.normalSampleCount || null,
      observedAt: live.observedAt || null,
      source: "USGS instantaneous values and daily median statistics",
      isLive: dischargeCfs !== null
    }];
  }));
}

function unavailableRainfall(reason) {
  return {
    available: false,
    rain6h: null,
    rain24h: null,
    rain3d: null,
    rain7d: null,
    rain14d: null,
    observedThrough: null,
    source: "Precipitation unavailable",
    reason
  };
}

export async function getLiveWaterConditions() {
  const generatedAt = new Date().toISOString();
  const locations = [
    ASHEVILLE,
    ...WATERFALLS.map((item) => ({ id: `waterfall:${item.id}`, lat: item.lat, lon: item.lon })),
    ...RIVERS.map((item) => ({ id: `river:${item.id}`, lat: item.lat, lon: item.lon }))
  ];

  const [modeledResult, mrmsResult, gaugeResult] = await Promise.allSettled([
    fetchModeledConditions(locations),
    fetchMrmsRainfall(locations),
    fetchUSGSGauges(RIVERS.map((river) => river.usgsGaugeId))
  ]);
  const modeled = modeledResult.status === "fulfilled" ? modeledResult.value : {};
  const mrms = mrmsResult.status === "fulfilled" ? mrmsResult.value : {};
  const gauges = gaugeResult.status === "fulfilled" ? gaugeResult.value : {};
  const rainFailure = modeledResult.status === "rejected" ? modeledResult.reason?.message : null;
  const mrmsFailure = mrmsResult.status === "rejected" ? mrmsResult.reason?.message : null;
  const gaugeFailure = gaugeResult.status === "rejected" ? gaugeResult.reason?.message : null;
  const precipitationAvailable = modeledResult.status === "fulfilled" || mrmsResult.status === "fulfilled";
  const primaryPrecipitationSource = mrmsResult.status === "fulfilled"
    ? "NOAA MRMS radar QPE + Open-Meteo antecedent estimate"
    : "Open-Meteo HRRR/GFS modeled precipitation";
  const gaugesAvailable = Object.values(gauges).some((gauge) => gauge?.isLive);

  return {
    waterfallRainfall: WATERFALLS.map((waterfall) => ({
      waterfallId: waterfall.id,
      rainfall: mergeRainfallSources(
        modeled[`waterfall:${waterfall.id}`]?.rainfall || unavailableRainfall(rainFailure),
        mrms[`waterfall:${waterfall.id}`]
      )
    })),
    riverInputs: RIVERS.map((river) => ({
      riverId: river.id,
      rainfall: mergeRainfallSources(
        modeled[`river:${river.id}`]?.rainfall || unavailableRainfall(rainFailure),
        mrms[`river:${river.id}`]
      ),
      gauge: gauges[river.usgsGaugeId] || null
    })),
    weather: modeled[ASHEVILLE.id]?.weather || {
      airTempF: null,
      windMph: null,
      thunderstormRisk: null,
      observedAt: null,
      source: "Weather guidance unavailable"
    },
    meta: {
      generatedAt,
      status: precipitationAvailable && gaugesAvailable ? "live" : precipitationAvailable || gaugesAvailable ? "partial" : "unavailable",
      precipitationAvailable,
      gaugesAvailable,
      precipitationSource: precipitationAvailable ? primaryPrecipitationSource : "Unavailable",
      gaugeSource: gaugesAvailable ? "USGS Water Services" : "Unavailable",
      errors: [rainFailure, mrmsFailure, gaugeFailure].filter(Boolean)
    }
  };
}
