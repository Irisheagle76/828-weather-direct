import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import AdmZip from 'adm-zip';
import * as shapefile from 'shapefile';
import tzlookup from 'tz-lookup';
import { gridPointsOnLand } from '../lib/feelscore/geo.js';
import { parseDwmlBatch } from '../lib/feelscore/nws-dwml.js';
import { CATEGORIES, ENGINE_VERSION, scorePeriod } from '../lib/feelscore/summer-v1.6.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const CACHE_DIR = path.join(ROOT, '.cache', 'feelscore');
const DATA_DIR = path.join(ROOT, 'public', 'data');
const BOUNDARY_PATH = path.join(DATA_DIR, 'southeast-states.geojson');
const CENSUS_ZIP = 'https://www2.census.gov/geo/tiger/GENZ2025/shp/cb_2025_us_state_5m.zip';
const NWS_ENDPOINT = 'https://digital.weather.gov/xml/SOAP_server/ndfdXMLclient.php';
const USER_AGENT = '828 Weather Direct FEELSCORE/1.6 (https://avlweather.com/feelscore.html)';
const BBOX = { west: -91.5, east: -75, south: 24, north: 39.5 };
const STATE_CODES = new Set(['01', '05', '12', '13', '21', '22', '24', '28', '37', '45', '47', '51', '54', '11']);

const ANCHOR_CITIES = [
  ['Louisville, KY', 38.2527, -85.7585], ['Nashville, TN', 36.1627, -86.7816],
  ['Asheville, NC', 35.5951, -82.5515], ['Charlotte, NC', 35.2271, -80.8431],
  ['Raleigh, NC', 35.7796, -78.6382], ['Roanoke, VA', 37.271, -79.9414],
  ['Greenville, SC', 34.8526, -82.394], ['Atlanta, GA', 33.749, -84.388],
  ['Birmingham, AL', 33.5186, -86.8104], ['Mobile, AL', 30.6954, -88.0399],
  ['Tampa, FL', 27.9506, -82.4572], ['Miami, FL', 25.7617, -80.1918],
  ['Virginia Beach, VA', 36.8529, -75.978],
].map(([name, lat, lon]) => ({ name, lat, lon }));

