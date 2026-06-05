import { fromArrayBuffer } from "geotiff";
import { normalizeInputs } from "./normalize.js";
import { labelDSS, labelFRI } from "./labels.js";
import { buildNarrative } from "./narrative.js";
import { formatDateYYYYMMDD, lastNDays } from "./utils.js";
import { buildFireDriver } from "./fire.js"

// Asheville
const AVL = { lat: 35.5951, lon: -82.5515 };

// Asheville Regional Airport 1991-2020 monthly precipitation normals (inches).
// Source station: USW00003812, ASHEVILLE RGNL AP, NC US.
const AVL_MONTHLY_PRECIP_NORMALS_IN = [
  4.13, 3.46, 3.80, 4.17, 4.13, 4.79,
  4.67, 5.04, 4.13, 3.37, 3.72, 4.18
];

const SEASONAL_DEFICIT_START = new Date("2025-09-01T12:00:00-04:00");

// CPC grid config
const CPC_GRID = {
  minLon360: 230.125,
  minLat: 20.125,
  nx: 300,
  dx: 0.25,
  dy: 0.25
};

// cache last good soil value (per runtime)
let LAST_GOOD_SOIL = null;


// ============================================================
// MAIN ENTRY
// ============================================================

export async function computeDroughtFireIndexLive(weatherInput = {}) {
  const {
    trendInput = null,
    ...currentInput
  } = weatherInput;

  const recentDays = lastNDays(90);
  const seasonalDays = datesSince(SEASONAL_DEFICIT_START);
  const precipDays = uniqueDays([...seasonalDays, ...recentDays]);

  const [soilPercentile, precipByDate] = await Promise.all([
    getSoilMoisturePercentileWithFallback(),
    getPrecipByDateIn(AVL.lat, AVL.lon, precipDays)
  ]);

  const precip90d = sumPrecipForDays(precipByDate, recentDays);
  const precipSeasonal = sumPrecipForDays(precipByDate, seasonalDays);

  const precipNormal90d_in = getRollingPrecipNormalIn(recentDays);
  const precipDeficit90d_in = precipNormal90d_in - precip90d;
  const precipNormalSeasonal_in = getRollingPrecipNormalIn(
    seasonalDays
  );
  const precipDeficitSeasonal_in = precipNormalSeasonal_in - precipSeasonal;

  const result = normalizeInputs({
    precipDeficit90d_in,
    precipDeficitSeasonal_in,
    soilPercentile,
    ...currentInput
  });

  const trendResult = trendInput
    ? normalizeInputs({
        precipDeficit90d_in,
        precipDeficitSeasonal_in,
        soilPercentile,
        ...trendInput
      })
    : null;

  // ============================================================
  // 🔥 NEW: Build Fire Driver (connects drought → fire risk)
  // ============================================================
 const fireDriver = buildFireDriver({
  droughtScore: result.DSS,
  wind: weatherInput.windGust,   // ✅ FIX
  humidity: weatherInput.rh      // ✅ FIX
});

  // ============================================================
  // RETURN
  // ============================================================

  return {
    DSS: result.DSS,
    FRI: result.FRI,
    dssTrend: trendResult ? trendResult.DSS - result.DSS : 0,
    friTrend: trendResult ? trendResult.FRI - result.FRI : 0,

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

async function getSoilMoisturePercentileWithFallback() {
  // try today → past 4 days
  for (let i = 0; i < 120; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);

    const val = await tryFetchSoil(date);

    if (val !== null) {
      LAST_GOOD_SOIL = val;
      return val;
    }
  }

  // fallback to last known good
  if (LAST_GOOD_SOIL !== null) {
    console.warn("Using cached soil value:", LAST_GOOD_SOIL);
    return LAST_GOOD_SOIL;
  }

  // final fallback (dry-biased, not neutral)
  console.warn("Using fallback soil value (dry-biased)");
  return 25;
}


// -----------------------------
// SINGLE FETCH ATTEMPT
// -----------------------------
async function tryFetchSoil(date) {
  try {
    const url = `https://ftp.cpc.ncep.noaa.gov/GIS/USDM_Products/soil/percentile/daily/w.rank.${formatDateYYYYMMDD(date)}.tif`;

    const response = await fetch(url);
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
    if (val < 0 || val > 100) return null;

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
  const entries = await Promise.all(days.map(async d => {
    const url = buildPrecipUrl(d);
    const val = await readCPCValue(url, index);
    return [formatDateYYYYMMDD(d), val > 0 ? val * 0.1 * 0.03937 : 0];
  }));

  return Object.fromEntries(entries);
}

function sumPrecipForDays(precipByDate, days) {
  return days.reduce((total, d) => {
    return total + (precipByDate[formatDateYYYYMMDD(d)] ?? 0);
  }, 0);
}

async function getPrecipTotalIn(lat, lon, days) {
  const index = latLonToCPCIndex(lat, lon);
  let totalMM = 0;

  for (const d of days) {
    const url = buildPrecipUrl(d);
    const val = await readCPCValue(url, index);
    if (val > 0) totalMM += val;
  }

  return totalMM * 0.03937; // mm → inches
}

function buildPrecipUrl(date) {
  const year = date.getFullYear();
  return `https://ftp.cpc.ncep.noaa.gov/precip/CPC_UNI_PRCP/GAUGE_CONUS/RT/${year}/PRCP_CU_GAUGE_V1.0CONUS_0.25deg.lnx.${formatDateYYYYMMDD(date)}.RT`;
}

function getRollingPrecipNormalIn(days) {
  return days.reduce((total, d) => {
    const monthNormal = AVL_MONTHLY_PRECIP_NORMALS_IN[d.getMonth()];
    return total + monthNormal / daysInMonth(d);
  }, 0);
}

function datesSince(startDate, endDate = new Date()) {
  const days = [];
  const start = new Date(startDate);
  start.setHours(12, 0, 0, 0);

  for (let d = new Date(endDate); d >= start; d.setDate(d.getDate() - 1)) {
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
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

async function readCPCValue(url, index) {
  try {
    const res = await fetch(url);
    if (!res.ok) return 0;

    const buffer = await res.arrayBuffer();
    const data = new Float32Array(buffer);

    const value = data[index];
    return Number.isFinite(value) && value > -998 ? value : 0;

  } catch {
    return 0;
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
