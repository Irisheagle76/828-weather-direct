// /js/intel/confidence.js
// Dynamic confidence scoring for Human‑Action periods

export function computeConfidence(stats, events, windowIndices, hourly) {
  if (!stats || !events || !windowIndices || windowIndices.length === 0) {
    return 0.4; // fallback low confidence
  }

  // ------------------------------------------------------------
  // 1. Window Size Score (0–1)
  // ------------------------------------------------------------
  const sizeScore = Math.min(1, windowIndices.length / 12);

  // ------------------------------------------------------------
  // 2. Variance Score (0–1)
  // ------------------------------------------------------------
  const temps = windowIndices.map(i => hourly.temperature_2m[i]);
  const winds = windowIndices.map(i => hourly.wind_speed_10m[i]);
  const clouds = windowIndices.map(i => hourly.cloudcover[i]);

  const tempVar = variance(temps);
  const windVar = variance(winds);
  const cloudVar = variance(clouds);

  // Normalize variance: higher variance → lower score
  const varScore = 1 - normalizeVariance(tempVar + windVar + cloudVar);

  // ------------------------------------------------------------
  // 3. Precipitation Clarity (0–1)
  // ------------------------------------------------------------
  const precipTotal = stats.rainTotal + stats.snowTotal;
  const precipScore = precipClarity(precipTotal);

  // ------------------------------------------------------------
  // 4. Trend Clarity (0–1)
  // ------------------------------------------------------------
  const strongTrends = [
    events.bigWarmup,
    events.coolingOff,
    events.gusty,
    events.wetPattern
  ].filter(Boolean).length;

  const trendScore = Math.min(1, strongTrends / 3);

  // ------------------------------------------------------------
  // 5. Event Clarity (0–1)
  // ------------------------------------------------------------
  const eventScore = events.driver ? 1 : 0.5;

  // ------------------------------------------------------------
  // Weighted Blend
  // ------------------------------------------------------------
  const confidence =
    0.25 * sizeScore +
    0.25 * varScore +
    0.20 * precipScore +
    0.15 * trendScore +
    0.15 * eventScore;

  return Number(confidence.toFixed(2));
}

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------
function variance(arr) {
  if (!arr || arr.length < 2) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  return arr.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / arr.length;
}

function normalizeVariance(v) {
  // Typical variance ranges: 0–100
  return Math.min(1, v / 100);
}

function precipClarity(total) {
  if (total === 0) return 1;          // clearly dry
  if (total >= 0.25) return 1;        // clearly wet
  if (total > 0 && total < 0.1) return 0.5;  // borderline drizzle
  return 0.7;                         // light but consistent
}