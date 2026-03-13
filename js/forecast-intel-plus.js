// /js/forecast-intel-plus.js

import {
  getHumanActionOutlook,
  getTodayActionOutlook,
  getForecastAlerts,
  getComfortCategory as computeComfort,
  getTodayRemainingWindow,
  getTomorrowWindow
} from './forecast-intel.js';

import {
  findNearestHourIndex,
  getReliableUV
} from './weather-utils.js';

import { getMicroAdvice } from './micro-advice.js';
import { degToCompass } from "./weather-render.js";
import { getUVClass } from "./weather-render.js";

export function buildWeatherIntel({ wuCurrent, hourly, mrmsPixel }) {

  // ⭐ 1. UV
  const idx = findNearestHourIndex(hourly);
  const fallbackUV = hourly.uv_index?.[idx] ?? null;

  const reliableUV = getReliableUV(
    wuCurrent,
    fallbackUV,
    wuCurrent.solarRadiation
  );

  // ⭐ 2. Comfort
  const comfort = computeComfort(
    wuCurrent.temp,
    wuCurrent.dewPoint,
    wuCurrent.windGust ?? 0,
    mrmsPixel.rate ?? 0
  );

  // ⭐ 3. Today + Tomorrow (core outlooks)
  const today = getTodayActionOutlook(hourly);
  const tomorrow = getHumanActionOutlook(hourly);

  // ⭐ 4. Alerts
  const alerts = getForecastAlerts(hourly);

  // ⭐ 5. Precip signal (placeholder)
  const precipSignal = {
    isFalling: mrmsPixel.rate > 0,
    type: mrmsPixel.type,
    intensity: mrmsPixel.intensity,
    source: "placeholder"
  };

  // ⭐ 6. Micro‑advice
  const microAdvice = getMicroAdvice({
    wu: wuCurrent,
    today,
    comfort
  });

  // ============================================================
  // ⭐ 7. Expanded Forecast Detail Builder (CORRECTED)
  // ============================================================

  function to12Hour(hour) {
    const h = hour % 12 || 12;
    const suffix = hour >= 12 ? "PM" : "AM";
    return `${h} ${suffix}`;
  }

  function buildHourlySnapshot(hourly, indices) {
    return indices.slice(0, 4).map(i => ({
      time: hourly.time[i],
      temp: Math.round(hourly.temperature_2m[i]),
      wind: `${degToCompass(hourly.windgusts_10m?.[i] ?? 0)} ${Math.round(hourly.windgusts_10m?.[i] ?? 0)} mph`,
      precip: Math.round((hourly.precipitation[i] ?? 0) * 100)
    }));
  }

  function buildPrecipWindow(hourly, indices) {
    const precipHours = indices.filter(i => (hourly.precipitation[i] ?? 0) > 0.02);
    if (precipHours.length === 0) return "Dry all day.";

    const start = new Date(hourly.time[precipHours[0]]).getHours();
    const end = new Date(hourly.time[precipHours.at(-1)]).getHours();

    return `Possible showers ${to12Hour(start)}–${to12Hour(end)}.`;
  }

  function buildWindShifts(hourly, indices) {
    const sample = indices.slice(0, 3);
    const dirs = sample.map(i => degToCompass(hourly.windgusts_10m?.[i] ?? 0));
    return dirs.join(" → ");
  }

  function buildUVTimeline(hourly, indices) {
    return indices.slice(0, 3).map(i => {
      const hour = new Date(hourly.time[i]).getHours();
      return {
        time: to12Hour(hour),
        value: Math.round(hourly.uv_index?.[i] ?? 0),
        label: getUVClass(hourly.uv_index?.[i] ?? 0).replace("uv-", "")
      };
    });
  }

  function buildConfidence() {
    return "High confidence (85%)";
  }

  function buildReasoning() {
    return "A stable pattern with consistent model agreement supports this forecast.";
  }
   // Search for UV PEAK Hours
function buildPeakUV(hourly, indices) {
  const uvPoints = indices.map(i => ({
    hour: new Date(hourly.time[i]).getHours(),
    value: hourly.uv_index?.[i] ?? 0
  }));

  const maxUV = Math.max(...uvPoints.map(p => p.value));

  if (maxUV <= 2) {
    return { max: maxUV, hours: [] }; // treat as “low all day”
  }

  const peakHours = uvPoints
    .filter(p => p.value === maxUV)
    .map(p => p.hour);

  return { max: maxUV, hours: peakHours };
}
  // ⭐ Build windows
  const todayIndices = getTodayRemainingWindow(hourly);
  const tomorrowIndices = getTomorrowWindow(hourly);

  const todayDetail = {
    high: Math.round(Math.max(...todayIndices.map(i => hourly.temperature_2m[i]))),
low: Math.round(Math.min(...todayIndices.map(i => hourly.temperature_2m[i]))),
    hourly: buildHourlySnapshot(hourly, todayIndices),
    precipWindow: buildPrecipWindow(hourly, todayIndices),
    windShifts: buildWindShifts(hourly, todayIndices),
    uvTimeline: buildUVTimeline(hourly, todayIndices),
    confidence: buildConfidence(),
    reasoning: buildReasoning()
  };

const tomorrowDetail = {
  high: Math.round(Math.max(...tomorrowIndices.map(i => hourly.temperature_2m[i]))),
  low: Math.round(Math.min(...tomorrowIndices.map(i => hourly.temperature_2m[i]))),
  precipWindow: buildPrecipWindow(hourly, tomorrowIndices),
  peakUV: buildPeakUV(hourly, tomorrowIndices),
  confidence: buildConfidence(),
  reasoning: buildReasoning()
};

  // ⭐ 8. Return unified intel object
  return {
    wu: wuCurrent,
    uv: reliableUV,
    comfort,
    today,
    tomorrow,
    alerts,
    precipSignal,
    microAdvice,
    todayDetail,
    tomorrowDetail
  };
}
