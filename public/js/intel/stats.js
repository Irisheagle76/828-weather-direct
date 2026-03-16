// ============================================================
// STATS + NORMALIZATION
// Computes temperature, dewpoint, wind, precip, and snow stats
// for any hourly window. All downstream logic depends on these
// being stable, complete, and never undefined.
// ============================================================

// Safe min/max helpers
function safeMin(arr) {
  return arr && arr.length ? Math.min(...arr) : null;
}
function safeMax(arr) {
  return arr && arr.length ? Math.max(...arr) : null;
}
function safeAvg(arr) {
  return arr && arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
}

// ------------------------------------------------------------
// Temperature stats
// ------------------------------------------------------------
export function getTempStats(window) {
  const t = window.temperature_2m || [];
  return {
    min: safeMin(t),
    max: safeMax(t),
    avg: safeAvg(t)
  };
}

// ------------------------------------------------------------
// Dewpoint stats
// ------------------------------------------------------------
export function getDewStats(window) {
  const d = window.dewpoint_2m || [];
  return {
    min: safeMin(d),
    max: safeMax(d),
    avg: safeAvg(d)
  };
}

// ------------------------------------------------------------
// Wind stats
// ------------------------------------------------------------
export function getWindStats(window) {
  const s = window.wind_speed_10m || [];
  const g = window.wind_gusts_10m || [];
  const d = window.wind_direction_10m || [];

  return {
    min: safeMin(s),
    max: safeMax(s),
    avg: safeAvg(s),
    gustMax: safeMax(g),
    dirAvg: safeAvg(d)
  };
}

// ------------------------------------------------------------
// Precipitation totals (rain + snow)
// ------------------------------------------------------------
export function getPrecipStats(window) {
  const rain = window.rain || [];
  const snow = window.snowfall || [];

  const rainTotal = rain.reduce((a, b) => a + (b || 0), 0);
  const snowTotal = snow.reduce((a, b) => a + (b || 0), 0);

  return {
    rainTotal,
    snowTotal
  };
}

// ------------------------------------------------------------
// Cloud cover stats
// ------------------------------------------------------------
export function getCloudStats(window) {
  const c = window.cloudcover || [];
  return {
    min: safeMin(c),
    max: safeMax(c),
    avg: safeAvg(c)
  };
}

// ------------------------------------------------------------
// Unified stats bundle
// ------------------------------------------------------------
export function getUnifiedStats(window) {
  return {
    temp: getTempStats(window),
    dew: getDewStats(window),
    wind: getWindStats(window),
    precip: getPrecipStats(window),
    clouds: getCloudStats(window)
  };
}
