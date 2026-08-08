const ASHEVILLE = { lat: 35.5951, lon: -82.5515 };
const MONTHLY_NORMALS_IN = [
  4.13, 3.46, 3.80, 4.17, 4.13, 4.79,
  4.67, 5.04, 4.13, 3.37, 3.72, 4.18
];
const CPC_GRID = { minLon360: 230.125, minLat: 20.125, nx: 300, dx: 0.25, dy: 0.25 };

export async function getRainfallContextLive(endDate = new Date()) {
  const days = lastCompleteNDays(90, endDate);
  const precipByDate = await getPrecipByDateIn(ASHEVILLE.lat, ASHEVILLE.lon, days);
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

function lastCompleteNDays(n, endDate) {
  const latest = new Date(endDate);
  latest.setDate(latest.getDate() - 1);
  latest.setHours(12, 0, 0, 0);
  return Array.from({ length: n }, (_, index) => {
    const date = new Date(latest);
    date.setDate(latest.getDate() - index);
    return date;
  });
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function roundRain(value) { return Math.round(value * 100) / 100; }
function daysInMonth(date) { return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate(); }
function getRollingNormalIn(days) { return days.reduce((total, date) => total + MONTHLY_NORMALS_IN[date.getMonth()] / daysInMonth(date), 0); }
function sumPrecipForDays(values, days) { return days.reduce((total, date) => total + (values[formatDate(date)] ?? 0), 0); }

function gridIndex(lat, lon) {
  const lon360 = lon < 0 ? lon + 360 : lon;
  const x = Math.round((lon360 - CPC_GRID.minLon360) / CPC_GRID.dx);
  const y = Math.round((lat - CPC_GRID.minLat) / CPC_GRID.dy);
  return y * CPC_GRID.nx + x;
}

function precipUrl(date) {
  return `https://ftp.cpc.ncep.noaa.gov/precip/CPC_UNI_PRCP/GAUGE_CONUS/RT/${date.getFullYear()}/PRCP_CU_GAUGE_V1.0CONUS_0.25deg.lnx.${formatDate(date)}.RT`;
}

async function getPrecipByDateIn(lat, lon, days) {
  const index = gridIndex(lat, lon);
  const entries = await Promise.all(days.map(async (date) => {
    const value = await readCPCValue(precipUrl(date), index);
    if (value === null) throw new Error(`Missing CPC rainfall analysis for ${formatDate(date)}`);
    return [formatDate(date), value > 0 ? value * 0.1 * 0.03937 : 0];
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
