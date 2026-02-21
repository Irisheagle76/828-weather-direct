// forecast-intel.js
// Temporary working version: simple logic so the app runs cleanly.
// We can upgrade this later to the full meteorologist-grade engine.

/* ----------------------------------------------------
   BASIC HELPERS
   ---------------------------------------------------- */
function safeNum(arr, i) {
  if (!arr || i < 0 || i >= arr.length) return null;
  const v = arr[i];
  return typeof v === "number" && !Number.isNaN(v) ? v : null;
}

function sum(values) {
  let total = 0;
  for (const v of values) {
    if (typeof v === "number" && !Number.isNaN(v)) {
      total += v;
    }
  }
  return total;
}

/* ----------------------------------------------------
   SIMPLE TOMORROW WINDOW (same idea as before)
   ---------------------------------------------------- */
function getTomorrowWindow(hourly) {
  if (!hourly.time || hourly.time.length === 0) {
    return { start: 0, end: 0 };
  }

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);

  const yyyy = tomorrow.getFullYear();
  const mm = String(tomorrow.getMonth() + 1).padStart(2, "0");
  const dd = String(tomorrow.getDate()).padStart(2, "0");
  const targetDate = `${yyyy}-${mm}-${dd}`;

  let start = null;
  let end = null;

  for (let i = 0; i < hourly.time.length; i++) {
    const dateStr = hourly.time[i].slice(0, 10);
    if (dateStr === targetDate) {
      if (start === null) start = i;
      end = i + 1;
    }
  }

  if (start === null) {
    return { start: 24, end: 48 };
  }

  return { start, end };
}

/* ----------------------------------------------------
   TEMPORARY HUMAN‑ACTION OUTLOOK (simple, but safe)
   ---------------------------------------------------- */
export function getHumanActionOutlook(hourly) {
  const { start, end } = getTomorrowWindow(hourly);

  const rainArr = hourly.precipitation || [];
  const dewArr = hourly.dewpoint_2m || [];
  const tempArr = hourly.temperature_2m || [];
  const gustArr = hourly.windgusts_10m || [];

  let rainTotal = 0;
  let maxTemp = -999;
  let minTemp = 999;
  let maxDew = -999;
  let maxGust = 0;

  for (let i = start; i < end; i++) {
    rainTotal += rainArr[i] ?? 0;

    const t = safeNum(tempArr, i);
    if (t != null) {
      if (t > maxTemp) maxTemp = t;
      if (t < minTemp) minTemp = t;
    }

    const d = safeNum(dewArr, i);
    if (d != null && d > maxDew) maxDew = d;

    const g = safeNum(gustArr, i);
    if (g != null && g > maxGust) maxGust = g;
  }

  const spread = maxTemp - minTemp;

  // Very simple, safe logic for now:
  if (rainTotal >= 0.10) {
    return {
      emoji: "💧",
      headline: "Showers expected tomorrow",
      text: `Around ${rainTotal.toFixed(2)}" of rain possible. A light rain jacket will help.`
    };
  }

  if (minTemp <= 35 || (maxGust >= 25 && maxTemp <= 40)) {
    return {
      emoji: "🥶",
      headline: "Cold and breezy tomorrow",
      text: "Wind chill may make it feel colder. Dress in warm layers."
    };
  }

  if (maxDew >= 68 && maxTemp >= 82) {
    return {
      emoji: "😅",
      headline: "Hot and humid tomorrow",
      text: "Stay hydrated and wear light, breathable clothing."
    };
  }

  if (spread >= 30 && rainTotal < 0.10) {
    return {
      emoji: "🏔️",
      headline: "Classic mountain layers day",
      text: "Chilly morning, warm afternoon. Dress in layers."
    };
  }

  if (maxGust >= 30) {
    return {
      emoji: "🌬️",
      headline: "Gusty conditions tomorrow",
      text: "Secure outdoor items and expect breezy conditions."
    };
  }

  if (
    maxTemp >= 68 &&
    maxTemp <= 74 &&
    maxDew >= 45 &&
    maxDew <= 52 &&
    rainTotal < 0.05 &&
    maxGust < 20
  ) {
    return {
      emoji: "🌟",
      headline: "Goldilocks Day!",
      text: "Mild temps, low humidity, no rain. Beautiful day ahead."
    };
  }

  return {
    emoji: "🙂",
    headline: "A mild, uneventful day tomorrow",
    text: "Comfortable weather with no special prep needed."
  };
}

