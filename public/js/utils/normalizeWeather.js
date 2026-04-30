export function normalizeHourly(rawHourly = []) {
  const now = Date.now();

  const normalized = rawHourly
    .map(h => {
      if (!h) return null;

      const timestamp = h.timestamp;
      if (!Number.isFinite(timestamp)) return null;

      // ------------------------------------------------------------
      // TEMPERATURE / DEWPOINT
      // ------------------------------------------------------------

      const temperatureF = Number.isFinite(h.temperatureF)
        ? h.temperatureF
        : null;

      const dewpointF = Number.isFinite(h.dewpointF)
        ? h.dewpointF
        : null;

      // ------------------------------------------------------------
      // HUMIDITY (DERIVED IF NEEDED)
      // ------------------------------------------------------------

      let rh = h.relativeHumidity;

      if (!Number.isFinite(rh)) {
        if (Number.isFinite(temperatureF) && Number.isFinite(dewpointF)) {
          const t = (temperatureF - 32) * 5/9;
          const d = (dewpointF - 32) * 5/9;

          const es = 6.112 * Math.exp((17.67 * t) / (t + 243.5));
          const e  = 6.112 * Math.exp((17.67 * d) / (d + 243.5));

          rh = (e / es) * 100;
        } else {
          rh = null;
        }
      }

      if (Number.isFinite(rh)) {
        rh = Math.max(0, Math.min(100, rh));
      }

      // ------------------------------------------------------------
      // 🚨 PRECIP PROBABILITY (CRITICAL FIX)
      // ------------------------------------------------------------

      let precipProbability = h.precipProbability;

      if (Number.isFinite(precipProbability)) {
        // normalize 0–100 → 0–1
        if (precipProbability > 1) {
          precipProbability = precipProbability / 100;
        }

        precipProbability = Math.max(0, Math.min(1, precipProbability));
      } else {
        precipProbability = 0;
      }

      // ------------------------------------------------------------
      // PRECIP AMOUNT
      // ------------------------------------------------------------

      let precipitation = h.precipitation;

      if (!Number.isFinite(precipitation)) {
        precipitation = h.rain ?? 0;
      }

      if (!Number.isFinite(precipitation)) {
        precipitation = 0;
      }

      // ------------------------------------------------------------
      // CLOUD COVER NORMALIZATION
      // ------------------------------------------------------------

      let cloudCover = h.cloudCover;

      if (Number.isFinite(cloudCover)) {
        // normalize 0–100 → 0–1 if needed
        if (cloudCover > 1) {
          cloudCover = cloudCover / 100;
        }

        cloudCover = Math.max(0, Math.min(1, cloudCover));
      } else {
        cloudCover = null;
      }

      // ------------------------------------------------------------
      // RETURN CLEAN OBJECT
      // ------------------------------------------------------------

      return {
        timestamp,

        temperatureF,
        dewpointF,
        relativeHumidity: rh,

        windSpeed: Number.isFinite(h.windSpeed) ? h.windSpeed : 0,
        windGust: Number.isFinite(h.windGust) ? h.windGust : null,

        precipitation,
        precipProbability, // 🔥 now always 0–1

        cloudCover,
        uvIndex: Number.isFinite(h.uvIndex) ? h.uvIndex : null
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.timestamp - b.timestamp);

  if (!normalized.length) return [];

  // ------------------------------------------------------------
  // ALIGN TO "NOW"
  // ------------------------------------------------------------

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