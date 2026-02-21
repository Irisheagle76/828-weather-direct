// forecast-intel.js
/* ----------------------------------------------------
   PART 1 — CORE HELPERS + HOURLY WINDOW TOOLS
   ---------------------------------------------------- */

/**
 * Safely get a numeric value from an array, or null if missing/invalid.
 */
function safeNum(arr, i) {
  if (!arr || i < 0 || i >= arr.length) return null;
  const v = arr[i];
  return typeof v === "number" && !Number.isNaN(v) ? v : null;
}

/**
 * Clamp a number between min and max.
 */
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Simple average of an array of numbers (ignores null/undefined).
 */
function avg(values) {
  let sum = 0;
  let count = 0;
  for (const v of values) {
    if (typeof v === "number" && !Number.isNaN(v)) {
      sum += v;
      count++;
    }
  }
  return count > 0 ? sum / count : null;
}

/**
 * Sum of an array of numbers (ignores null/undefined).
 */
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
   TIME + HOURLY WINDOW HELPERS
   ---------------------------------------------------- */

/**
 * Given an Open-Meteo hourly object, return an array of Date objects.
 */
function getHourlyDates(hourly) {
  const times = hourly?.time || [];
  return times.map(t => new Date(t));
}

/**
 * Get the [start, end) indices for a given calendar date (local).
 */
function getCalendarDayWindow(hourly, targetDate) {
  const times = hourly?.time || [];
  if (!times.length) return { start: 0, end: 0 };

  const yyyy = targetDate.getFullYear();
  const mm = String(targetDate.getMonth() + 1).padStart(2, "0");
  const dd = String(targetDate.getDate()).padStart(2, "0");
  const targetStr = `${yyyy}-${mm}-${dd}`;

  let start = null;
  let end = null;

  for (let i = 0; i < times.length; i++) {
    const dateStr = times[i].slice(0, 10);
    if (dateStr === targetStr) {
      if (start === null) start = i;
      end = i + 1;
    }
  }

  if (start === null) return { start: 0, end: 0 };
  return { start, end };
}

/**
 * Get tomorrow's calendar-day window.
 */
function getTomorrowWindow(hourly) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);

  const { start, end } = getCalendarDayWindow(hourly, tomorrow);

  if (start === 0 && end === 0) {
    const len = hourly?.time?.length || 0;
    const s = Math.min(24, Math.max(0, len - 24));
    const e = Math.min(48, len);
    return { start: s, end: e };
  }

  return { start, end };
}

/**
 * Get a generic window from +offsetStart to +offsetEnd hours.
 */
function getRelativeWindow(hourly, offsetStartHours, offsetEndHours) {
  const len = hourly?.time?.length || 0;
  const start = clamp(offsetStartHours, 0, len);
  const end = clamp(offsetEndHours, 0, len);
  return { start, end: Math.max(start, end) };
}
/**
 * Find the first and last hour where a condition is true.
 * Returns { firstHour, lastHour } as Date objects.
 */
function findEventTiming(hourly, start, end, predicate) {
  const times = hourly.time || [];
  let first = null;
  let last = null;

  for (let i = start; i < end; i++) {
    if (predicate(i)) {
      if (first === null) first = i;
      last = i;
    }
  }

  if (first === null) {
    return { firstHour: null, lastHour: null };
  }

  return {
    firstHour: new Date(times[first]),
    lastHour: new Date(times[last])
  };
}

/**
 * Turn a Date into a friendly time‑of‑day phrase.
 */
function describeTimeOfDay(date) {
  if (!date) return null;
  const hour = date.getHours();

  if (hour < 6) return "overnight";
  if (hour < 10) return "early morning";
  if (hour < 12) return "late morning";
  if (hour < 15) return "early afternoon";
  if (hour < 18) return "late afternoon";
  if (hour < 21) return "evening";
  return "late evening";
}

/**
 * Build a short phrase like:
 * " early morning", " from late afternoon into evening"
 */
function timingPhrase(timing) {
  if (!timing.firstHour) return "";
  const startPhrase = describeTimeOfDay(timing.firstHour);
  const endPhrase = describeTimeOfDay(timing.lastHour);
  if (!startPhrase && !endPhrase) return "";
  if (startPhrase === endPhrase) return ` ${startPhrase}`;
  return ` from ${startPhrase} into ${endPhrase}`;
}
/* ----------------------------------------------------
   PRECIP + TEMP ACCUMULATION HELPERS
   ---------------------------------------------------- */

