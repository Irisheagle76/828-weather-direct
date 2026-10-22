import { fromArrayBuffer } from "geotiff";
import { normalizeInputs } from "./normalize.js";
import { labelDSS, labelFRI } from "./labels.js";
import { buildNarrative } from "./narrative.js";
import { formatDateYYYYMMDD } from "./utils.js";
import { buildFireDriver } from "./fire.js"
import { buildFireOutlook } from "./outlook.js";

// Asheville
const AVL = { lat: 35.5951, lon: -82.5515 };

// Asheville Regional Airport 1991-2020 monthly precipitation normals (inches).
// Source station: USW00003812, ASHEVILLE RGNL AP, NC US.
const AVL_MONTHLY_PRECIP_NORMALS_IN = [
  4.13, 3.46, 3.80, 4.17, 4.13, 4.79,
  4.67, 5.04, 4.13, 3.37, 3.72, 4.18
];

export function seasonalStart(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear() - (now.getUTCMonth() < 8 ? 1 : 0), 8, 1, 12));
}

// CPC grid config
const CPC_GRID = {
  minLon360: 230.125,
  minLat: 20.125,
  nx: 300,
  dx: 0.25,
  dy: 0.25
};

// Cache only complete, valid background analyses within this runtime.
const PRECIP_CACHE = new Map();
let backgroundCache = null;
let backgroundPending = null;


// ============================================================
// MAIN ENTRY
// ============================================================

export async function computeDroughtFireIndexLive(weatherInput = {}) {
  const {
    hourly = [],
    ...currentInput
  } = weatherInput;

  const { recentDays, seasonalDays, soil, precipByDate } = await getBackground();
  const soilPercentile = soil.value;
  // Dry-spell length comes from observed daily precipitation, never forecast rain.
  currentInput.daysSinceRain = observedDryDays(precipByDate, recentDays);
  if (currentInput.rainTodayIn >= 0.1) currentInput.daysSinceRain = 0;
  currentInput.timestamp = Date.now();
  currentInput.seasonMode = process.env.FIRE_WEATHER_SEASON || 'auto';

  const precip90d = sumPrecipForDays(precipByDate, recentDays);
  const precipSeasonal = sumPrecipForDays(precipByDate, seasonalDays);
  const precipNormal90d_in = getRollingPrecipNormalIn(recentDays);
  const precipDeficit90d_in = precipNormal90d_in - precip90d;
  const precipNormalSeasonal_in = getRollingPrecipNormalIn(seasonalDays);
  const precipDeficitSeasonal_in = precipNormalSeasonal_in - precipSeasonal;

  return buildResult({ currentInput, hourly, soilPercentile, soil, recentDays,
    precip90d, precipSeasonal, precipNormal90d_in, precipDeficit90d_in,
    precipNormalSeasonal_in, precipDeficitSeasonal_in });
}

async function getBackground() {
  if (backgroundCache && Date.now() - backgroundCache.at < 3600000) return backgroundCache.value;
  if (!backgroundPending) backgroundPending = loadBackground().then(value => {
    backgroundCache = { at: Date.now(), value };
    return value;
  }).finally(() => { backgroundPending = null; });
  return backgroundPending;
}

async function loadBackground() {
  // CPC analyses arrive after the observation day; anchor both totals to the
  // newest available day instead of interpreting publication lag as no rain.
  let endDate;
  for (let lag = 1; lag <= 5; lag++) {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - lag);
    if (await readCPCValue(buildPrecipUrl(date), latLonToCPCIndex(AVL.lat, AVL.lon)) !== null) {
      endDate = date;
      break;
    }
  }
  if (!endDate) throw new Error("Recent CPC rainfall analysis is unavailable");
  const recentDays = Array.from({ length: 90 }, (_, i) => {
    const d = new Date(endDate);
    d.setUTCDate(d.getUTCDate() - i);
    return d;
  });
  const seasonalDays = datesSince(seasonalStart(endDate), endDate);
  const precipDays = uniqueDays([...seasonalDays, ...recentDays]);

  const [soil, precipByDate] = await Promise.all([
    getSoilMoisturePercentile(),
    getPrecipByDateIn(AVL.lat, AVL.lon, precipDays)
  ]);

  return { recentDays, seasonalDays, soil, precipByDate };
}

