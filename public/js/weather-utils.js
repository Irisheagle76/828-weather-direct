// /js/weather-utils.js

/**
 * Find the index of the hourly forecast closest to "now".
 */
export function findNearestHourIndex(hourly) {
  const now = new Date();
  let bestIndex = 0;
  let bestDiff = Infinity;

  hourly.time.forEach((t, i) => {
    const d = new Date(t);
    const diff = Math.abs(d - now);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIndex = i;
    }
  });

  return bestIndex;
}

/**
 * Compute a reliable UV index using:
 * 1. WU UV (if valid)
 * 2. Open‑Meteo UV (fallback)
 * 3. Solar radiation estimate (last resort)
 */
export function getReliableUV(obs, fallbackUV, solarRadiation) {
  const sr = solarRadiation ?? 0;

  // 1. Use WU UV if valid and not a bogus daytime zero
  if (obs?.uv != null && obs.uv >= 0 && obs.uv <= 15) {
    if (!(obs.uv === 0 && sr > 50)) {
      return obs.uv;
    }
  }

  // 2. Use fallback UV from Open‑Meteo if valid and not a bogus daytime zero
  if (fallbackUV != null && fallbackUV >= 0 && fallbackUV <= 15) {
    if (!(fallbackUV === 0 && sr > 50)) {
      return fallbackUV;
    }
  }

  // 3. Estimate UV from solar radiation (W/m²)
  if (sr > 0) {
    const estimated = sr / 200;
    return Math.min(estimated, 15);
  }

  // 4. No UV available
  return null;
}
