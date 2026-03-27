// /intel/intel-builder.js
// ============================================================
// INTEL BUILDER — Fetch → Normalize → Compute → Return
// Clean modular extraction of your existing intel pipeline
// ============================================================

import {
  getNearestWUStation,
  getWUCurrentConditions,
  getShortTermForecast,
  getMRMSPixel,
  getTempestDeviceObs
} from "../weather-fetch.js?v=1.0.0";

import { computeComfort, buildFutureComfort } from "./comfort.js?v=1.0.0";
import { getReliableUV } from "./uv.js?v=1.0.0";
import { computeRisks } from "./risk-engine.js?v=1.0.0";

export async function buildIntel(lat, lon) {
  const nearest = await getNearestWUStation(lat, lon);
  const wuCurrent = await getWUCurrentConditions(nearest.stationId);

  const TEMPEST_DEVICE_ID = "315255";
  const TEMPEST_TOKEN = "838ff386-d14b-4d45-897a-18903e6970a9";

  const tempest = await getTempestDeviceObs(TEMPEST_DEVICE_ID, TEMPEST_TOKEN);
  const tempestHigh = tempest?.tempHighToday ?? null;

  const hourly = await getShortTermForecast(lat, lon);
  const mrmsPixel = await getMRMSPixel(lat, lon);

  const intel = {};
  intel.wu = wuCurrent;
  intel.tempest = tempest;
  intel.hourly = hourly;
  intel.mrms = mrmsPixel;

  // SKY INTEL
  intel.sky = {
    cloud:
      intel.wu.cloudCover ??
      (intel.tempest?.illuminance != null
        ? Math.max(
            0,
            Math.min(100, 100 - (intel.tempest.illuminance / 120000) * 100)
          )
        : null) ??
      hourly.cloudcover?.[0] ??
      null,

    uv:
      intel.tempest?.uv ??
      intel.wu?.uv ??
      hourly.uv_index?.[0] ??
      null,

    solar:
      intel.tempest?.solarRadiation ??
      intel.wu?.solarRadiation ??
      null
  };

  // CURRENT CONDITIONS
  intel.current = {
    temp: intel.tempest?.temp ?? intel.wu?.temp ?? null,
    feelsLike: intel.tempest?.temp ?? intel.wu?.temp ?? null,
    dewpoint: intel.wu?.dewPoint ?? null,
    humidity: intel.tempest?.humidity ?? intel.wu?.humidity ?? null,
    windSpeed: intel.tempest?.windSpeed ?? intel.wu?.windSpeed ?? null,
    windGust: intel.tempest?.windGust ?? intel.wu?.windGust ?? null,
    windDir: intel.tempest?.windDir ?? intel.wu?.windDir ?? null,
    precipType: intel.tempest?.precipType ?? intel.wu?.precipType ?? null,
    precipIntensity: intel.wu?.precipRate ?? 0,
    cloudCover: intel.sky.cloud != null ? intel.sky.cloud / 100 : null,
    uvIndex: intel.sky.uv ?? null,
    visibility: intel.wu?.visibility ?? 10,
    smokeIndex: intel.wu?.smokeIndex ?? 0,
    timestamp:
      intel.tempest?.timestamp ??
      intel.wu?.obsTimeLocal ??
      Date.now()
  };

  // TODAY STATS
  intel.today = intel.today || {};
  intel.today.stats = intel.today.stats || {};
  intel.today.stats.maxTemp = tempestHigh;

  // TOMORROW STATS (required for Human‑Action 2.0)
intel.tomorrow = intel.tomorrow || {};
intel.tomorrow.available = true;
intel.tomorrow.stats = {
  tempMax: hourly.temperature_2m_max?.[1] ?? null,
  tempMin: hourly.temperature_2m_min?.[1] ?? null,
  windAvg: hourly.windspeed_10m?.[1] ?? null,
  windGustMax: hourly.windgusts_10m?.[1] ?? null,
  rainTotal: hourly.rain?.[1] ?? 0,
  snowTotal: hourly.snowfall?.[1] ?? 0,
  cloudAvg: hourly.cloudcover?.[1] ?? null
};

  // RISK FACTORS
  Object.assign(intel.current, computeRisks(intel));

  // COMFORT + UV
  intel.comfort = computeComfort(intel);
  intel.uv = getReliableUV(intel);
  intel.futureComfort = buildFutureComfort(intel.hourly, computeComfort);

  // PULSE
  try {
    const pulseRes = await fetch("/api/tidbits/pulse-latest");
    intel.pulse = await pulseRes.json();
  } catch {
    intel.pulse = null;
  }

  return intel;
}