function accumulatePrecip(hourly, start, end) {
  const rainArr = hourly?.precipitation || [];
  const snowArr = hourly?.snowfall || [];

  let rainTotal = 0;
  let snowTotal = 0;

  for (let i = start; i < end; i++) {
    const r = safeNum(rainArr, i) ?? 0;
    const s = safeNum(snowArr, i) ?? 0;
    rainTotal += r;
    snowTotal += s;
  }

  return { rainTotal, snowTotal };
}

function summarizeTemps(hourly, start, end) {
  const tempArr = hourly?.temperature_2m || [];
  let minTemp = Infinity;
  let maxTemp = -Infinity;
  const temps = [];

  for (let i = start; i < end; i++) {
    const t = safeNum(tempArr, i);
    if (t != null) {
      temps.push(t);
      if (t < minTemp) minTemp = t;
      if (t > maxTemp) maxTemp = t;
    }
  }

  if (!temps.length) {
    return { minTemp: null, maxTemp: null, avgTemp: null, count: 0 };
  }

  return {
    minTemp,
    maxTemp,
    avgTemp: avg(temps),
    count: temps.length
  };
}

function computeDiurnalSpread(hourly, start, end) {
  const { minTemp, maxTemp } = summarizeTemps(hourly, start, end);
  if (minTemp == null || maxTemp == null) {
    return { minT: null, maxT: null, spread: null };
  }
  return { minT: minTemp, maxT: maxTemp, spread: maxTemp - minTemp };
}

function summarizeWindGusts(hourly, start, end) {
  const gustArr = hourly?.windgusts_10m || [];
  let maxGust = 0;

  for (let i = start; i < end; i++) {
    const g = safeNum(gustArr, i);
    if (g != null && g > maxGust) {
      maxGust = g;
    }
  }

  return { maxGust };
}

