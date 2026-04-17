import { fromArrayBuffer } from "geotiff";
import { normalizeInputs } from "./normalize.js";
import { labelDSS, labelFRI } from "./labels.js";
import { buildNarrative } from "./narrative.js";
import { formatDateYYYYMMDD, lastNDays } from "./utils.js";

// Asheville
const AVL = { lat: 35.5951, lon: -82.5515 };

// CPC grid config
const CPC_GRID = {
  minLon: -130,
  maxLon: -60,
  minLat: 20,
  maxLat: 55,
  dx: 0.25,
  dy: 0.25
};

// cache last good soil value (per runtime)
let LAST_GOOD_SOIL = null;


// ============================================================
// MAIN ENTRY
// ============================================================

export async function computeDroughtFireIndexLive(weatherInput) {
  const [soilPercentile, precip90d] = await Promise.all([
    getSoilMoisturePercentileWithFallback(),
    getPrecip90d(AVL.lat, AVL.lon)
  ]);

    console.log("SOIL FINAL:", soilPercentile);
    
  const precipDeficit90d_in = 12.5 - precip90d;

  const result = normalizeInputs({
    precipDeficit90d_in,
    soilPercentile,
    ...weatherInput
  });

  return {
    DSS: result.DSS,
    FRI: result.FRI,
    dssLabel: labelDSS(result.DSS),
    friLabel: labelFRI(result.FRI),
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
  for (let i = 0; i < 5; i++) {
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
    const url = `https://ftp.cpc.ncep.noaa.gov/GIS/GRADS_GIS/soilw/soilw_${formatDateYYYYMMDD(date)}.tif`;

    const response = await fetch(url);

    if (!response.ok) return null;

    const contentType = response.headers.get("content-type");

    if (!contentType || !contentType.includes("tiff")) {
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();

    // validate TIFF signature
    const bytes = new Uint8Array(arrayBuffer.slice(0, 4));
    const isTIFF =
      (bytes[0] === 0x49 && bytes[1] === 0x49) ||
      (bytes[0] === 0x4D && bytes[1] === 0x4D);

    if (!isTIFF) return null;

    const tiff = await fromArrayBuffer(arrayBuffer);
    const image = await tiff.getImage();

    const [width, height] = image.getSize();
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
  const x = Math.floor((lon - CPC_GRID.minLon) / CPC_GRID.dx);
  const y = Math.floor((CPC_GRID.maxLat - lat) / CPC_GRID.dy);

  const nx = (CPC_GRID.maxLon - CPC_GRID.minLon) / CPC_GRID.dx;

  return y * nx + x;
}

async function getPrecip90d(lat, lon) {
  const index = latLonToCPCIndex(lat, lon);
  let totalMM = 0;

  const days = lastNDays(90);

  for (const d of days) {
    const url = buildPrecipUrl(d);
    const val = await readCPCValue(url, index);
    if (val > 0) totalMM += val;
  }

  return totalMM * 0.03937; // mm → inches
}

function buildPrecipUrl(date) {
  return `https://ftp.cpc.ncep.noaa.gov/precip/CPC_UNI_PRCP/GAUGE_CONUS/UPDATED/PRCP_CU_GAUGE_V1.0CONUS_0.25deg.lnx.${formatDateYYYYMMDD(date)}`;
}

async function readCPCValue(url, index) {
  try {
    const res = await fetch(url);
    if (!res.ok) return 0;

    const buffer = await res.arrayBuffer();
    const data = new Float32Array(buffer);

    return data[index] ?? 0;

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