const ASHEVILLE = { lat: 35.5951, lon: -82.5515 };
const ASHEVILLE_TIME_ZONE = "America/New_York";
const MONTHLY_NORMALS_IN = [
  4.13, 3.46, 3.80, 4.17, 4.13, 4.79,
  4.67, 5.04, 4.13, 3.37, 3.72, 4.18
];
const CPC_GRID = { minLon360: 230.125, minLat: 20.125, nx: 300, dx: 0.25, dy: 0.25 };

export async function getRainfallContextLive(endDate = new Date()) {
  const latest = await findLatestAvailableDate(ASHEVILLE.lat, ASHEVILLE.lon, endDate);
  const days = lastNDaysFrom(90, latest.date);
  const precipByDate = await getPrecipByDateIn(
    ASHEVILLE.lat,
    ASHEVILLE.lon,
    days,
    new Map([[formatDate(latest.date), latest.value]])
  );
  const windows = [14, 30, 90].map((dayCount) => {
    const range = days.slice(0, dayCount);
    const observed = sumPrecipForDays(precipByDate, range);
    const normal = getRollingNormalIn(range);
    return {
      days: dayCount,
      observed: roundRain(observed),
      normal: roundRain(normal),
      percentOfNormal: normal > 0 ? Math.round((observed / normal) * 100) : null
    };
  });

  const oldestFirst = [...days].reverse();
  const checkpoints = new Set([15, 30, 45, 60, 75, 90]);
  let observed = 0;
  let normal = 0;
  const pace = [{ elapsedDays: 0, observed: 0, normal: 0 }];
  oldestFirst.forEach((date, index) => {
    observed += precipByDate[formatDate(date)] ?? 0;
    normal += getRollingNormalIn([date]);
    const elapsedDays = index + 1;
    if (checkpoints.has(elapsedDays)) {
      pace.push({ elapsedDays, observed: roundRain(observed), normal: roundRain(normal) });
    }
  });

  return {
    source: "NOAA Climate Prediction Center unified gauge analysis",
    normalSource: "Asheville Regional Airport 1991-2020 monthly precipitation normals",
    updatedDate: formatDate(days[0]),
    generatedAt: new Date().toISOString(),
    windows,
    pace
  };
}

export function getLatestCompleteAshevilleDateKey(now = new Date()) {
  return formatDate(latestCompleteAshevilleDate(now));
}

function latestCompleteAshevilleDate(now) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ASHEVILLE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const today = new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day), 12));
  today.setUTCDate(today.getUTCDate() - 1);
  return today;
}

function lastNDaysFrom(n, latest) {
  return Array.from({ length: n }, (_, index) => {
    const date = new Date(latest);
    date.setUTCDate(latest.getUTCDate() - index);
    return date;
  });
}

function formatDate(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function roundRain(value) { return Math.round(value * 100) / 100; }
function daysInMonth(date) { return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate(); }
function getRollingNormalIn(days) { return days.reduce((total, date) => total + MONTHLY_NORMALS_IN[date.getUTCMonth()] / daysInMonth(date), 0); }
function sumPrecipForDays(values, days) { return days.reduce((total, date) => total + (values[formatDate(date)] ?? 0), 0); }

function gridIndex(lat, lon) {
  const lon360 = lon < 0 ? lon + 360 : lon;
  const x = Math.round((lon360 - CPC_GRID.minLon360) / CPC_GRID.dx);
  const y = Math.round((lat - CPC_GRID.minLat) / CPC_GRID.dy);
  return y * CPC_GRID.nx + x;
}

function precipUrl(date) {
  return `https://ftp.cpc.ncep.noaa.gov/precip/CPC_UNI_PRCP/GAUGE_CONUS/RT/${date.getUTCFullYear()}/PRCP_CU_GAUGE_V1.0CONUS_0.25deg.lnx.${formatDate(date)}.RT`;
}

async function findLatestAvailableDate(lat, lon, now, lookbackDays = 7) {
  const index = gridIndex(lat, lon);
  const expected = latestCompleteAshevilleDate(now);
  for (let offset = 0; offset < lookbackDays; offset++) {
    const date = new Date(expected);
    date.setUTCDate(expected.getUTCDate() - offset);
    const value = await readCPCValue(precipUrl(date), index);
    if (value !== null) return { date, value };
  }
  throw new Error(`No CPC rainfall analysis available through ${formatDate(expected)}`);
}

async function getPrecipByDateIn(lat, lon, days, seededValues = new Map()) {
  const index = gridIndex(lat, lon);
  const entries = await Promise.all(days.map(async (date) => {
    const key = formatDate(date);
    const value = seededValues.has(key)
      ? seededValues.get(key)
      : await readCPCValue(precipUrl(date), index);
    if (value === null) throw new Error(`Missing CPC rainfall analysis for ${formatDate(date)}`);
    return [key, value > 0 ? value * 0.1 * 0.03937 : 0];
  }));
  return Object.fromEntries(entries);
}

async function readCPCValue(url, index, attempts = 3) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      const data = new Float32Array(await response.arrayBuffer());
      const value = data[index];
      if (Number.isFinite(value) && value > -998) return value;
    } catch {
      // Retry transient CPC download errors before withholding the card data.
    }
  }
  return null;
}
