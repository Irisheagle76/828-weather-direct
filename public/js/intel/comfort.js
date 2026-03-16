// ============================================================
// COMFORT + CLOTHING + SEASONAL NUANCE
// This module defines how the weather *feels* and what users
// should consider wearing. It is expressive, punchy, and safe.
// ============================================================

import { getSeasonalContext } from "./core.js";

// ------------------------------------------------------------
// Temperature feel categories
// ------------------------------------------------------------
export function getTempFeel(tempStats, season) {
  const t = tempStats.avg;

  if (t == null) return "unknown";

  if (t >= 90) return "very hot";
  if (t >= 82) return "hot";
  if (t >= 75) return "warm";
  if (t >= 68) return "mild";
  if (t >= 60) return "cool";
  if (t >= 50) return "chilly";
  if (t >= 40) return "cold";
  return "very cold";
}

// ------------------------------------------------------------
// Humidity feel categories
// ------------------------------------------------------------
export function getHumidityFeel(dewStats) {
  const d = dewStats.avg;

  if (d == null) return "unknown";

  if (d >= 72) return "tropical";
  if (d >= 65) return "humid";
  if (d >= 58) return "sticky";
  if (d >= 50) return "comfortable";
  if (d >= 40) return "dry";
  return "very dry";
}

// ------------------------------------------------------------
// Wind feel categories
// ------------------------------------------------------------
export function getWindFeel(windStats) {
  const g = windStats.gustMax || 0;

  if (g >= 35) return "very windy";
  if (g >= 25) return "windy";
  if (g >= 15) return "breezy";
  return "light wind";
}

// ------------------------------------------------------------
// Goldilocks logic — when everything feels "just right"
// ------------------------------------------------------------
export function isGoldilocks(tempFeel, humidityFeel, windFeel) {
  const goodTemps = ["mild", "warm"];
  const goodHumidity = ["comfortable", "dry"];
  const goodWind = ["light wind", "breezy"];

  return (
    goodTemps.includes(tempFeel) &&
    goodHumidity.includes(humidityFeel) &&
    goodWind.includes(windFeel)
  );
}

// ------------------------------------------------------------
// Clothing guidance — expressive but safe
// ------------------------------------------------------------
export function getClothingGuidance(tempFeel, windFeel, humidityFeel, stats) {
  const out = [];

  // Temperature-driven
  if (tempFeel === "very hot") out.push("light, breathable clothing");
  else if (tempFeel === "hot") out.push("short sleeves");
  else if (tempFeel === "warm") out.push("comfortable layers");
  else if (tempFeel === "mild") out.push("a light layer");
  else if (tempFeel === "cool") out.push("a light jacket");
  else if (tempFeel === "chilly") out.push("a jacket or sweater");
  else if (tempFeel === "cold") out.push("a warm coat");
  else if (tempFeel === "very cold") out.push("a heavy coat");

  // Wind-driven
  if (windFeel === "windy" || windFeel === "very windy") {
    out.push("a windbreaker");
  }

  // Humidity-driven
  if (humidityFeel === "tropical" || humidityFeel === "humid") {
    out.push("hydration and breathable fabrics");
  }

  // Precip-driven
  if (stats.precip.rainTotal > 0.05) {
    out.push("rain gear");
  }
  if (stats.precip.snowTotal > 0.05) {
    out.push("warm, waterproof layers");
  }

  return out;
}

// ------------------------------------------------------------
// Unified comfort summary
// ------------------------------------------------------------
export function getComfortSummary(stats, date = new Date()) {
  const season = getSeasonalContext(date);

  const tempFeel = getTempFeel(stats.temp, season);
  const humidityFeel = getHumidityFeel(stats.dew);
  const windFeel = getWindFeel(stats.wind);

  const goldilocks = isGoldilocks(tempFeel, humidityFeel, windFeel);

  return {
    tempFeel,
    humidityFeel,
    windFeel,
    goldilocks
  };
}
