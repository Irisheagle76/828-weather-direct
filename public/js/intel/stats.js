// /intel/stats.js
// Modern window-aware stats engine

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

  for (const i of windowHours) {
    temps.push(hourly.temperature_2m[i]);
    winds.push(hourly.wind_speed_10m[i]);
    gusts.push(hourly.wind_gusts_10m[i]);
    rains.push(hourly.rain[i]);
    snows.push(hourly.snowfall[i]);
    clouds.push(hourly.cloudcover[i]);
  }

  return {
    tempMin: Math.min(...temps),
    tempMax: Math.max(...temps),
    windAvg: avg(winds),
    windGustMax: Math.max(...gusts),
    rainTotal: sum(rains),
    snowTotal: sum(snows),
    cloudAvg: avg(clouds)
  };
}

function avg(arr) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function sum(arr) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) : 0;
}

function emptyStats() {
  return {
    tempMin: null,
    tempMax: null,
    windAvg: null,
    windGustMax: null,
    rainTotal: null,
    snowTotal: null,
    cloudAvg: null
  };
}