function argument(name, fallback) {
  const prefix = `--${name}=`;
  const match = process.argv.slice(2).find((item) => item.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function nextSunday() {
  const now = new Date();
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  let days = (7 - date.getUTCDay()) % 7;
  if (days === 0 && now.getUTCHours() >= 16) days = 7;
  date.setUTCDate(date.getUTCDate() + days);
  return isoDate(date);
}

function addDays(dateText, days) {
  const date = new Date(`${dateText}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return isoDate(date);
}

async function existsFresh(file, maxAgeMs) {
  try {
    const info = await stat(file);
    return Date.now() - info.mtimeMs < maxAgeMs;
  } catch {
    return false;
  }
}

async function fetchWithRetry(url, attempts = 4) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/xml,*/*' } });
      if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 750 * (2 ** (attempt - 1))));
    }
  }
  throw lastError;
}

async function ensureBoundaries() {
  if (await existsFresh(BOUNDARY_PATH, 180 * 24 * 60 * 60 * 1000)) {
    return JSON.parse(await readFile(BOUNDARY_PATH, 'utf8'));
  }

  await mkdir(CACHE_DIR, { recursive: true });
  await mkdir(DATA_DIR, { recursive: true });
  const zipPath = path.join(CACHE_DIR, 'cb_2025_us_state_5m.zip');
  const extractDir = path.join(CACHE_DIR, 'census-states');
  if (!(await existsFresh(zipPath, 365 * 24 * 60 * 60 * 1000))) {
    const response = await fetchWithRetry(CENSUS_ZIP);
    await writeFile(zipPath, Buffer.from(await response.arrayBuffer()));
  }
  new AdmZip(zipPath).extractAllTo(extractDir, true);
  const shpPath = path.join(extractDir, 'cb_2025_us_state_5m.shp');
  const source = await shapefile.open(shpPath);
  const features = [];
  while (true) {
    const result = await source.read();
    if (result.done) break;
    const stateCode = String(result.value.properties.STATEFP || result.value.properties.STATE || '').padStart(2, '0');
    if (STATE_CODES.has(stateCode)) {
      result.value.properties = {
        STATEFP: stateCode,
        STUSPS: result.value.properties.STUSPS,
        NAME: result.value.properties.NAME,
      };
      features.push(result.value);
    }
  }
  const collection = {
    type: 'FeatureCollection',
    source: CENSUS_ZIP,
    sourceVintage: '2025 U.S. Census Bureau cartographic boundaries, 1:5,000,000',
    features,
  };
  await writeFile(BOUNDARY_PATH, `${JSON.stringify(collection)}\n`);
  return collection;
}

function requestUrl(points, date) {
  const params = new URLSearchParams({
    whichClient: 'NDFDgenLatLonList',
    listLatLon: points.map(({ lat, lon }) => `${lat},${lon}`).join(' '),
    product: 'time-series',
    begin: `${date}T00:00:00`,
    end: `${addDays(date, 1)}T23:00:00`,
    Unit: 'e', XMLformat: 'DWML', temp: 'temp', dew: 'dew', wspd: 'wspd',
    wgust: 'wgust', sky: 'sky', wx: 'wx', qpf: 'qpf', Submit: 'Submit',
  });
  return `${NWS_ENDPOINT}?${params}`;
}

async function loadBatch(points, date, force) {
  const key = createHash('sha1').update(`${date}|${points.map((p) => `${p.lat},${p.lon}`).join('|')}`).digest('hex').slice(0, 16);
  const cacheFile = path.join(CACHE_DIR, `${date}-${key}.xml`);
  let xml;
  if (!force && await existsFresh(cacheFile, 30 * 60 * 1000)) {
    xml = await readFile(cacheFile, 'utf8');
  } else {
    const response = await fetchWithRetry(requestUrl(points, date));
    xml = await response.text();
    if (!xml.includes('<dwml')) throw new Error('NWS service returned a non-DWML response');
    await writeFile(cacheFile, xml);
  }
  return parseDwmlBatch(xml, points, date);
}

async function loadBatchResilient(points, date, force) {
  try {
    return await loadBatch(points, date, force);
  } catch (error) {
    if (points.length === 1) {
      console.warn(`NWS point missing at ${points[0].lat},${points[0].lon}: ${error.message}`);
      return [{ ...points[0], nwsLocationKey: null, hours: [12, 13, 14, 15].map((hour) => ({ localTime: `${hour}:00`, missing: true })) }];
    }
    console.warn(`NWS batch of ${points.length} failed (${error.message}); retrying as smaller batches`);
    const middle = Math.ceil(points.length / 2);
    const [left, right] = await Promise.all([
      loadBatchResilient(points.slice(0, middle), date, force),
      loadBatchResilient(points.slice(middle), date, force),
    ]);
    return [...left, ...right];
  }
}

async function mapConcurrent(items, concurrency, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run));
  return results;
}

function smooth(points, spacing) {
  const byCoordinate = new Map(points.map((point) => [`${point.lat.toFixed(2)},${point.lon.toFixed(2)}`, point]));
  const offsets = [-1, 0, 1];
  for (const point of points) {
    if (point.finalCategory == null) {
      const neighbors = [];
      for (const dy of offsets) for (const dx of offsets) {
        if (dx === 0 && dy === 0) continue;
        const neighbor = byCoordinate.get(`${(point.lat + dy * spacing).toFixed(2)},${(point.lon + dx * spacing).toFixed(2)}`);
        if (neighbor?.finalCategory != null) neighbors.push(neighbor.finalCategory);
      }
      point.displayValue = neighbors.length >= 5 ? neighbors.reduce((sum, value) => sum + value, 0) / neighbors.length : null;
      continue;
    }
    let weighted = point.finalCategory * 4;
    let weights = 4;
    for (const dy of offsets) for (const dx of offsets) {
      if (dx === 0 && dy === 0) continue;
      const neighbor = byCoordinate.get(`${(point.lat + dy * spacing).toFixed(2)},${(point.lon + dx * spacing).toFixed(2)}`);
      if (neighbor?.finalCategory == null) continue;
      const weight = dx === 0 || dy === 0 ? 2 : 1;
      weighted += neighbor.finalCategory * weight;
      weights += weight;
    }
    point.displayValue = Math.round((weighted / weights) * 100) / 100;
  }
}

function nearestPoint(points, lat, lon) {
  return points.reduce((best, point) => {
    const distance = ((point.lat - lat) ** 2) + ((point.lon - lon) ** 2);
    return !best || distance < best.distance ? { point, distance } : best;
  }, null)?.point;
}

function resolveTimezone(point) {
  const firstValidTime = point.hours.find((hour) => hour.validTime)?.validTime;
  const inferred = tzlookup(point.lat, point.lon);
  if (!firstValidTime) return { timezone: inferred, timezoneSource: 'tz-lookup-no-valid-time' };
  const localHour = (timezone) => Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone: timezone }).format(new Date(firstValidTime)));
  if (localHour(inferred) === 12) return { timezone: inferred, timezoneSource: 'tz-lookup-validated-against-NWS-local-time' };
  for (const timezone of ['America/New_York', 'America/Chicago']) {
    if (localHour(timezone) === 12) return { timezone, timezoneSource: 'NWS-local-time-corrected-near-timezone-boundary' };
  }
  return { timezone: inferred, timezoneSource: 'tz-lookup-unverified' };
}

function suspiciousDiscontinuities(points, spacing) {
  const byCoordinate = new Map(points.map((point) => [`${point.lat.toFixed(2)},${point.lon.toFixed(2)}`, point]));
  const findings = [];
  for (const point of points) {
    if (point.finalCategory == null) continue;
    for (const [dy, dx] of [[0, 1], [1, 0]]) {
      const neighbor = byCoordinate.get(`${(point.lat + dy * spacing).toFixed(2)},${(point.lon + dx * spacing).toFixed(2)}`);
      if (neighbor?.finalCategory == null) continue;
      const difference = Math.abs(point.finalCategory - neighbor.finalCategory);
      if (difference >= 3) findings.push({ from: [point.lat, point.lon, point.finalCategory], to: [neighbor.lat, neighbor.lon, neighbor.finalCategory], difference });
    }
  }
  return findings;
}

function csvValue(value) {
  if (value == null) return '';
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

async function main() {
  // The boundary GeoJSON is tracked, so ensureBoundaries can return before it
  // creates the cache directory. A clean CI checkout still needs it for NWS XML.
  await mkdir(CACHE_DIR, { recursive: true });
  const dateArg = argument('date', 'next-sunday');
  const forecastDate = dateArg === 'next-sunday' ? nextSunday() : dateArg;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(forecastDate)) throw new Error('Use --date=YYYY-MM-DD or --date=next-sunday');
  const spacing = Number(argument('spacing', '0.25'));
  const force = process.argv.includes('--force');
  const boundaries = await ensureBoundaries();
  const grid = gridPointsOnLand({ bbox: BBOX, spacing, features: boundaries.features });
  const batchSize = Number(argument('batch-size', '50'));
  const batches = [];
  for (let index = 0; index < grid.length; index += batchSize) batches.push(grid.slice(index, index + batchSize));
  console.log(`FEELSCORE: ${grid.length} land points in ${batches.length} NWS batches for ${forecastDate}`);

  const parsed = (await mapConcurrent(batches, 2, async (batch, index) => {
    console.log(`NWS batch ${index + 1}/${batches.length}`);
    return loadBatchResilient(batch, forecastDate, force);
  })).flat();

  const points = parsed.map((point) => {
    const timezone = resolveTimezone(point);
    const scored = scorePeriod(point.hours);
    return { ...point, ...timezone, ...scored };
  });
  smooth(points, spacing);
  const discontinuities = suspiciousDiscontinuities(points, spacing);
  const anchors = ANCHOR_CITIES.map((city) => {
    const point = nearestPoint(points, city.lat, city.lon);
    return { ...city, gridPoint: point ? [point.lat, point.lon] : null, finalCategory: point?.finalCategory ?? null, label: point?.finalCategory == null ? 'Missing' : CATEGORIES[point.finalCategory].label };
  });
  const missing = points.filter((point) => point.finalCategory == null).length;
  const counts = Object.fromEntries([0, 1, 2, 3, 4, 5].map((category) => [category, points.filter((point) => point.finalCategory === category).length]));
  const output = {
    product: 'FEELSCORE — Pleasant Weather Forecast',
    tagline: 'Where will it feel best?',
    engine: ENGINE_VERSION,
    generatedAt: new Date().toISOString(),
    forecastDate,
    forecastWindow: '12–3 PM local time',
    bbox: BBOX,
    spacingDegrees: spacing,
    source: {
      name: 'NOAA/NWS National Digital Forecast Database (official operational forecast)',
      endpoint: NWS_ENDPOINT,
      retrieval: `${batches.length} cached multi-point DWML calls; maximum 100 land points per call`,
      boundaries: boundaries.sourceVintage,
      precipitationNote: 'NDFD multi-point DWML does not expose true hourly PoP. Rain and thunder risk are inferred from hourly/interval weather coverage codes and QPF; 12-hour PoP is deliberately not used.',
    },
    analysis: { landPointCount: points.length, missingPointCount: missing, categoryCounts: counts },
    qa: { anchorCities: anchors, suspiciousDiscontinuityCount: discontinuities.length, suspiciousDiscontinuities: discontinuities.slice(0, 40) },
    points,
  };
  // A data refresh can publish dated maps without overwriting other source work.
  if (process.argv.includes('--require-complete') && missing !== 0) throw new Error(`Refusing incomplete forecast: ${missing} missing points`);
  const outputDir = path.resolve(argument('output-dir', DATA_DIR));
  const stem = process.argv.includes('--dated') ? forecastDate : 'feelscore-grid';
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, `${stem}.json`), `${JSON.stringify(output)}\n`);
  const rows = [['lat', 'lon', 'timezone', 'state', 'finalCategory', 'displayValue', 'hourlyCategories', 'weather']];
  for (const point of points) rows.push([
    point.lat, point.lon, point.timezone, point.state, point.finalCategory, point.displayValue,
    point.hours.map((hour) => hour.category).join('|'), point.hours.map((hour) => hour.weather).filter(Boolean).join(' / '),
  ]);
  await writeFile(path.join(outputDir, `${stem}.csv`), `${rows.map((row) => row.map(csvValue).join(',')).join('\n')}\n`);
  console.log(`FEELSCORE complete: ${points.length - missing} valid, ${missing} missing, ${discontinuities.length} sharp adjacent jumps`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
