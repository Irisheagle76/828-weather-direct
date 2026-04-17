import GeoTIFF from "geotiff";
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

// -----------------------------
// MAIN ENTRY
// -----------------------------
export async function computeDroughtFireIndexLive(weatherInput) {
  const today = new Date();

  const [soilPercentile, precip90d] = await Promise.all([
    getSoilMoisturePercentile(today),
    getPrecip90d(AVL.lat, AVL.lon)
  ]);

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

// -----------------------------
// SOIL MOISTURE (GeoTIFF)
// -----------------------------
async function getSoilMoisturePercentile(date) {
  const url = `https://ftp.cpc.ncep.noaa.gov/GIS/GRADS_GIS/soilw/soilw_${formatDateYYYYMMDD(date)}.tif`;

  const tiff = await GeoTIFF.fromUrl(url);
  const image = await tiff.getImage();

  const [width, height] = image.getSize();
  const bbox = image.getBoundingBox();

  const { x, y } = latLonToPixel(AVL, bbox, width, height);

  const raster = await image.readRasters({
    window: [x, y, x + 1, y + 1]
  });

  const val = raster[0][0];

  return val < 0 ? 50 : val; // fallback neutral
}

// -----------------------------
// PRECIP (CPC binary)
// -----------------------------
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
  const buffer = await fetch(url).then(r => r.arrayBuffer());
  const data = new Float32Array(buffer);
  return data[index];
}

// -----------------------------
// GEO HELPER
// -----------------------------
function latLonToPixel({ lat, lon }, bbox, width, height) {
  const [minLon, minLat, maxLon, maxLat] = bbox;

  const x = Math.floor(((lon - minLon) / (maxLon - minLon)) * width);
  const y = Math.floor(((maxLat - lat) / (maxLat - minLat)) * height);

  return { x, y };
}