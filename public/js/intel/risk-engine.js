// /intel/risk-engine.js
// ============================================================
// RISK ENGINE — Frost, Freeze, Black Ice, Fog, Inversion
// Updated for Human‑Action 2.0 + Tempest-first ingestion
// ============================================================

export function computeRisks(intel) {
  // Prefer Tempest for hyper-local accuracy
  const src = intel.tempest ?? intel.wu ?? {};
  const sky = intel.sky ?? {};

  // Human‑Action stats for context (today or tonight)
  const todayStats =
    intel?.humanAction?.today?.stats ??
    intel?.humanAction?.tonight?.stats ??
    intel?.humanAction?.tomorrow?.stats ??
    {};

  const temp = src.temp ?? null;
  const dew = src.dewPoint ?? null;
  const wind = src.windSpeed ?? 0;
  const humidity = src.humidity ?? sky.humidity ?? null;
  const precipRate = src.precipRate ?? 0;

  // ------------------------------------------------------------
  // Frost Risk — dewpoint near freezing + calm winds
  // ------------------------------------------------------------
  const frostRisk =
    (dew != null && dew <= 36 && temp <= 37 && wind < 4) ? 0.7 :
    (temp <= 34 && wind < 5) ? 1 :
    0;

  // ------------------------------------------------------------
  // Freeze Risk — pure temperature threshold
  // ------------------------------------------------------------
  const freezeRisk =
    temp <= 32 ? 1 :
    temp <= 34 ? 0.5 :
    0;

  // ------------------------------------------------------------
  // Inversion Risk — calm + cold + stable sky
  // ------------------------------------------------------------
  const inversionRisk =
    (temp <= 40 && wind < 3 && (sky.cloud ?? 100) < 70) ? 0.6 : 0;

  // ------------------------------------------------------------
  // Black Ice Risk — freezing temps + precip OR recent freeze
  // ------------------------------------------------------------
  const blackIceRisk =
    (temp <= 32 && precipRate > 0) ? 1 :
    (temp <= 33 && todayStats.tempMin <= 30) ? 0.5 :
    0;

  // ------------------------------------------------------------
  // Valley Fog Risk — humid + cool + calm
  // ------------------------------------------------------------
  const valleyFogRisk =
    (humidity >= 90 &&
     temp <= 50 &&
     wind < 3)
      ? 0.7 : 0;

  // ------------------------------------------------------------
  // Ridge Fog Risk — humid + cloudy + light wind
  // ------------------------------------------------------------
  const ridgeFogRisk =
    (humidity >= 95 &&
     (sky.cloud ?? 100) >= 80 &&
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