// /modules/human-action-2/tomorrow-builder.js
// Human‑Action 2.0 — Tomorrow Daypart Builder (Fully Integrated Hybrid Model)

export function buildTomorrowCurrent(stats) {
  if (!stats) return null;

  // ---------------------------------------------------------
  // 1. HUMIDITY FALLBACK
  // ---------------------------------------------------------
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
  // 6. Freeze / frost / black ice
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
  // 7. Inversion risk
  // ---------------------------------------------------------
  const inversionRisk =
    (stats.tempMin <= 40 && stats.windAvg < 3) ? 0.5 : 0;

  // ---------------------------------------------------------
  // 8. Feels‑like adjustment (same strength for both dayparts)
  // ---------------------------------------------------------
  function computeFeelsLike(temp, gust, humidity) {
    if (temp <= 50) {
      const windFactor = Math.min(gust, 50);
      return temp - (windFactor * 0.15);
    }
    if (temp >= 70) {
      return temp + ((humidity - 50) * 0.05);
    }
    if (gust >= 30) {
      return temp - 2;
    }
    return temp;
  }

  const feelsLikeMorning = computeFeelsLike(stats.tempMin, stats.windGustMax, humidity);
  const feelsLikeAfternoon = computeFeelsLike(stats.tempMax, stats.windGustMax, humidity);

  // ---------------------------------------------------------
  // 9. Timestamps for dayparts
  // ---------------------------------------------------------
  const morningTimestamp = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(8, 0, 0, 0);
    return d.getTime();
  })();

  const afternoonTimestamp = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(14, 0, 0, 0);
    return d.getTime();
  })();

  // ---------------------------------------------------------
  // 10. Day-level flags
  // ---------------------------------------------------------
  const coldStart = stats.tempMin < 40;
  const windImpact = stats.windGustMax >= 30;
  const tempSwing = stats.tempMax - (stats.tempMaxPrev ?? stats.tempMax);

  // ---------------------------------------------------------
  // 11. RETURN FULL HYBRID DAYPART OBJECT
  // ---------------------------------------------------------
  return {
    // Morning snapshot
    morning: {
      temp: stats.tempMin,
      feelsLike: feelsLikeMorning,
      dewpoint: dew,
      humidity,
      windSpeed: stats.windAvg,
      windGust: stats.windGustMax,
      precipType,
      precipIntensity,
      uvIndex: stats.uvMax ?? 0,
      visibility,
      cloudCover,
      smokeIndex: 0,
      frostRisk,
      freezeRisk,
      inversionRisk,
      blackIceRisk,
      valleyFogRisk: 0,
      ridgeFogRisk: 0,
      timestamp: morningTimestamp
    },

    // Afternoon snapshot
    afternoon: {
      temp: stats.tempMax,
      feelsLike: feelsLikeAfternoon,
      dewpoint: dew,
      humidity,
      windSpeed: stats.windAvg,
      windGust: stats.windGustMax,
      precipType,
      precipIntensity,
      uvIndex: stats.uvMax ?? 0,
      visibility,
      cloudCover,
      smokeIndex: 0,
      frostRisk,
      freezeRisk,
      inversionRisk,
      blackIceRisk,
      valleyFogRisk: 0,
      ridgeFogRisk: 0,
      timestamp: afternoonTimestamp
    },

    // Day-level stats
    stats: {
      tempMin: stats.tempMin,
      tempMax: stats.tempMax,
      tempSwing,
      windGustMax: stats.windGustMax,
      windAvg: stats.windAvg,
      dewpointAvg: dew,
      cloudAvg: stats.cloudAvg,
      rainTotal: stats.rainTotal,
      snowTotal: stats.snowTotal,
      coldStart,
      windImpact
    }
  };
}