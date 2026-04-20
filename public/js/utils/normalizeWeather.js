export function normalizeHourly(rawHourly = []) {
  const now = Date.now();

  const normalized = rawHourly
    .map(h => {
      if (!h) return null;

      const timestamp = h.timestamp;
      if (!Number.isFinite(timestamp)) return null;

      return {
        timestamp,

        temperatureF: Number.isFinite(h.temperatureF)
          ? h.temperatureF
          : null,

        dewpointF: Number.isFinite(h.dewpointF)
          ? h.dewpointF
          : null,

        relativeHumidity: (() => {
  let rh = h.relativeHumidity;

  // ------------------------------------------------------------
  // 1. Fix NaN / bad values
  // ------------------------------------------------------------
  if (!Number.isFinite(rh)) {
    // fallback: derive from temp + dewpoint if possible
    if (
      Number.isFinite(h.temperatureF) &&
      Number.isFinite(h.dewpointF)
    ) {
      const t = (h.temperatureF - 32) * 5/9;
      const d = (h.dewpointF - 32) * 5/9;

      const es = 6.112 * Math.exp((17.67 * t) / (t + 243.5));
      const e  = 6.112 * Math.exp((17.67 * d) / (d + 243.5));

      rh = (e / es) * 100;
    } else {
      return null;
    }
  }

  // ------------------------------------------------------------
  // 2. Clamp to physical bounds
  // ------------------------------------------------------------
  return Math.max(0, Math.min(100, rh));
})(),


        windSpeed: Number.isFinite(h.windSpeed)
          ? h.windSpeed
          : 0,

        windGust: Number.isFinite(h.windGust)
          ? h.windGust
          : null,

        precipitation: Number.isFinite(h.precipitation)
          ? h.precipitation
          : 0,

        cloudCover: Number.isFinite(h.cloudCover)
          ? h.cloudCover
          : null,

        uvIndex: Number.isFinite(h.uvIndex)
          ? h.uvIndex
          : null
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.timestamp - b.timestamp);

  if (!normalized.length) return [];

  // 🔥 CRITICAL FIX — align to closest to now
  let closestIndex = 0;
  let smallestDiff = Infinity;

  for (let i = 0; i < normalized.length; i++) {
    const diff = Math.abs(normalized[i].timestamp - now);
    if (diff < smallestDiff) {
      smallestDiff = diff;
      closestIndex = i;
    }
  }

  return normalized.slice(closestIndex);
}