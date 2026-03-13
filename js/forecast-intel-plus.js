// /js/forecast-intel-plus.js

import {
  getHumanActionOutlook,
  getTodayActionOutlook,
  getForecastAlerts,
  getComfortCategory as computeComfort
} from './forecast-intel.js';

import {
  findNearestHourIndex,
  getReliableUV
} from './weather-utils.js';

import { getMicroAdvice } from './micro-advice.js';
import { degToCompass } from "./weather-render.js";
import { getUVClass } from "./weather-render.js";

/**
 * Build a unified weather intelligence object.
 * Combines:
 *  - WU current conditions
 *  - Open‑Meteo hourly forecast
 *  - MRMS pixel (placeholder until Step 5)
 */
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

  // ⭐ 3. Today + Tomorrow
  const today = getTodayActionOutlook(hourly);
  const tomorrow = getHumanActionOutlook(hourly);

  // ⭐ 4. Alerts
  const alerts = getForecastAlerts(hourly);

  // ⭐ 5. Precip signal (placeholder — MRMS logic added in Step 5)
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
  // ⭐ 7. Expanded Forecast Detail Builder (NEW)
  // ============================================================

  // Helper: pick 4 key hours (12 PM, 2 PM, 4 PM, 6 PM)
  function buildHourlySnapshot(hourly) {
    const targetHours = ["12:00", "14:00", "16:00", "18:00"];

    return targetHours.map(t => {
      const idx = hourly.time.findIndex(h => h.includes(t));
      if (idx === -1) return null;

      return {
        time: t.replace(":00", ""), // "12", "14", etc.
        temp: Math.round(hourly.temperature_2m[idx]),
        wind: `${degToCompass(hourly.winddirection_10m?.[idx] ?? 0)} ${Math.round(hourly.windspeed_10m?.[idx] ?? 0)} mph`,
        precip: Math.round((hourly.precipitation[idx] ?? 0) * 100)
      };
    }).filter(Boolean);
  }

  // Helper: simple precip window logic
  function buildPrecipWindow(hourly) {
    const precipHours = [];

    for (let i = 0; i < 24; i++) {
      if ((hourly.precipitation[i] ?? 0) > 0.02) {
        precipHours.push(i);
      }
    }

    if (precipHours.length === 0) return "Dry all day.";

    const start = precipHours[0];
    const end = precipHours[precipHours.length - 1];

    return `Possible showers ${start}:00–${end}:00.`;
  }

  // Helper: wind shift summary
  function buildWindShifts(hourly) {
    const noon = degToCompass(hourly.winddirection_10m?.[12] ?? 0);
    const afternoon = degToCompass(hourly.winddirection_10m?.[15] ?? 0);
    const evening = degToCompass(hourly.winddirection_10m?.[18] ?? 0);

    return `${noon} → ${afternoon} → ${evening}`;
  }

  // Helper: UV timeline (3 points)
  function buildUVTimeline(hourly) {
    const times = [12, 14, 16];
    return times.map(h => ({
      time: `${h} PM`,
      value: Math.round(hourly.uv_index?.[h] ?? 0),
      label: getUVClass(hourly.uv_index?.[h] ?? 0).replace("uv-", "")
    }));
  }

  // Helper: confidence (placeholder)
  function buildConfidence() {
    return "High confidence (85%)";
  }

  // Helper: reasoning (placeholder)
  function buildReasoning() {
    return "A stable pattern with consistent model agreement supports this forecast.";
  }

  // Attach to intel object
  const todayDetail = {
    high: today.high,
    low: today.low,
    hourly: buildHourlySnapshot(hourly),
    precipWindow: buildPrecipWindow(hourly),
    windShifts: buildWindShifts(hourly),
    uvTimeline: buildUVTimeline(hourly),
    confidence: buildConfidence(),
    reasoning: buildReasoning()
  };

  const tomorrowDetail = {
    high: tomorrow.high,
    low: tomorrow.low,
    hourly: buildHourlySnapshot(hourly),
    precipWindow: buildPrecipWindow(hourly),
    windShifts: buildWindShifts(hourly),
    uvTimeline: buildUVTimeline(hourly),
    confidence: buildConfidence(),
    reasoning: buildReasoning()
  };

  // ⭐ 8. Return unified intel object (now with details)
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
