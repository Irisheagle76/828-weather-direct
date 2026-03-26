// /intel/stats.js
// Modern window-aware stats engine — HA2.0 compatible

export function computeStats(hourly, windowHours) {
  if (!windowHours || windowHours.length === 0) {
    return emptyStats();
  }

  const temps = [];
  const winds = [];
  const gusts = [];
  const rains = [];
  const snows = [];
  const clouds = [];
  const humidities = [];
  const dewpoints = [];
  const uvs = [];

  let fogHours = 0;

  for (const i of windowHours) {
    const t = hourly.temperature_2m[i];
    const h = hourly.relativehumidity_2m?.[i] ?? null;
    const d = hourly.dewpoint_2m?.[i] ?? null;
    const uv = hourly.uv_index?.[i] ?? null;
    const cloud = hourly.cloudcover[i];

    temps.push(t);
    winds.push(hourly.wind_speed_10m[i]);
    gusts.push(hourly.wind_gusts_10m[i]);
    rains.push(hourly.rain[i]);
    snows.push(hourly.snowfall[i]);
    clouds.push(cloud);

    if (h != null) humidities.push(h);
    if (d != null) dewpoints.push(d);
    if (uv != null) uvs.push(uv);

    // Fog heuristic: humidity ≥ 95% AND cloud cover ≥ 90%
    if (h >= 95 && cloud >= 90) fogHours++;
  }

  // Previous-day low (for black ice logic)
  const prevIndex = windowHours[0] - 1;
  const tempMinPrev =
    prevIndex >= 0 ? hourly.temperature_2m[prevIndex] : null;

  return {
    // Existing stats
    tempMin: Math.min(...temps),
    tempMax: Math.max(...temps),
    windAvg: avg(winds),
    windGustMax: Math.max(...gusts),
    rainTotal: sum(rains),
    snowTotal: sum(snows),
    cloudAvg: avg(clouds),

    // ⭐ NEW — HA2.0 required fields
    humidityAvg: humidities.length ? avg(humidities) : null,
    dewpointAvg: dewpoints.length ? avg(dewpoints) : null,
    uvMax: uvs.length ? Math.max(...uvs) : null,
    fogHours,
    tempMinPrev
  };
}

function avg(arr) {
  return arr.length
    ? arr.reduce((a, b) => a + b, 0) / arr.length
    : 0;
}

function sum(arr) {
  return arr.length
    ? arr.reduce((a, b) => a + b, 0)
    : 0;
}

function emptyStats() {
  return {
    tempMin: null,
    tempMax: null,
    windAvg: null,
    windGustMax: null,
    rainTotal: null,
    snowTotal: null,
    cloudAvg: null,

    // ⭐ NEW fields default to null/0
    humidityAvg: null,
    dewpointAvg: null,
    uvMax: null,
    fogHours: 0,
    tempMinPrev: null
  };
}