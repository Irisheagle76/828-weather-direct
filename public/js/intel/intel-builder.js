// /intel/intel-builder.js
// ============================================================
// INTEL BUILDER — Fetch → Normalize → Delegate to buildIntel
// ============================================================

import {
  getNearestWUStation,
  getWUCurrentConditions,
  getShortTermForecast,
  getMRMSPixel,
  getTempestDeviceObs
} from "../weather-fetch.js?v=1.0.0";

import buildIntel from "./buildIntel.js?v=1.0.0";

// Tempest config — you can move this to config if you want
const TEMPEST_DEVICE_ID = "315255";
const TEMPEST_TOKEN = "838ff386-d14b-4d45-897a-18903e6970a9";

export async function intelBuilder(lat, lon) {
  // ----------------------------------------------------------
  // 1. Fetch raw sources
  // ----------------------------------------------------------
  const nearest = await getNearestWUStation(lat, lon);
  const wuCurrent = await getWUCurrentConditions(nearest.stationId);
  const hourly = await getShortTermForecast(lat, lon);
  const mrmsPixel = await getMRMSPixel(lat, lon);
  const tempest = await getTempestDeviceObs(TEMPEST_DEVICE_ID, TEMPEST_TOKEN);

  const raw = {
    wuCurrent,
    openMeteoHourly: hourly,
    tempest,
    mrms: mrmsPixel
  };

  // ----------------------------------------------------------
  // 2. Build unified intel via modern pipeline
  // ----------------------------------------------------------
  const intel = await buildIntel(raw);

  // ----------------------------------------------------------
  // 3. Pulse (tidbits)
  // ----------------------------------------------------------
  try {
    const pulseRes = await fetch("/api/tidbits/pulse-latest");
    intel.pulse = await pulseRes.json();
  } catch {
    intel.pulse = null;
  }

  return intel;
}