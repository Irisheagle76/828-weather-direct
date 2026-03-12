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
  // ⭐ 7. Return unified intel object
  return {
  wu: wuCurrent,
  uv: reliableUV,
  comfort,
  today,
  tomorrow,
  alerts,
  precipSignal,
  microAdvice
  };
}