function buildResult({ currentInput, hourly, soilPercentile, soil, recentDays,
  precip90d, precipSeasonal, precipNormal90d_in, precipDeficit90d_in,
  precipNormalSeasonal_in, precipDeficitSeasonal_in }) {
  const result = normalizeInputs({
    precipDeficit90d_in,
    precipDeficitSeasonal_in,
    soilPercentile,
    ...currentInput
  });

  const outlook = buildFireOutlook({ hourly, current: currentInput, now: currentInput.timestamp,
    background: { precipDeficit90d_in, precipDeficitSeasonal_in, soilPercentile } });
  const trendResult = outlook.points.find(p => p.timestamp >= outlook.points[0].timestamp + 6 * 3600000);

  // ============================================================
  // 🔥 NEW: Build Fire Driver (connects drought → fire risk)
  // ============================================================
 const fireDriver = buildFireDriver({
  droughtScore: result.DSS,
  wind: currentInput.windGust,
  humidity: currentInput.rh,
  rainTodayIn: currentInput.rainTodayIn,
  rainRateInHr: currentInput.rainRateInHr
});

  // ============================================================
  // RETURN
  // ============================================================

  return {
    updatedAt: new Date().toISOString(),
    dataThrough: formatDateYYYYMMDD(recentDays[0]),
    seasonalStart: formatDateYYYYMMDD(seasonalStart(recentDays[0])),
    soilDate: soil.date,
    daysSinceRain: currentInput.daysSinceRain,
    DSS: result.DSS,
    FRI: result.FRI,
    calibration: {
      version: 'seasonal-v1-preview',
      ...result.components.season,
      autumnWeight: result.components.autumnWeight,
      weatherWeights: result.components.weatherWeights,
      fineFuelMoistureMeasured: false
    },
    outlook,
    dssTrend: trendResult ? trendResult.DSS - result.DSS : null,
    friTrend: trendResult ? trendResult.FRI - result.FRI : null,

    dssLabel: labelDSS(result.DSS),
    friLabel: labelFRI(result.FRI),

    fireDriver, // 👈 NEW (used in UI)

    inputs: {
      precip90d,
      precipNormal90d_in,
      precipDeficit90d_in,
      precipSinceSep1_in: precipSeasonal,
      precipNormalSinceSep1_in: precipNormalSeasonal_in,
      precipDeficitSinceSep1_in: precipDeficitSeasonal_in,
      soilPercentile
    },

    narrative: buildNarrative({
      DSS: result.DSS,
      FRI: result.FRI,
      ...result.components
    })
  };
}


// ============================================================
// SOIL MOISTURE (ROBUST)
// ============================================================

async function getSoilMoisturePercentile() {
  // Allow publication lag, but never substitute months-old or invented soil data.
  for (let i = 1; i <= 5; i++) {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - i);

    const val = await tryFetchSoil(date);

    if (val !== null) {
      return { value: val, date: formatDateYYYYMMDD(date) };
    }
  }

  throw new Error("Recent CPC soil moisture analysis is unavailable");
}


// -----------------------------
// SINGLE FETCH ATTEMPT
// -----------------------------
async function tryFetchSoil(date) {
  try {
    const url = `https://ftp.cpc.ncep.noaa.gov/GIS/USDM_Products/soil/percentile/daily/w.rank.${formatDateYYYYMMDD(date)}.tif`;

    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) return null;

    const arrayBuffer = await response.arrayBuffer();

    // validate TIFF signature
    const bytes = new Uint8Array(arrayBuffer.slice(0, 4));
    const isTIFF =
      (bytes[0] === 0x49 && bytes[1] === 0x49) ||
      (bytes[0] === 0x4D && bytes[1] === 0x4D);

    if (!isTIFF) return null;

    const tiff = await fromArrayBuffer(arrayBuffer);
    const image = await tiff.getImage();

    const width = image.getWidth();
    const height = image.getHeight();
    const bbox = image.getBoundingBox();

    const { x, y } = latLonToPixel(AVL, bbox, width, height);

    const raster = await image.readRasters({
      window: [x, y, x + 1, y + 1]
    });

    const val = raster[0][0];

    // reject invalid values
    if (!Number.isFinite(val) || val < 0 || val > 100) return null;

    return val;

  } catch {
    return null;
  }
}


