// /intel/right-now-snapshot.js
// Human‑Action Snapshot Builder — Tempest‑First, Asheville‑Aware

import { LOCATION } from "/js/config/location.js";

// ------------------------------------------------------------
// Solar Elevation
// ------------------------------------------------------------
function computeSolarElevation(timestamp, lat, lon) {
  const date = new Date(timestamp);
  const rad = Math.PI / 180;

  const day = Math.floor((date - new Date(date.getFullYear(), 0, 0)) / 86400000);
  const decl = 23.45 * rad * Math.sin(rad * ((360 / 365) * (day - 81)));

  const time = date.getHours() + date.getMinutes() / 60;
  const solarTime = time + (lon / 15);

  const hourAngle = rad * (15 * (solarTime - 12));
  const latRad = lat * rad;

  const elevation = Math.asin(
    Math.sin(latRad) * Math.sin(decl) +
    Math.cos(latRad) * Math.cos(decl) * Math.cos(hourAngle)
  );

  return elevation * (180 / Math.PI);
}

// ------------------------------------------------------------
// Dewpoint → RH
// ------------------------------------------------------------
function dewToRH(tempF, dewF) {
  const t = (tempF - 32) * 5/9;
  const d = (dewF - 32) * 5/9;

  const rh = 100 * (
    Math.exp((17.625 * d) / (243.04 + d)) /
    Math.exp((17.625 * t) / (243.04 + t))
  );

  return Math.max(0, Math.min(100, rh));
}

// ------------------------------------------------------------
// Wind Chill
// ------------------------------------------------------------
function computeWindChill(tempF, windMph) {
  if (tempF > 50 || windMph < 3) return tempF;
  return (
    35.74 +
    0.6215 * tempF -
    35.75 * Math.pow(windMph, 0.16) +
    0.4275 * tempF * Math.pow(windMph, 0.16)
  );
}

// ------------------------------------------------------------
// Snapshot Builder
// ------------------------------------------------------------
export function buildRightNowSnapshot(raw) {
  const src = raw.tempest ?? raw.wu ?? {};
  const sky = raw.sky ?? {};

  const temp = src.temp ?? null;
  const dew = src.dewPoint ?? null;
  const wind = src.windSpeed ?? null;
  const gust = src.windGust ?? null;
  const cloud = sky.cloud ?? src.cloudCover ?? null;
  const precipType = src.precipType ?? null;
  const precipRate = src.precipRate ?? 0;
  const visibility = sky.visibilityKm ?? null;

  const timestamp = src.obsTimeLocal ?? Date.now();
  const solarElevation = computeSolarElevation(timestamp, LOCATION.lat, LOCATION.lon);

  const feelsLike = computeWindChill(temp, wind);
  const rh = dew != null && temp != null ? dewToRH(temp, dew) : null;

  return {
    temp,
    dewpoint: dew,
    rh,
    wind,
    gust,
    cloudCover: cloud,
    precipType,
    precipRate,
    visibility,
    solarElevation,
    feelsLike,
    timestamp
  };
}