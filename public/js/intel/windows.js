// ============================================================
// WINDOWING + TIME LOGIC
// Defines how we slice Today and Tomorrow into usable hourly windows.
// This module is CRITICAL for preventing stale or frozen outlooks.
// ============================================================

// Return all hourly indices for a specific calendar day
export function getHourlyWindowForDay(hourly, targetDate) {
  const times = hourly.time || [];
  const indices = [];

  const start = new Date(targetDate);
  start.setHours(0, 0, 0, 0);

  const end = new Date(targetDate);
  end.setHours(23, 59, 59, 999);

  for (let i = 0; i < times.length; i++) {
    const t = new Date(times[i]);
    if (t >= start && t <= end) indices.push(i);
  }

  return indices;
}

// ------------------------------------------------------------
// TODAY WINDOW — Remaining hours from "now" to midnight
// Requires at least 3 hours to produce a meaningful outlook.
// ------------------------------------------------------------
export function getTodayRemainingWindow(hourly) {
  const times = hourly.time || [];
  const indices = [];

  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  for (let i = 0; i < times.length; i++) {
    const t = new Date(times[i]);
    if (t >= now && t <= end) indices.push(i);
  }

  // Require at least 3 hours to avoid unstable or misleading output
  if (indices.length < 3) return [];
  return indices;
}

// ------------------------------------------------------------
// TOMORROW WINDOW — Full calendar day after today
// Requires at least 6 hours to avoid the "frozen tomorrow" bug.
// ------------------------------------------------------------
export function getTomorrowWindow(hourly) {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);

  const indices = getHourlyWindowForDay(hourly, tomorrow);

  // Require at least 6 hours to ensure meaningful synthesis
  if (indices.length < 6) return [];
  return indices;
}

// ------------------------------------------------------------
// Slice hourly data by index list
// Produces a clean "window" object with arrays trimmed to the window.
// ------------------------------------------------------------
export function sliceHourly(hourly, indices) {
  const keys = Object.keys(hourly || {});
  const out = {};

  for (const k of keys) {
    const arr = hourly[k];
    if (!Array.isArray(arr)) continue;
    out[k] = indices.map(i => arr[i]);
  }

  return out;
}
