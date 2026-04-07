// /intel/stats.js
// Sky-aware stats engine — HA2.1

export function computeStats(hourly, windowHours, sky) {
  if (!windowHours || windowHours.length === 0) {
    return emptyStats();
  }

  const temps = [];
  const winds = [];
  const gusts = [];
  const rains = [];
  const snows = [];
  const cloudsOM = [];
  const humidities = [];
  const dewpoints = [];
  const uvsOM = [];

  // Sky-aware accumulators
  const cloudSky = [];
  const uvSky = [];
  const solarSky = [];
  const visibilitySky = [];
  const fogPotentialSky = [];
  const cloudStates = [];

  let fogHours = 0;

  for (const i of windowHours) {
    const t = hourly.temperature_2m[i];
    const h = hourly.relativehumidity_2m?.[i] ?? null;
    const d = hourly.dew_point_2m?.[i] ?? null;
    const uv = hourly.uv_index?.[i] ?? null;
    const cloud = hourly.cloudcover[i];

    temps.push(t);
    winds.push(hourly.wind_speed[i]);
    gusts.push(hourly.wind_gusts_10m[i]);
    rains.push(hourly.rain[i]);
    snows.push(hourly.snowfall[i]);
    cloudsOM.push(cloud);

    if (h != null) humidities.push(h);
    if (d != null) dewpoints.push(d);
    if (uv != null) uvsOM.push(uv);

    // Fog heuristic (OM-based)
    if (h >= 95 && cloud >= 90) fogHours++;

    // Sky-aware values (same for all hours in window)
    if (sky?.cloud != null) cloudSky.push(sky.cloud);
    if (sky?.uv != null) uvSky.push(sky.uv);
    if (sky?.solar != null) solarSky.push(sky.solar);
    if (sky?.visibilityKm != null) visibilitySky.push(sky.visibilityKm);
    if (sky?.fogPotential != null) fogPotentialSky.push(sky.fogPotential);
    if (sky?.cloudState) cloudStates.push(sky.cloudState);
  }

  // Previous-day low (for black ice logic)
  const prevIndex = windowHours[0] - 1;
  const tempMinPrev =
    prevIndex >= 0 ? hourly.temperature_2m[prevIndex] : null;

  return {
    // Core stats
    tempMin: Math.min(...temps),
    tempMax: Math.max(...temps),
    windAvg: avg(winds),
    windGustMax: Math.max(...gusts),
    rainTotal: sum(rains),
    snowTotal: sum(snows),
    cloudAvg: avg(cloudsOM),

    // HA2.0 fields
    humidityAvg: humidities.length ? avg(humidities) : null,
    dewpointAvg: dewpoints.length ? avg(dewpoints) : null,
    uvMax: uvsOM.length ? Math.max(...uvsOM) : null,
    fogHours,
    tempMinPrev,

    // ⭐ Sky-aware fields
    cloudAvgSky: cloudSky.length ? avg(cloudSky) : null,
    uvMaxSky: uvSky.length ? Math.max(...uvSky) : null,
    solarMax: solarSky.length ? Math.max(...solarSky) : null,
    visibilityMin: visibilitySky.length ? Math.min(...visibilitySky) : null,
    fogPotentialAvg: fogPotentialSky.length ? avg(fogPotentialSky) : null,
    cloudStateDominant: dominant(cloudStates)
  };
}

function avg(arr) {
  return arr.length
    ? arr.reduce((a, b) => a + b, 0) / arr.length
    : null;
}

function sum(arr) {
  return arr.length
    ? arr.reduce((a, b) => a + b, 0)
    : 0;
}

function dominant(arr) {
  if (!arr.length) return null;
  const counts = {};
  for (const v of arr) counts[v] = (counts[v] || 0) + 1;
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
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

    humidityAvg: null,
    dewpointAvg: null,
    uvMax: null,
    fogHours: 0,
    tempMinPrev: null,

    cloudAvgSky: null,
    uvMaxSky: null,
    solarMax: null,
    visibilityMin: null,
    fogPotentialAvg: null,
    cloudStateDominant: null
  };
}