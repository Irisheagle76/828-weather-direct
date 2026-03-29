// /intel/next6-snapshots.js
// Human‑Action Snapshot Builder — Next 6 Hours (Open‑Meteo Only)

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
// Build a single hourly snapshot
// ------------------------------------------------------------
function buildHourlySnapshot(hourly, idx) {
  const temp = hourly.temperature_2m[idx];
  const dew = hourly.dewpoint_2m[idx];
  const wind = hourly.wind_speed_10m[idx];
  const gust = hourly.wind_gusts_10m?.[idx] ?? null;
  const cloud = hourly.cloudcover?.[idx] ?? null;
  const precip = hourly.precipitation?.[idx] ?? 0;
  const visibility = hourly.visibility?.[idx] ?? null;
  const timestamp = hourly.time[idx];

  const solarElevation = computeSolarElevation(timestamp, LOCATION.lat, LOCATION.lon);
  const rh = dewToRH(temp, dew);

  return {
    temp,
    dewpoint: dew,
    rh,
    wind,
    gust,
    cloudCover: cloud,
    precipAmount: precip,
    visibility,
    solarElevation,
    feelsLike: temp, // factor engine will adjust if needed
    timestamp
  };
}

// ------------------------------------------------------------
// Build the next 6 snapshots
// ------------------------------------------------------------
export function buildNext6HoursSnapshots(hourly) {
  if (!hourly || !hourly.time) return [];

  const now = Date.now();
  const times = hourly.time;

  let startIndex = times.findIndex(t => new Date(t).getTime() > now);
  if (startIndex === -1) return [];

  const snapshots = [];

  for (let i = 0; i < 6; i++) {
    const idx = startIndex + i;
    if (idx >= times.length) break;

    const snap = buildHourlySnapshot(hourly, idx);

    snapshots.push({
      index: idx,
      hourLabel: formatHourLabel(hourly.time[idx]),
      snapshot: snap
    });
  }

  return snapshots;
}

// ------------------------------------------------------------
// Timezone‑safe hour label
// ------------------------------------------------------------
function formatHourLabel(iso) {
  const d = new Date(iso);

  const formatter = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    hour12: true,
    timeZone: "America/New_York"
  });

  const parts = formatter.formatToParts(d);
  const hour = parts.find(p => p.type === "hour")?.value ?? "";
  const suffix = parts.find(p => p.type === "dayPeriod")?.value?.toUpperCase() ?? "";

  return `${hour} ${suffix}`;
}