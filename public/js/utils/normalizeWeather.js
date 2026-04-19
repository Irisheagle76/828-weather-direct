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

        relativeHumidity: Number.isFinite(h.relativeHumidity)
          ? h.relativeHumidity
          : null,

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