/* ----------------------------------------------------
   TEMPORARY FORECAST ALERTS (simple, but safe)
   ---------------------------------------------------- */
export function getForecastAlerts(hourly) {
  if (!hourly || !hourly.time) return [];

  const len = hourly.time.length;
  const start = Math.min(12, len - 1);
  const end = Math.min(48, len);

  const rainArr = hourly.precipitation || [];
  const snowArr = hourly.snowfall || [];
  const tempArr = hourly.temperature_2m || [];
  const gustArr = hourly.windgusts_10m || [];

  let rainTotal = 0;
  let snowTotal = 0;
  let maxGust = 0;
  let maxTemp = -999;
  let minTemp = 999;
  let tempCount = 0;

  for (let i = start; i < end; i++) {
    const r = safeNum(rainArr, i) ?? 0;
    const s = safeNum(snowArr, i) ?? 0;
    const g = safeNum(gustArr, i) ?? 0;
    const t = safeNum(tempArr, i);

    rainTotal += r;
    snowTotal += s;
    if (g > maxGust) maxGust = g;

    if (t != null) {
      tempCount++;
      if (t > maxTemp) maxTemp = t;
      if (t < minTemp) minTemp = t;
    }
  }

  const alerts = [];

  if (snowTotal >= 0.2) {
    alerts.push({
      icon: "❄️",
      id: "snow",
      title: "Snowfall Expected",
      detail: `Light snow is possible, around ${snowTotal.toFixed(1)}" in the next couple of days.`
    });
  }

  if (rainTotal >= 0.30) {
    alerts.push({
      icon: "💧",
      id: "rain",
      title: "Rain Expected",
      detail: `Around ${rainTotal.toFixed(2)}" of rain is expected in the next couple of days.`
    });
  }

  if (maxGust >= 30) {
    alerts.push({
      icon: "🌬️",
      id: "wind",
      title: "Gusty Winds Ahead",
      detail: `Wind gusts may reach ${maxGust.toFixed(0)} mph in the next couple of days.`
    });
  }

  if (tempCount > 0 && maxTemp >= 85) {
    alerts.push({
      icon: "😅",
      id: "hot",
      title: "Heat Spike Expected",
      detail: `High temperatures may exceed ${maxTemp.toFixed(0)}°F in the next couple of days.`
    });
  }

  if (tempCount > 0 && minTemp <= 15) {
    alerts.push({
      icon: "🥶",
      id: "cold",
      title: "Bitter Cold Incoming",
      detail: `Lows may fall to around ${minTemp.toFixed(0)}°F in the next couple of days.`
    });
  }

  return alerts;
}
/* ----------------------------------------------------
   PART 2 — ASHEVILLE‑TUNED QPF INTERPRETER
   ---------------------------------------------------- */

/**
 * Classify rain totals (inches) into Asheville‑appropriate categories.
 */
function classifyRain(rainTotal) {
  if (rainTotal < 0.01) {
    return { type: "none", label: "No rain", severity: 0 };
  }
  if (rainTotal < 0.05) {
    return { type: "trace", label: "Trace moisture", severity: 1 };
  }
  if (rainTotal < 0.15) {
    return { type: "spotty", label: "Spotty showers", severity: 2 };
  }
  if (rainTotal < 0.40) {
    return { type: "light", label: "Light rain", severity: 3 };
  }
  if (rainTotal < 0.75) {
    return { type: "steady", label: "Steady rain", severity: 4 };
  }
  if (rainTotal < 1.25) {
    return { type: "soaking", label: "A soaking rain", severity: 5 };
  }
  return { type: "heavy", label: "Heavy rain", severity: 6 };
}

