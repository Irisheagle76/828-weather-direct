// /intel/risk-engine.js
// ============================================================
// RISK ENGINE — Frost, Freeze, Black Ice, Fog, Inversion
// Extracted cleanly from app.js (no renaming, no logic changes)
// ============================================================

export function computeRisks(intel) {
  const wu = intel.wu ?? {};
  const tempest = intel.tempest ?? {};
  const todayStats = intel.today?.stats ?? {};

  const temp = wu.temp ?? tempest.temp ?? null;
  const dew = wu.dewPoint ?? null;
  const wind = tempest.windSpeed ?? wu.windSpeed ?? 0;
  const precipRate = wu.precipRate ?? 0;

  const frostRisk =
    (dew <= 36 && temp <= 37) ? 0.7 :
    (temp <= 34) ? 1 : 0;

  const freezeRisk =
    temp <= 32 ? 1 :
    temp <= 34 ? 0.5 : 0;

  const inversionRisk =
    (temp <= 40 && wind < 3) ? 0.6 : 0;

  const blackIceRisk =
    (temp <= 32 && precipRate > 0) ? 1 :
    (temp <= 33 && todayStats.tempMin <= 30) ? 0.5 : 0;

  const valleyFogRisk =
    (wu.humidity >= 90 &&
     temp <= 50 &&
     wind < 3)
      ? 0.7 : 0;

  const ridgeFogRisk =
    (wu.humidity >= 95 &&
     intel.sky?.cloud >= 80 &&
     wind < 4)
      ? 0.6 : 0;

  return {
    frostRisk,
    freezeRisk,
    inversionRisk,
    blackIceRisk,
    valleyFogRisk,
    ridgeFogRisk
  };
}