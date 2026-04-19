// ============================================================
// NORMALIZE → CANONICAL WEATHER SCHEMA (STRICT + SAFE)
// ============================================================

export function normalizeHourly(rawHourly = []) {
  return rawHourly
    .map(h => {
      if (!h) return null;

      const timestamp = h.timestamp;

      // 🚫 reject anything not already canonical
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
    .filter(Boolean);
}