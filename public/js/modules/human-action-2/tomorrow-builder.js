// /modules/human-action-2/tomorrow-builder.js
// Converts tomorrow.stats → Human‑Action 2.0 compatible data object

export function buildTomorrowCurrent(stats) {
  if (!stats) return null;

  // ---------------------------------------------------------
  // 1. HUMIDITY FALLBACK (CRITICAL FIX)
  // ---------------------------------------------------------
  // If humidityAvg is missing, use a safe neutral value.
  const humidity = stats.humidityAvg ?? 55;

  // ---------------------------------------------------------
  // 2. Dewpoint estimation (Magnus approximation)
  // ---------------------------------------------------------
  function estimateDewpoint(temp, humidity) {
    if (temp == null || humidity == null) return null;
    const a = 17.27;
    const b = 237.7;
    const alpha = ((a * temp) / (b + temp)) + Math.log(humidity / 100);
    return (b * alpha) / (a - alpha);
  }

  const dew = stats.dewpointAvg ??
              estimateDewpoint(stats.tempMax, humidity);

  // ---------------------------------------------------------
  // 3. Cloud cover normalization
  // ---------------------------------------------------------
  const cloudCover = stats.cloudAvg != null
    ? stats.cloudAvg / 100
    : 0;

  // ---------------------------------------------------------
  // 4. Precip type + intensity
  // ---------------------------------------------------------
  const precipType =
    stats.rainTotal > 0 ? "rain" :
    stats.snowTotal > 0 ? "snow" :
    "none";

  const precipIntensity =
    stats.rainTotal > 0 ? stats.rainTotal :
    stats.snowTotal > 0 ? stats.snowTotal :
    0;

  // ---------------------------------------------------------
  // 5. Visibility heuristic
  // ---------------------------------------------------------
  const visibility =
    stats.fogHours > 0 ? 2 :
    cloudCover > 0.85 ? 5 :
    10;

  // ---------------------------------------------------------
  // 6. Fog risks (updated to use humidity fallback)
  // ---------------------------------------------------------
  const valleyFogRisk =
    (humidity >= 90 &&
     stats.tempMin <= 50 &&
     stats.windAvg < 3)
      ? 0.6 : 0;

  const ridgeFogRisk =
    (humidity >= 95 &&
     cloudCover >= 0.8 &&
     stats.windAvg < 4)
      ? 0.5 : 0;

  // ---------------------------------------------------------
  // 7. Freeze / frost / black ice
  // ---------------------------------------------------------
  const freezeRisk =
    stats.tempMin <= 32 ? 1 :
    stats.tempMin <= 34 ? 0.5 :
    0;

  const frostRisk =
    (stats.tempMin <= 37 && dew <= 36) ? 0.6 :
    stats.tempMin <= 34 ? 1 :
    0;

  const blackIceRisk =
    (stats.tempMin <= 32 && precipIntensity > 0) ? 1 :
    (stats.tempMin <= 33 && stats.tempMinPrev <= 30) ? 0.5 :
    0;

  // ---------------------------------------------------------
  // 8. Inversion risk
  // ---------------------------------------------------------
  const inversionRisk =
    (stats.tempMin <= 40 && stats.windAvg < 3) ? 0.5 : 0;

  // ---------------------------------------------------------
  // 9. Timestamp (tomorrow at 8 AM)
  // ---------------------------------------------------------
  const tomorrowTimestamp = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(8, 0, 0, 0);
    return d.getTime();
  })();

  // ---------------------------------------------------------
  // 10. RETURN FINAL HUMAN‑ACTION 2.0 INPUT OBJECT
  // ---------------------------------------------------------
  return {
    temp: stats.tempMax,
    feelsLike: stats.tempMax,
    dewpoint: dew,
    humidity,
    windSpeed: stats.windAvg,
    windGust: stats.windGustMax,
    precipType,
    precipIntensity,
    uvIndex: stats.uvMax ?? 0,
    visibility,
    cloudCover,
    smokeIndex: 0, // placeholder
    frostRisk,
    freezeRisk,
    inversionRisk,
    blackIceRisk,
    valleyFogRisk,
    ridgeFogRisk,
    timestamp: tomorrowTimestamp
  };
}