function summarizeDewAndUV(hourly, start, end) {
  const dewArr = hourly?.dewpoint_2m || [];
  const uvArr = hourly?.uv_index || [];

  let maxDew = -Infinity;
  let maxUV = 0;
  let dewSeen = false;

  for (let i = start; i < end; i++) {
    const d = safeNum(dewArr, i);
    if (d != null) {
      dewSeen = true;
      if (d > maxDew) maxDew = d;
    }

    const uv = safeNum(uvArr, i);
    if (uv != null && uv > maxUV) {
      maxUV = uv;
    }
  }

  return {
    maxDew: dewSeen ? maxDew : null,
    maxUV
  };
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
/* ----------------------------------------------------
   PART 3 — THERMAL PROFILE ENGINE
   ---------------------------------------------------- */

/**
 * Approximate wet‑bulb temperature using a simple, stable formula.
 * This is not a full psychrometric calculation, but it is accurate
 * enough for precip‑type decisions in mountain climates.
 */
function computeWetBulb(tempF, dewF) {
  if (tempF == null || dewF == null) return null;

  // Simple approximation: Tw ≈ T * atan(0.151977 * sqrt(RH + 8.313659))
  // But we don't have RH here, so we approximate using dewpoint spread.
  const spread = tempF - dewF;

  // If dewpoint is close to temp, wet‑bulb ≈ temp.
  if (spread <= 2) return tempF - 0.5;

  // If dewpoint is far below temp, wet‑bulb drops significantly.
  if (spread >= 15) return tempF - 8;

  // Linear interpolation for mid‑range spreads.
  return tempF - (spread * 0.5);
}

/**
 * Determine precip type for a single hour based on:
 * - Temperature
 * - Dewpoint
 * - Wet‑bulb temperature
 * - Snowfall amount
 */
function classifyHourlyPrecipType(tempF, dewF, snowIn) {
  if (snowIn != null && snowIn > 0.05) {
    return "snow";
  }

  const tw = computeWetBulb(tempF, dewF);
  if (tw == null) return "unknown";

  if (tw <= 31.5) return "snow";
  if (tw <= 33.0) return "mix";
  return "rain";
}

/**
 * Detect Cold‑Air Damming (CAD) signatures.
 * CAD indicators:
 * - NE/E wind gust pattern (approx via gust magnitude + temp trend)
 * - Falling temps during precip
 * - Dewpoint rising while temp falls
 */
function detectCAD(hourly, start, end) {
  const tempArr = hourly.temperature_2m || [];
  const dewArr = hourly.dewpoint_2m || [];
  const gustArr = hourly.windgusts_10m || [];

  let fallingTemps = false;
  let risingDew = false;
  let cadWind = false;

  for (let i = start + 1; i < end; i++) {
    const tPrev = safeNum(tempArr, i - 1);
    const tCurr = safeNum(tempArr, i);
    const dPrev = safeNum(dewArr, i - 1);
    const dCurr = safeNum(dewArr, i);
    const g = safeNum(gustArr, i);

    if (tPrev != null && tCurr != null && tCurr < tPrev) {
      fallingTemps = true;
    }

    if (dPrev != null && dCurr != null && dCurr > dPrev) {
      risingDew = true;
    }

    // CAD wind signature: gusty but not NW‑flow gusty
    if (g != null && g >= 10 && g <= 25) {
      cadWind = true;
    }
  }

  return fallingTemps && risingDew && cadWind;
}

/**
 * Detect freezing drizzle potential.
 * Conditions:
 * - Temp between 28–32°F
 * - Very low QPF (< 0.05")
 * - Dewpoint close to temp
 * - No strong lift (no convective spikes)
 */
function detectFreezingDrizzle(hourly, start, end) {
  const tempArr = hourly.temperature_2m || [];
  const dewArr = hourly.dewpoint_2m || [];
  const rainArr = hourly.precipitation || [];

  let possible = false;

  for (let i = start; i < end; i++) {
    const t = safeNum(tempArr, i);
    const d = safeNum(dewArr, i);
    const r = safeNum(rainArr, i);

    if (t == null || d == null || r == null) continue;

    const spread = t - d;

    if (t >= 28 && t <= 32 && r > 0 && r < 0.05 && spread <= 4) {
      possible = true;
    }
  }

  return possible;
}

/**
 * Summarize thermal profile for tomorrow.
 * Returns:
 * {
 *   precipType: "rain" | "snow" | "mix" | "none",
 *   freezingDrizzle: boolean,
 *   cad: boolean,
 *   minTemp,
 *   maxTemp,
 *   wetBulbMin,
 *   wetBulbMax
 * }
 */
function analyzeThermalProfile(hourly, start, end) {
  const tempArr = hourly.temperature_2m || [];
  const dewArr = hourly.dewpoint_2m || [];
  const snowArr = hourly.snowfall || [];

  let minTemp = Infinity;
  let maxTemp = -Infinity;
  let wetBulbMin = Infinity;
  let wetBulbMax = -Infinity;

  let rainCount = 0;
  let snowCount = 0;
  let mixCount = 0;

  for (let i = start; i < end; i++) {
    const t = safeNum(tempArr, i);
    const d = safeNum(dewArr, i);
    const s = safeNum(snowArr, i);

    if (t != null) {
      if (t < minTemp) minTemp = t;
      if (t > maxTemp) maxTemp = t;
    }

    const tw = computeWetBulb(t, d);
    if (tw != null) {
      if (tw < wetBulbMin) wetBulbMin = tw;
      if (tw > wetBulbMax) wetBulbMax = tw;
    }

    const type = classifyHourlyPrecipType(t, d, s);
    if (type === "rain") rainCount++;
    if (type === "snow") snowCount++;
    if (type === "mix") mixCount++;
  }

  let precipType = "none";
  if (snowCount > 0 && rainCount === 0) precipType = "snow";
  else if (rainCount > 0 && snowCount === 0) precipType = "rain";
  else if (mixCount > 0 || (rainCount > 0 && snowCount > 0)) precipType = "mix";

  const freezingDrizzle = detectFreezingDrizzle(hourly, start, end);
  const cad = detectCAD(hourly, start, end);

  return {
    precipType,
    freezingDrizzle,
    cad,
    minTemp: minTemp === Infinity ? null : minTemp,
    maxTemp: maxTemp === -Infinity ? null : maxTemp,
    wetBulbMin: wetBulbMin === Infinity ? null : wetBulbMin,
    wetBulbMax: wetBulbMax === -Infinity ? null : wetBulbMax
  };
}
/* ----------------------------------------------------
   PART 4 — HUMAN‑ACTION OUTLOOK 2.0
   ---------------------------------------------------- */

/**
 * Generate a human‑friendly outlook for tomorrow using:
 * - QPF analysis (rain/snow categories, convective, NW‑flow)
 * - Thermal profile (rain/snow/mix, CAD, freezing drizzle)
 * - Wind gusts
 * - Dewpoint (humidity)
 * - UV index
 */
function buildHumanActionOutlook(qpf, thermal, wind, dew, uv) {
  const { rain, snow, convective, stratiform, nwFlowSnow, rainTotal, snowTotal } = qpf;
  const { precipType, freezingDrizzle, cad, minTemp, maxTemp, wetBulbMin } = thermal;
  const { maxGust } = wind;
  const { maxDew } = dew;
  const maxUV = uv;

  /* ----------------------------------------------------
     1) SNOW‑RELATED OUTLOOKS
     ---------------------------------------------------- */
  if (snow.severity >= 3) {
    // Light accumulation or more
    return {
      emoji: "❄️",
      headline: snow.label,
      text: `Expect around ${snowTotal.toFixed(1)}" of snow. Roads may become slick, especially early.`
    };
  }

  if (nwFlowSnow && snowTotal < 1.0) {
    return {
      emoji: "🌨️",
      headline: "NW‑flow snow showers",
      text: "Light, intermittent snow showers possible — classic Asheville upslope pattern."
    };
  }

  if (snow.severity === 2) {
    return {
      emoji: "🌨️",
      headline: "Dusting possible",
      text: "A light coating on grassy surfaces is possible, especially in the morning."
    };
  }

  if (freezingDrizzle) {
    return {
      emoji: "🧊",
      headline: "Freezing drizzle possible",
      text: "Light icing may occur on elevated surfaces. Use caution on bridges and overpasses."
    };
  }

  /* ----------------------------------------------------
     2) RAIN‑RELATED OUTLOOKS
     ---------------------------------------------------- */
  if (rain.severity >= 4) {
    return {
      emoji: "🌧️",
      headline: rain.label,
      text: `Around ${rainTotal.toFixed(2)}" of rain expected. Roads may be wet all day.`
    };
  }

  if (convective) {
    return {
      emoji: "⛈️",
      headline: "Downpours possible",
      text: "A few heavier showers or thunderstorms may develop in the afternoon."
    };
  }

  if (rain.severity === 3) {
    return {
      emoji: "🌦️",
      headline: "Light rain expected",
      text: "On‑and‑off light rain. A jacket or umbrella will help."
    };
  }

  if (rain.severity === 2) {
    return {
      emoji: "🌤️",
      headline: "Spotty showers",
      text: "Most of the day stays dry, but a brief shower is possible."
    };
  }

  /* ----------------------------------------------------
     3) WIND‑RELATED OUTLOOKS (Asheville‑tuned)
     ---------------------------------------------------- */
  if (maxGust >= 40) {
    return {
      emoji: "🌬️",
      headline: "Strong winds",
      text: "Secure outdoor items. Gusts may exceed 40 mph."
    };
  }

  if (maxGust >= 30) {
    return {
      emoji: "💨",
      headline: "Gusty conditions",
      text: "Expect noticeable wind throughout the day."
    };
  }

  if (maxGust >= 20) {
    return {
      emoji: "🌬️",
      headline: "Breezy at times",
      text: "Light jackets recommended, especially in the morning."
    };
  }

  /* ----------------------------------------------------
     4) HEAT / HUMIDITY / UV
     ---------------------------------------------------- */
  if (maxTemp >= 88 && maxDew >= 68) {
    return {
      emoji: "🥵",
      headline: "Hot and humid",
      text: "Hydrate and avoid prolonged sun exposure."
    };
  }

  if (maxUV >= 7 && rainTotal < 0.05) {
    return {
      emoji: "🌞",
      headline: "High UV index",
      text: "Sunscreen recommended, especially midday."
    };
  }

  /* ----------------------------------------------------
     5) COLD / CAD / CHILL
     ---------------------------------------------------- */
  if (cad && precipType !== "snow") {
    return {
      emoji: "🧊",
      headline: "Cold‑air damming",
      text: "Expect chilly, damp conditions with a raw feel."
    };
  }

  if (minTemp <= 32 && rainTotal < 0.05) {
    return {
      emoji: "🥶",
      headline: "Cold morning",
      text: "Frost possible early. Dress warmly."
    };
  }

  /* ----------------------------------------------------
     6) GOLDILOCKS DAY (Asheville’s favorite)
     ---------------------------------------------------- */
  if (
    maxTemp >= 65 &&
    maxTemp <= 75 &&
    maxDew >= 45 &&
    maxDew <= 55 &&
    rainTotal < 0.05 &&
    maxGust < 15
  ) {
    return {
      emoji: "🌟",
      headline: "Goldilocks Day!",
      text: "Mild temps, low humidity, light winds — a perfect Asheville day."
    };
  }

  /* ----------------------------------------------------
     7) DEFAULT MILD DAY
     ---------------------------------------------------- */
  return {
    emoji: "🙂",
    headline: "A mild, uneventful day",
    text: "Comfortable weather with no special prep needed."
  };
}

/**
 * Public function used by index.html
 * This wraps all the analysis into one call.
 */
export function getHumanActionOutlook(hourly) {
  const { start, end } = getTomorrowWindow(hourly);

  const qpf = analyzeQPF(hourly, start, end);
  const thermal = analyzeThermalProfile(hourly, start, end);
  const wind = summarizeWindGusts(hourly, start, end);
  const dew = summarizeDewAndUV(hourly, start, end);
  const uv = dew.maxUV;

  return buildHumanActionOutlook(qpf, thermal, wind, dew, uv);
}
/* ----------------------------------------------------
   PART 5 — ALERTS 2.0 + EXPORTS
   ---------------------------------------------------- */

/**
 * Build a list of forecast alerts for the next 12–48 hours.
 * Uses:
 * - QPF analysis
 * - Thermal profile
 * - Wind gusts
 * - UV + humidity
 */
export function getForecastAlerts(hourly) {
  if (!hourly || !hourly.time) return [];

  // 12–48 hour window for alerts
  const len = hourly.time.length;
  const start = Math.min(12, len - 1);
  const end = Math.min(48, len);

  const qpf = analyzeQPF(hourly, start, end);
  const thermal = analyzeThermalProfile(hourly, start, end);
  const wind = summarizeWindGusts(hourly, start, end);
  const dew = summarizeDewAndUV(hourly, start, end);
  const maxUV = dew.maxUV;

  const alerts = [];

  // Timing windows
  const rainTiming = findEventTiming(
    hourly,
    start,
    end,
    i => (hourly.precipitation?.[i] ?? 0) > 0.02
  );

  const snowTiming = findEventTiming(
    hourly,
    start,
    end,
    i => (hourly.snowfall?.[i] ?? 0) > 0.02
  );

  const windTiming = findEventTiming(
    hourly,
    start,
    end,
    i => (hourly.windgusts_10m?.[i] ?? 0) >= 30
  );

  /* ---------------- SNOW ALERTS ---------------- */
  if (qpf.snow.severity >= 3) {
    alerts.push({
      icon: "❄️",
      id: "snow",
      title: qpf.snow.label,
      detail: `Around ${qpf.snowTotal?.toFixed?.(1) ?? qpf.snowTotal}" of snow expected${timingPhrase(
        snowTiming
      )}. Roads may become slick.`
    });
  }

  if (qpf.nwFlowSnow && qpf.snow.severity <= 2) {
    alerts.push({
      icon: "🌨️",
      id: "nwflow",
      title: "NW‑flow snow showers",
      detail: `Light upslope snow showers possible${timingPhrase(
        snowTiming
      )} — classic Asheville pattern.`
    });
  }

  if (thermal.freezingDrizzle) {
    alerts.push({
      icon: "🧊",
      id: "fzdrizzle",
      title: "Freezing drizzle possible",
      detail: "Light icing may occur on elevated surfaces. Use caution on bridges and overpasses."
    });
  }

  /* ---------------- RAIN ALERTS ---------------- */
  if (qpf.rain.severity >= 4) {
    alerts.push({
      icon: "🌧️",
      id: "rain",
      title: qpf.rain.label,
      detail: `Around ${qpf.rainTotal?.toFixed?.(2) ?? qpf.rainTotal}" of rain expected${timingPhrase(
        rainTiming
      )}. Roads may be wet.`
    });
  }

  if (qpf.convective) {
    alerts.push({
      icon: "⛈️",
      id: "tstorms",
      title: "Downpours or thunderstorms",
      detail: `A few heavier showers or thunderstorms may develop${timingPhrase(
        rainTiming
      )}.`
    });
  }

  /* ---------------- WIND ALERTS ---------------- */
  if (wind.maxGust >= 40) {
    alerts.push({
      icon: "🌬️",
      id: "strongwind",
      title: "Strong winds",
      detail: `Gusts may exceed ${wind.maxGust.toFixed(0)} mph${timingPhrase(
        windTiming
      )}. Secure outdoor items.`
    });
  } else if (wind.maxGust >= 30) {
    alerts.push({
      icon: "💨",
      id: "gusty",
      title: "Gusty conditions",
      detail: `Wind gusts up to ${wind.maxGust.toFixed(0)} mph expected${timingPhrase(
        windTiming
      )}.`
    });
  }

  /* ---------------- HEAT / COLD ---------------- */
  if (thermal.maxTemp != null && thermal.maxTemp >= 88 && dew.maxDew >= 68) {
    alerts.push({
      icon: "🥵",
      id: "heat",
      title: "Hot and humid",
      detail: `Highs near ${thermal.maxTemp.toFixed(
        0
      )}°F with muggy conditions. Stay hydrated.`
    });
  }

  if (thermal.minTemp != null && thermal.minTemp <= 15) {
    alerts.push({
      icon: "🥶",
      id: "cold",
      title: "Bitter cold",
      detail: `Lows may fall to around ${thermal.minTemp.toFixed(
        0
      )}°F. Dress warmly.`
    });
  }

  /* ---------------- UV ALERT ---------------- */
  if (maxUV >= 7 && qpf.rainTotal < 0.05) {
    alerts.push({
      icon: "🌞",
      id: "uv",
      title: "High UV index",
      detail: "Sunscreen recommended, especially midday."
    });
  }

  return alerts;
}

  /* ----------------------------------------------------
     SNOW ALERTS
     ---------------------------------------------------- */
  if (qpf.snow.severity >= 3) {
    alerts.push({
      icon: "❄️",
      id: "snow",
      title: qpf.snow.label,
      detail: `Around ${qpf.snowTotal?.toFixed?.(1) ?? qpf.snowTotal}" of snow expected. Roads may become slick.`
    });
  }

  if (qpf.nwFlowSnow && qpf.snow.severity <= 2) {
    alerts.push({
      icon: "🌨️",
      id: "nwflow",
      title: "NW‑flow snow showers",
      detail: "Light upslope snow showers possible — classic Asheville pattern."
    });
  }

  if (thermal.freezingDrizzle) {
    alerts.push({
      icon: "🧊",
      id: "fzdrizzle",
      title: "Freezing drizzle possible",
      detail: "Light icing may occur on elevated surfaces. Use caution on bridges and overpasses."
    });
  }

  /* ----------------------------------------------------
     RAIN ALERTS
     ---------------------------------------------------- */
  if (qpf.rain.severity >= 4) {
    alerts.push({
      icon: "🌧️",
      id: "rain",
      title: qpf.rain.label,
      detail: `Around ${qpf.rainTotal?.toFixed?.(2) ?? qpf.rainTotal}" of rain expected. Roads may be wet all day.`
    });
  }

  if (qpf.convective) {
    alerts.push({
      icon: "⛈️",
      id: "tstorms",
      title: "Downpours or thunderstorms",
      detail: "A few heavier showers or thunderstorms may develop in the afternoon."
    });
  }

  /* ----------------------------------------------------
     WIND ALERTS (Asheville‑tuned)
     ---------------------------------------------------- */
  if (wind.maxGust >= 40) {
    alerts.push({
      icon: "🌬️",
      id: "strongwind",
      title: "Strong winds",
      detail: `Gusts may exceed ${wind.maxGust.toFixed(0)} mph. Secure outdoor items.`
    });
  } else if (wind.maxGust >= 30) {
    alerts.push({
      icon: "💨",
      id: "gusty",
      title: "Gusty conditions",
      detail: `Wind gusts up to ${wind.maxGust.toFixed(0)} mph expected.`
    });
  }

  /* ----------------------------------------------------
     HEAT / COLD ALERTS
     ---------------------------------------------------- */
  if (thermal.maxTemp != null && thermal.maxTemp >= 88 && dew.maxDew >= 68) {
    alerts.push({
      icon: "🥵",
      id: "heat",
      title: "Hot and humid",
      detail: `Highs near ${thermal.maxTemp.toFixed(0)}°F with muggy conditions. Stay hydrated.`
    });
  }

  if (thermal.minTemp != null && thermal.minTemp <= 15) {
    alerts.push({
      icon: "🥶",
      id: "cold",
      title: "Bitter cold",
      detail: `Lows may fall to around ${thermal.minTemp.toFixed(0)}°F. Dress warmly.`
    });
  }

  /* ----------------------------------------------------
     UV ALERT
     ---------------------------------------------------- */
  if (maxUV >= 7 && qpf.rainTotal < 0.05) {
    alerts.push({
      icon: "🌞",
      id: "uv",
      title: "High UV index",
      detail: "Sunscreen recommended, especially midday."
    });
  }

  return alerts;
}
/* ----------------------------------------------------
   MODULE COMPLETE
   ---------------------------------------------------- */