/**
 * Classify snow totals (inches) using Asheville‑sensitive thresholds.
 */
function classifySnow(snowTotal) {
  if (snowTotal < 0.05) {
    return { type: "none", label: "No snow", severity: 0 };
  }
  if (snowTotal < 0.10) {
    return { type: "flurries", label: "Flurries", severity: 1 };
  }
  if (snowTotal < 0.50) {
    return { type: "dusting", label: "Dusting possible", severity: 2 };
  }
  if (snowTotal < 1.0) {
    return { type: "light", label: "Light accumulation", severity: 3 };
  }
  if (snowTotal < 3.0) {
    return { type: "accumulating", label: "Accumulating snow", severity: 4 };
  }
  if (snowTotal < 6.0) {
    return { type: "plowable", label: "Plowable snow", severity: 5 };
  }
  return { type: "significant", label: "Significant snowfall", severity: 6 };
}

/**
 * Detect convective precipitation (downpours / thunderstorms).
 * Looks for sharp hourly spikes in QPF.
 */
function detectConvective(rainArr, start, end) {
  let convective = false;
  let maxSpike = 0;

  for (let i = start + 1; i < end; i++) {
    const prev = rainArr[i - 1] ?? 0;
    const curr = rainArr[i] ?? 0;
    const spike = curr - prev;

    if (spike >= 0.20) {
      convective = true;
      if (spike > maxSpike) maxSpike = spike;
    }
  }

  return { convective, maxSpike };
}

/**
 * Detect stratiform precipitation (gentle, steady rain).
 */
function detectStratiform(rainArr, start, end) {
  let gentleHours = 0;

  for (let i = start; i < end; i++) {
    const r = rainArr[i] ?? 0;
    if (r > 0.01 && r < 0.10) gentleHours++;
  }

  return gentleHours >= 4; // 4+ hours of gentle precip = stratiform
}

/**
 * Detect NW‑flow snow (Asheville special).
 * Requires:
 * - NW wind direction (approx via gust patterns)
 * - Light QPF
 * - Cold temps
 */
function detectNWFlowSnow(hourly, start, end) {
  const gustArr = hourly.windgusts_10m || [];
  const tempArr = hourly.temperature_2m || [];
  const snowArr = hourly.snowfall || [];

  let coldEnough = false;
  let lightSnow = false;
  let gustPattern = false;

  for (let i = start; i < end; i++) {
    const t = safeNum(tempArr, i);
    const s = safeNum(snowArr, i);
    const g = safeNum(gustArr, i);

    if (t != null && t <= 34) coldEnough = true;
    if (s != null && s > 0 && s < 0.20) lightSnow = true;

    // NW‑flow gust signature: gusty but not extreme
    if (g != null && g >= 18 && g <= 32) gustPattern = true;
  }

  return coldEnough && lightSnow && gustPattern;
}

/**
 * Summarize precipitation characteristics for tomorrow.
 * Returns:
 * {
 *   rain: { type, label, severity },
 *   snow: { type, label, severity },
 *   convective: boolean,
 *   stratiform: boolean,
 *   nwFlowSnow: boolean
 * }
 */
function analyzeQPF(hourly, start, end) {
  const rainArr = hourly.precipitation || [];
  const snowArr = hourly.snowfall || [];

  let rainTotal = 0;
  let snowTotal = 0;

  for (let i = start; i < end; i++) {
    rainTotal += rainArr[i] ?? 0;
    snowTotal += snowArr[i] ?? 0;
  }

  const rainClass = classifyRain(rainTotal);
  const snowClass = classifySnow(snowTotal);

  const conv = detectConvective(rainArr, start, end);
  const strat = detectStratiform(rainArr, start, end);
  const nwFlow = detectNWFlowSnow(hourly, start, end);

  return {
    rain: rainClass,
    snow: snowClass,
    convective: conv.convective,
    maxSpike: conv.maxSpike,
    stratiform: strat,
    nwFlowSnow: nwFlow,
    rainTotal,
    snowTotal
  };
}
