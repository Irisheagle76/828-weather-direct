// /intel/buildIntel.js
// Modernized for Human‑Action 2.0
// Tempest-first ingestion, unified sky, forecast-intel pipeline

import { buildWeatherIntel } from "./forecast-intel.js?v=1.0.0";
import { computeRisks } from "./risk-engine.js?v=1.0.0";
import { summarizeRisks } from "./risk-summary.js?v=1.0.0";
import { computeSkyIntel } from "./sky-intel.js?v=1.0.0";   // you will modernize this next
import { buildFutureComfort } from "./comfort.js?v=1.0.0";  // already Tempest-first
import { computeComfort } from "./comfort.js?v=1.0.0";

// ------------------------------------------------------------
// MAIN INTEL BUILDER
// ------------------------------------------------------------
export default async function buildIntel(raw) {
  const intel = {};

  // ------------------------------------------------------------
  // 1. Attach raw sources (Tempest-first)
  // ------------------------------------------------------------
  intel.tempest = raw?.tempest ?? null;
  intel.wu = raw?.wuCurrent ?? null;
  intel.hourly = raw?.openMeteoHourly ?? null;

  // ------------------------------------------------------------
  // 2. Unified Sky Intel (Tempest → WU → OM)
  // ------------------------------------------------------------
  intel.sky = computeSkyIntel({
    tempest: intel.tempest,
    wu: intel.wu,
    hourly: intel.hourly
  });

  // ------------------------------------------------------------
  // 3. Human‑Action 2.0 (Today / Tonight / Tomorrow)
  // ------------------------------------------------------------
  intel.humanAction = buildWeatherIntel(intel.hourly);

  // ------------------------------------------------------------
  // 4. Future Comfort Window (next 6 hours)
  // ------------------------------------------------------------
  intel.futureComfortWindow = buildFutureComfort(
    intel.hourly,
    computeComfort
  );

  // ------------------------------------------------------------
  // 5. Real‑Time Comfort (Tempest-first)
  // ------------------------------------------------------------
  intel.comfortNow = computeComfort({
    tempest: intel.tempest,
    wu: intel.wu,
    hourly: intel.hourly,
    sky: intel.sky,
    futureComfortWindow: intel.futureComfortWindow
  });

  // ------------------------------------------------------------
  // 6. Risk Engine (Tempest-first + Human‑Action stats)
  // ------------------------------------------------------------
  intel.risks = computeRisks(intel);
  intel.riskSummary = summarizeRisks(intel.risks);

  // ------------------------------------------------------------
  // 7. Return unified intel object
  // ------------------------------------------------------------
  return intel;
}