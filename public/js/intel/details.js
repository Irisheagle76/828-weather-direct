// ============================================================
// DETAIL PANEL BUILDERS — Today + Tomorrow
// ============================================================

import { to12Hour } from "./core.js";

// ------------------------------------------------------------
// TODAY DETAIL
// ------------------------------------------------------------
export function buildTodayDetail(stats, events, window, hourly, indices) {
  if (!indices || indices.length === 0) {
    return {
      high: "--",
      low: "--",
      precipWindow: "None",
      windShifts: "None",
      confidence: "Medium",
      reasoning: "Insufficient data for detailed analysis."
    };
  }

  // High / Low
  const high = Math.round(stats.temp.max);
  const low = Math.round(stats.temp.min);

  // Precip window
  const precipHours = [];
  const rain = window.rain || [];
  const snow = window.snowfall || [];
  const times = window.time || [];

  for (let i = 0; i < rain.length; i++) {
    if ((rain[i] || 0) + (snow[i] || 0) > 0.02) {
      precipHours.push(to12Hour(times[i]));
    }
  }

  const precipWindow =
    precipHours.length === 0
      ? "None"
      : `${precipHours[0]}–${precipHours[precipHours.length - 1]}`;

  // Wind shifts
  const dirs = window.wind_direction_10m || [];
  let shifts = 0;
  for (let i = 1; i < dirs.length; i++) {
    if (Math.abs(dirs[i] - dirs[i - 1]) >= 45) shifts++;
  }

  const windShifts = shifts === 0 ? "None" : `${shifts} shifts`;

  // Confidence (simple heuristic)
  const confidence =
    indices.length >= 10 ? "High" : indices.length >= 6 ? "Medium" : "Low";

  // Reasoning
  const reasoning = events.front
    ? "A frontal passage influences temperature and wind changes."
    : events.driver === "rain"
    ? "Rain is the dominant driver today."
    : events.driver === "snow"
    ? "Snow impacts visibility and travel."
    : events.driver === "windy"
    ? "Wind gusts shape the day's feel."
    : "A quiet pattern with stable conditions.";

  return {
    high,
    low,
    precipWindow,
    windShifts,
    confidence,
    reasoning
  };
}

// ------------------------------------------------------------
// TOMORROW DETAIL
// ------------------------------------------------------------
export function buildTomorrowDetail(stats, events, window, hourly, indices) {
  if (!indices || indices.length === 0) {
    return {
      high: "--",
      low: "--",
      precipWindow: "None",
      peakUV: { max: 0, hours: [] },
      confidence: "Medium",
      reasoning: "Insufficient data for detailed analysis."
    };
  }

  const high = Math.round(stats.temp.max);
  const low = Math.round(stats.temp.min);

  // Precip window
  const precipHours = [];
  const rain = window.rain || [];
  const snow = window.snowfall || [];
  const times = window.time || [];

  for (let i = 0; i < rain.length; i++) {
    if ((rain[i] || 0) + (snow[i] || 0) > 0.02) {
      precipHours.push(to12Hour(times[i]));
    }
  }

  const precipWindow =
    precipHours.length === 0
      ? "None"
      : `${precipHours[0]}–${precipHours[precipHours.length - 1]}`;

  // Peak UV (simple)
  const uv = window.uv_index || [];
  const maxUV = Math.max(...uv, 0);
  const uvHours = [];

  for (let i = 0; i < uv.length; i++) {
    if (uv[i] === maxUV) {
      const hr = new Date(times[i]).getHours();
      uvHours.push(hr);
    }
  }

  const peakUV = { max: maxUV, hours: uvHours };

  // Confidence
  const confidence =
    indices.length >= 10 ? "High" : indices.length >= 6 ? "Medium" : "Low";

  // Reasoning
  const reasoning = events.front
    ? "A frontal passage shapes tomorrow's temperature and wind."
    : events.driver === "rain"
    ? "Rain is the dominant driver tomorrow."
    : events.driver === "snow"
    ? "Snow impacts visibility and travel."
    : events.driver === "windy"
    ? "Wind gusts influence the day's feel."
    : "A quiet pattern with stable conditions.";

  return {
    high,
    low,
    precipWindow,
    peakUV,
    confidence,
    reasoning
  };
}
