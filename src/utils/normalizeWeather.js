// ============================================================
// NORMALIZE → CANONICAL WEATHER SCHEMA (STRICT)
// ============================================================

export function normalizeHourly(rawHourly = []) {
  return rawHourly.map(h => ({
    // ✅ TIME
    timestamp: h.timestamp ?? h.ts ?? null,

    // ✅ TEMPERATURE
    temperatureF:
      h.temperatureF ??
      h.temp ??
      h.temperature ??
      null,

    // ✅ DEW POINT
    dewpointF:
      h.dewpointF ??
      h.dewPoint ??
      null,

    // ✅ HUMIDITY
    relativeHumidity:
      h.relativeHumidity ??
      h.rh ??
      null,

    // ✅ WIND
    windSpeed:
      h.windSpeed ??
      h.wind ??
      h.wind_speed ??
      0,

    windGust:
      h.windGust ??
      null,

    // ✅ PRECIP / CLOUD / UV (optional but future-proof)
    precipitation: h.precipitation ?? 0,
    cloudCover: h.cloudCover ?? null,
    uvIndex: h.uv ?? h.uvIndex ?? null
  }))
  .filter(h => h.timestamp != null);
}