// ============================================================
// PRECIP (CPC binary)
// ============================================================

function latLonToCPCIndex(lat, lon) {
  const lon360 = lon < 0 ? lon + 360 : lon;
  const x = Math.round((lon360 - CPC_GRID.minLon360) / CPC_GRID.dx);
  const y = Math.round((lat - CPC_GRID.minLat) / CPC_GRID.dy);

  return y * CPC_GRID.nx + x;
}

async function getPrecipByDateIn(lat, lon, days) {
  const index = latLonToCPCIndex(lat, lon);
  const entries = [];
  let cursor = 0;
  await Promise.all(Array.from({ length: 8 }, async () => {
    while (cursor < days.length) {
      const d = days[cursor++];
      const val = await readCPCValue(buildPrecipUrl(d), index);
      if (val === null) throw new Error(`CPC rainfall missing for ${formatDateYYYYMMDD(d)}`);
      entries.push([formatDateYYYYMMDD(d), val * 0.1 / 25.4]);
    }
  }));

  return Object.fromEntries(entries);
}

function sumPrecipForDays(precipByDate, days) {
  return days.reduce((total, d) => {
    return total + (precipByDate[formatDateYYYYMMDD(d)] ?? 0);
  }, 0);
}

function buildPrecipUrl(date) {
  const year = date.getUTCFullYear();
  return `https://ftp.cpc.ncep.noaa.gov/precip/CPC_UNI_PRCP/GAUGE_CONUS/RT/${year}/PRCP_CU_GAUGE_V1.0CONUS_0.25deg.lnx.${formatDateYYYYMMDD(date)}.RT`;
}

function getRollingPrecipNormalIn(days) {
  return days.reduce((total, d) => {
    const monthNormal = AVL_MONTHLY_PRECIP_NORMALS_IN[d.getUTCMonth()];
    return total + monthNormal / daysInMonth(d);
  }, 0);
}

function datesSince(startDate, endDate = new Date()) {
  const days = [];
  const start = new Date(startDate);
  start.setUTCHours(0, 0, 0, 0);

  for (let d = new Date(endDate); d >= start; d.setUTCDate(d.getUTCDate() - 1)) {
    days.push(new Date(d));
  }

  return days;
}

function uniqueDays(days) {
  const byDate = new Map();

  for (const d of days) {
    byDate.set(formatDateYYYYMMDD(d), d);
  }

  return [...byDate.values()];
}

function daysInMonth(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
}

export function decodeCPCValue(buffer, index) {
  if (buffer.byteLength < (index + 1) * 4) return null;
  const value = new DataView(buffer).getFloat32(index * 4, true);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export function observedDryDays(precipByDate, days) {
  let count = 0;
  for (const day of days) {
    const rain = precipByDate[formatDateYYYYMMDD(day)];
    if (!Number.isFinite(rain)) throw new Error("Rainfall history is incomplete");
    if (rain >= 0.1) return count;
    count++;
  }
  return count;
}

async function readCPCValue(url, index) {
  if (PRECIP_CACHE.has(url)) return PRECIP_CACHE.get(url);
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;

    const buffer = await res.arrayBuffer();
    const value = decodeCPCValue(buffer, index);
    if (value !== null) {
      if (PRECIP_CACHE.size > 400) PRECIP_CACHE.delete(PRECIP_CACHE.keys().next().value);
      PRECIP_CACHE.set(url, value);
    }
    return value;

  } catch {
    return null;
  }
}


// ============================================================
// GEO HELPER
// ============================================================

function latLonToPixel({ lat, lon }, bbox, width, height) {
  const [minLon, minLat, maxLon, maxLat] = bbox;

  const x = Math.floor(((lon - minLon) / (maxLon - minLon)) * width);
  const y = Math.floor(((maxLat - lat) / (maxLat - minLat)) * height);

  return { x, y };
}
