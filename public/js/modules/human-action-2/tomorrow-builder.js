// /modules/human-action-2/tomorrow-builder.js
// Converts tomorrow.stats → Human‑Action 2.0 compatible data object

export function buildTomorrowCurrent(stats) {
  if (!stats) return null;

  // Helper: estimate dewpoint from humidity + temp
  function estimateDewpoint(temp, humidity) {
    if (temp == null || humidity == null) return null;
    // Simple Magnus approximation
    const a = 17.27;
    const b = 237.7;
    const alpha = ((a * temp) / (b + temp)) + Math.log(humidity / 100);
    return (b * alpha) / (a - alpha);
  }

  // Estimate dewpoint if missing
  const dew = stats.dewpointAvg ??
              estimateDewpoint(stats.tempMax, stats.humidityAvg);

  // Normalize cloud cover (0–100 → 0–1)
  const cloudCover = stats.cloudAvg != null
    ? stats.cloudAvg / 100
    : null;

  // Determine precip type
  const precipType =
    stats.rainTotal > 0 ? "rain" :
    stats.snowTotal > 0 ? "snow" :
    "none";

  // Estimate precip intensity (tomorrow)
  const precipIntensity =
    stats.rainTotal > 0 ? stats.rainTotal :
    stats.snowTotal > 0 ? stats.snowTotal :
    0;

  // Visibility heuristic
  const visibility =
    stats.fogHours > 0 ? 2 :
    cloudCover > 0.85 ? 5 :
    10;

  // Fog risks
  const valleyFogRisk =
    (stats.humidityAvg >= 90 &&
     stats.tempMin <= 50 &&
     stats.windAvg < 3)
      ? 0.6 : 0;

  const ridgeFogRisk =
    (stats.humidityAvg >= 95 &&
     cloudCover >= 0.8 &&
     stats.windAvg < 4)
      ? 0.5 : 0;

  // Freeze / frost / black ice
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

  // Inversion risk (calm + cold valley)
  const inversionRisk =
    (stats.tempMin <= 40 && stats.windAvg < 3) ? 0.5 : 0;

  // Timestamp = tomorrow at 8 AM local
  const tomorrowTimestamp = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(8, 0, 0, 0);
    return d.getTime();
  })();

  return {
    temp: stats.tempMax,
    feelsLike: stats.tempMax,
    dewpoint: dew,
    humidity: stats.humidityAvg,
    windSpeed: stats.windAvg,
    windGust: stats.windGustMax,
    precipType,
    precipIntensity,
    uvIndex: stats.uvMax,
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