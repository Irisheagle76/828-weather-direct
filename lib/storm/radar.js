import { fromArrayBuffer } from "geotiff";

const CAPABILITIES_URL =
  "https://opengeo.ncep.noaa.gov/geoserver/conus/conus_bref_qcd/ows?service=wms&version=1.3.0&request=GetCapabilities";
const COVERAGE_URL =
  "https://opengeo.ncep.noaa.gov/geoserver/conus/conus_bref_qcd/wcs";
const COVERAGE_ID = "conus__conus_bref_qcd";
const ASHEVILLE = { lat: 35.5951, lon: -82.5515 };
const BOUNDS = { west: -84.0, east: -82.45, south: 34.9, north: 36.3 };
const WEST_SECTOR = { west: -83.8, east: -82.62, south: 35.15, north: 36.05 };
const NEAR_WEST_SECTOR = { west: -83.2, east: -82.62, south: 35.3, north: 35.85 };
const CACHE_MS = 90 * 1000;

let memoryCache = null;

function inside(point, bounds) {
  return point.lon >= bounds.west && point.lon <= bounds.east &&
    point.lat >= bounds.south && point.lat <= bounds.north;
}

function isStrongEcho(r, g, b) {
  return (r > 180 && g > 80 && b < 120) || (r > 180 && g < 100);
}

function haversineMiles(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const lat1 = a.lat * rad;
  const lat2 = b.lat * rad;
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 3958.8 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function parseRadarTimes(xml) {
  const match = String(xml).match(/<Dimension[^>]+name="time"[^>]*>([^<]+)<\/Dimension>/i);
  if (!match) return [];
  return match[1]
    .trim()
    .split(",")
    .map((value) => value.trim())
    .filter((value) => Number.isFinite(Date.parse(value)));
}

async function fetchWithTimeout(url, timeoutMs = 9000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { "user-agent": "828 Weather Direct storm signal/1.0" }
    });
  } finally {
    clearTimeout(timeout);
  }
}

function coverageRequestUrl(time) {
  const params = new URLSearchParams({
    service: "WCS",
    version: "2.0.1",
    request: "GetCoverage",
    coverageId: COVERAGE_ID,
    format: "image/tiff"
  });
  params.append("subset", `Lat(${BOUNDS.south},${BOUNDS.north})`);
  params.append("subset", `Long(${BOUNDS.west},${BOUNDS.east})`);
  params.append("subset", `time("${time}")`);
  return `${COVERAGE_URL}?${params.toString()}`;
}

async function analyzeCoverage(time) {
  const response = await fetchWithTimeout(coverageRequestUrl(time));
  if (!response.ok) throw new Error(`MRMS coverage failed: ${response.status}`);

  const tiff = await fromArrayBuffer(await response.arrayBuffer());
  const image = await tiff.getImage();
  const rasters = await image.readRasters();
  const width = image.getWidth();
  const height = image.getHeight();
  const [west, south, east, north] = image.getBoundingBox();
  const alpha = rasters[3];
  let sectorPixels = 0;
  let echoPixels = 0;
  let nearWestEchoPixels = 0;
  let strongEchoPixels = 0;
  let lonTotal = 0;
  let latTotal = 0;
  let nearestEchoMiles = null;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const point = {
        lon: west + ((x + 0.5) / width) * (east - west),
        lat: north - ((y + 0.5) / height) * (north - south)
      };
      if (!inside(point, WEST_SECTOR)) continue;
      sectorPixels += 1;
      if (!alpha?.[index]) continue;

      echoPixels += 1;
      lonTotal += point.lon;
      latTotal += point.lat;
      if (inside(point, NEAR_WEST_SECTOR)) nearWestEchoPixels += 1;
      if (isStrongEcho(rasters[0][index], rasters[1][index], rasters[2][index])) {
        strongEchoPixels += 1;
      }
      const distance = haversineMiles(ASHEVILLE, point);
      nearestEchoMiles = nearestEchoMiles == null ? distance : Math.min(nearestEchoMiles, distance);
    }
  }

  return {
    time,
    echoPixels,
    nearWestEchoPixels,
    strongEchoPixels,
    echoCoverage: sectorPixels ? echoPixels / sectorPixels : 0,
    centroidLon: echoPixels ? lonTotal / echoPixels : null,
    centroidLat: echoPixels ? latTotal / echoPixels : null,
    nearestEchoMiles: nearestEchoMiles == null ? null : Number(nearestEchoMiles.toFixed(1))
  };
}

export function summarizeRadarFrames(frames = []) {
  const valid = frames.filter((frame) => frame && Number.isFinite(frame.echoPixels));
  if (!valid.length) return { available: false, frames: [] };

  const first = valid[0];
  const latest = valid[valid.length - 1];
  const echoGrowth = latest.echoPixels - first.echoPixels;
  const nearGrowth = latest.nearWestEchoPixels - first.nearWestEchoPixels;
  const centroidShift = Number.isFinite(first.centroidLon) && Number.isFinite(latest.centroidLon)
    ? latest.centroidLon - first.centroidLon
    : 0;
  const growing = echoGrowth >= 40 && latest.echoPixels >= first.echoPixels * 1.08;
  const movingEast = centroidShift >= 0.02;
  const fillingInNearAsheville = nearGrowth >= 20 &&
    latest.nearWestEchoPixels >= Math.max(30, first.nearWestEchoPixels * 1.1);

  return {
    available: true,
    source: "NOAA MRMS quality-controlled base reflectivity",
    observedAt: latest.time,
    ageMinutes: Math.max(0, Math.round((Date.now() - Date.parse(latest.time)) / 60000)),
    echoCoverage: Number(latest.echoCoverage.toFixed(3)),
    echoPixels: latest.echoPixels,
    nearWestEchoPixels: latest.nearWestEchoPixels,
    strongEchoPixels: latest.strongEchoPixels,
    nearestEchoMiles: latest.nearestEchoMiles,
    growing,
    movingEast,
    fillingInNearAsheville,
    approaching: movingEast || fillingInNearAsheville,
    frames: valid
  };
}

export async function fetchRadarAnalysis() {
  const now = Date.now();
  if (memoryCache && now - memoryCache.timestamp < CACHE_MS) return memoryCache.payload;

  const capabilities = await fetchWithTimeout(CAPABILITIES_URL);
  if (!capabilities.ok) throw new Error(`MRMS capabilities failed: ${capabilities.status}`);
  const times = parseRadarTimes(await capabilities.text());
  if (!times.length) throw new Error("MRMS radar times unavailable");

  const selectedTimes = times.slice(-5);
  const frames = await Promise.all(selectedTimes.map(analyzeCoverage));
  const payload = summarizeRadarFrames(frames);
  memoryCache = { timestamp: now, payload };
  return payload;
}

export { parseRadarTimes };
