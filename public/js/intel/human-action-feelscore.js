// ============================================================
// HUMAN ACTION — FEELSCORE (FULL REWRITE - NON REDUCTIVE)
// ============================================================

import { calculateComfort } from "./comfort.js";
import { assembleWithVoice } from "./synthesizer/assembleWithVoice.js";
import { buildFullExplanation } from "../intel/explanations/buildFullExplanation.js";

// ============================================================
// TIME HELPERS
// ============================================================

function getTs(h) {
  const ts = h?.timestamp ?? h?.ts ?? null;
  if (!ts) return null;
  return ts < 1e12 ? ts * 1000 : ts;
}

// 🔥 ALIGN DATA TO "NOW" (CORE FIX)
function alignHourly(hourlyRaw = []) {
  const now = Date.now();

  const sorted = hourlyRaw
    .map(h => ({ ...h, _ts: getTs(h) }))
    .filter(h => h._ts)
    .sort((a, b) => a._ts - b._ts);

  const startIndex = sorted.findIndex(h => h._ts >= now);

  return startIndex === -1 ? [] : sorted.slice(startIndex);
}

// 🔥 SPLIT INTO CALENDAR DAYS (FIXES TOMORROW BUG)
function splitDays(hourly, now) {
  const d = new Date(now);

  const startToday = new Date(d);
  startToday.setHours(0, 0, 0, 0);

  const startTomorrow = new Date(startToday);
  startTomorrow.setDate(startTomorrow.getDate() + 1);

  const startNext = new Date(startTomorrow);
  startNext.setDate(startNext.getDate() + 1);

  const today = [];
  const tomorrow = [];

  for (const h of hourly) {
    const ts = h._ts;
    if (!ts) continue;

    if (ts >= startToday && ts < startTomorrow) {
      today.push(h);
    } else if (ts >= startTomorrow && ts < startNext) {
      tomorrow.push(h);
    }
  }

  return { today, tomorrow };
}
// ============================================================
// WEIGHTED CURRENT CONDITIONS (NEW)
// ============================================================

function buildWeightedCurrent(hours = []) {
  const h0 = hours[0] || {};
  const h1 = hours[1] || {};
  const h2 = hours[2] || {};

  const weights = [0.6, 0.3, 0.1];

  const wAvg = (vals) => {
    const valid = vals.map((v, i) =>
      Number.isFinite(v) ? v * weights[i] : null
    ).filter(v => v != null);

    const totalWeight = vals.reduce((sum, v, i) =>
      Number.isFinite(v) ? sum + weights[i] : sum
    , 0);

    return totalWeight
      ? valid.reduce((a, b) => a + b, 0) / totalWeight
      : null;
  };

  return {
    temperatureF: wAvg([h0.temperatureF, h1.temperatureF, h2.temperatureF]),
    dewpointF:    wAvg([h0.dewpointF,    h1.dewpointF,    h2.dewpointF]),
    windSpeed:    wAvg([h0.windSpeed,    h1.windSpeed,    h2.windSpeed]),
    windGust: Math.max(
      h0.windGust ?? 0,
      h1.windGust ?? 0,
      h2.windGust ?? 0
    )
  };
}
// ============================================================
// SHORT-TERM TREND (NEW)
// ============================================================
function computeShortTermTrend(hours = []) {
  const [h0 = {}, h1 = {}, h2 = {}] = hours;

  const get = (v) => (Number.isFinite(v) ? v : null);

  const t0 = get(h0.temperatureF);
  const t2 = get(h2.temperatureF);

  const d0 = get(h0.dewpointF);
  const d2 = get(h2.dewpointF);

  const w0 = get(h0.windSpeed);
  const w2 = get(h2.windSpeed);

  const tempTrend =
    t0 != null && t2 != null ? t2 - t0 : null;

  const dewTrend =
    d0 != null && d2 != null ? d2 - d0 : null;

  const windTrend =
    w0 != null && w2 != null ? w2 - w0 : null;

  return {
    tempTrend,
    dewTrend,
    windTrend
  };
}

// ============================================================
// NARRATIVE TREND FLAVOR (ANTI-REPEAT)
// ============================================================

function applyTrendFlavor(text, shortTerm = {}) {
  if (!text) return text;

  const { tempTrend = 0, dewTrend = 0, windTrend = 0 } = shortTerm;

  let additions = [];

  if (tempTrend >= 2 && !text.includes("climbing")) {
    additions.push("Temperatures are climbing over the next couple of hours.");
  }

  if (tempTrend <= -2 && !text.includes("ease downward")) {
    additions.push("Temperatures are starting to ease downward.");
  }

  if (dewTrend >= 2 && !text.includes("increasing")) {
    additions.push("Humidity is gradually increasing.");
  }

  if (dewTrend <= -2 && !text.includes("drying out")) {
    additions.push("The air is drying out a bit.");
  }

  if (windTrend >= 3 && !text.includes("pick up")) {
    additions.push("Winds are beginning to pick up.");
  }

  if (windTrend <= -3 && !text.includes("easing")) {
    additions.push("Winds are easing.");
  }

  if (!additions.length) return text;

  return text + " " + additions.join(" ");
}

// ------------------------------------------------------------
// WIND SMOOTHING
// ------------------------------------------------------------

function smoothWind(current, hours = []) {
  const idx = hours.findIndex(h => h.timestamp === current.timestamp);

  if (idx === -1) return current.windSpeed;

  const window = hours.slice(idx, idx + 3);

  const values = [
    current.windSpeed,
    ...window.map(h => h.windSpeed)
  ].filter(Number.isFinite);

  if (!values.length) return current.windSpeed;

  return values.reduce((a, b) => a + b, 0) / values.length;
}

function smoothGust(current, hours = []) {
  const idx = hours.findIndex(h => h.timestamp === current.timestamp);

  if (idx === -1) return current.windGust;

  const window = hours.slice(idx, idx + 3);

  const values = [
    current.windGust,
    ...window.map(h => h.windGust)
  ].filter(Number.isFinite);

  if (!values.length) return current.windGust;

  const avg = values.reduce((a, b) => a + b, 0) / values.length;

  return Math.min(avg, (current.windSpeed ?? 0) * 2.5);
}

// ------------------------------------------------------------
// GUSTINESS
// ------------------------------------------------------------
function calculateGustiness(windSpeed, windGust) {
  if (!Number.isFinite(windSpeed) || !Number.isFinite(windGust)) return 0;
  return Math.max(0, windGust - windSpeed);
}

// ============================================================
// MAIN ENTRY
// ============================================================

export function buildHumanActionIntelFS(raw) {

  const tempest = raw?.tempest ?? null;

  const rawHourly = Array.isArray(raw?.hourly) ? raw.hourly : [];

  console.log("FEELSCORE INPUT SAMPLE:", rawHourly[0]);
console.log("TEMPEST IN FEELSCORE:", tempest);
  console.log("RAW HOURLY SAMPLE (first 5):");

  rawHourly.slice(0, 5).forEach((h, i) => {
    console.log(i, {
      temp: h.temperatureF,
      dew: h.dewpointF,
      wind: h.windSpeed,
      ts: h.timestamp,
      date: new Date(getTs(h)).toString()
    });
  });

  if (!rawHourly.length) return fallbackAll();

  const now = Date.now();

  // 🔥 FIX 1: ALIGN TIMELINE
  const hourly = alignHourly(rawHourly);
  if (!hourly.length) return fallbackAll();

  // 🔥 FIX 2: CORRECT DAY SPLIT
  const { today: todayHours, tomorrow: tomorrowHours } = splitDays(hourly, now);

  console.log("NOW:", new Date(now).toString());

  console.log(
    "TODAY HOURS (sample):",
    todayHours.slice(0, 3).map(h => ({
      temp: h.temperatureF,
      ts: h._ts,
      date: new Date(h._ts).toString()
    }))
  );

  console.log(
    "TOMORROW HOURS (sample):",
    tomorrowHours.slice(0, 3).map(h => ({
      temp: h.temperatureF,
      ts: h._ts,
      date: new Date(h._ts).toString()
    }))
  );

  // ==========================================================
  // TEMPERATURE ANALYSIS
  // ==========================================================

  const todayTemps = todayHours.map(h => h.temperatureF).filter(Number.isFinite);
  const tomorrowTemps = tomorrowHours.map(h => h.temperatureF).filter(Number.isFinite);

  const todayMax = todayTemps.length ? Math.max(...todayTemps) : null;
  const tomorrowMax = tomorrowTemps.length ? Math.max(...tomorrowTemps) : null;

  const tempDrop =
    todayMax !== null && tomorrowMax !== null
      ? todayMax - tomorrowMax
      : 0;

  const tomorrowMorning = tomorrowHours.filter(h => {
    const hr = new Date(h._ts).getHours();
    return hr >= 5 && hr <= 10;
  });

  const tomorrowMorningTemps = tomorrowMorning
    .map(h => h.temperatureF)
    .filter(Number.isFinite);

  const tomorrowMin = tomorrowMorningTemps.length
    ? Math.min(...tomorrowMorningTemps)
    : null;

  console.log("TEMP DEBUG:", {
    todayMax,
    tomorrowMax,
    tempDrop,
    tomorrowMin,
    counts: {
      today: todayHours.length,
      tomorrow: tomorrowHours.length,
      tomorrowMorning: tomorrowMorning.length
    }
  });

  // ==========================================================
  // WIND ANALYSIS
  // ==========================================================

  const todayWindMax = Math.max(
    ...todayHours.map(h => h.windSpeed ?? 0),
    0
  );

  const tomorrowWindMax = Math.max(
    ...tomorrowHours.map(h => h.windSpeed ?? 0),
    0
  );

  const windJump = tomorrowWindMax - todayWindMax;

  // ==========================================================
  // BUILD OUTPUT
  // ==========================================================

  const tomorrowCtx = buildPeriod(tomorrowHours, "tomorrow", {
    tempDrop,
    windJump,
    tomorrowMin
  });

  return {
    feelscore: buildCurrentWithTrend(todayHours, tempest),
    tomorrow: buildPeriodNarrative(tomorrowCtx, "tomorrow")
  };
}

// ============================================================
// PRECIP TYPE (GLOBAL — REQUIRED)
// ============================================================

function getPrecipType({
  precipProbability = 0,
  precipAmount = 0,
  hours = []
}) {

  const maxProb = precipProbability;

  const maxRate = Math.max(
    ...hours.map(h => h.precipAmount ?? 0),
    0
  );

  const activeHours = hours.filter(
    h => (h.precipAmount ?? 0) > 0
  ).length;

  // 🌧️ INTENSITY FIRST
  if (maxRate >= 0.10) return "steady_rain";
  if (maxRate >= 0.03) return "light_rain";

  // 🌦️ COVERAGE
  if (maxProb >= 70 && activeHours >= 6) return "periods_of_rain";
  if (maxProb >= 50) return "scattered_showers";
  if (maxProb >= 20) return "isolated_showers";

  return "none";
}

function buildSnapshot(hours = []) {
  if (!hours.length) return null;

  const first = hours[0];

  const maxProb = Math.max(...hours.map(h => h.precipProbability ?? 0), 0);
  const maxAmt  = Math.max(...hours.map(h => h.precipAmount ?? 0), 0);
  const avgAmt  = avg(hours.map(h => h.precipAmount ?? 0)) ?? 0;

  const snapshot = {
    temp: first.temperatureF,
    dewPoint: first.dewpointF,
    wind: first.windSpeed,
    gust: first.windGust,

    precipProbability: maxProb,
    precipAmount: maxAmt,
    precipAmountAvg: avgAmt,

    isRainingNow: (hours[0]?.precipAmount ?? 0) > 0
  };

  snapshot.precipType = getPrecipType({
    precipProbability: snapshot.precipProbability,
    precipAmount: snapshot.precipAmount,
    hours
  });

  return snapshot;
}

// ============================================================
// BUILD PERIOD CORE (SMOOTHED + CONSISTENT)
// ============================================================

function buildPeriod(hours, label, change = {}) {
  if (!Array.isArray(hours) || !hours.length) return null;

  // ✅ ADD THIS LINE
  const snapshot = buildSnapshot(hours);
  console.log("🌧️ SNAPSHOT IN PERIOD:", snapshot);

  const scores = hours.map((h, i) => {
    let adjusted = { ...h };

    // ------------------------------------------------------------
    // 🆕 APPLY REALISM TO NEAR-TERM HOURS ONLY
    // ------------------------------------------------------------
    if (i < 3) {
      adjusted.windSpeed = smoothWind(adjusted, hours);
      adjusted.windGust = smoothGust(adjusted, hours);

      const gustiness = calculateGustiness(
        adjusted.windSpeed,
        adjusted.windGust
      );

      let score = calculateComfort(adjusted)?.score;

      if (!Number.isFinite(score)) return null;

      // 🆕 GUST PENALTY
      if (gustiness >= 12) score -= 0.5;
      else if (gustiness >= 7) score -= 0.25;

      return Math.round(score * 10);
    }

    // ------------------------------------------------------------
    // FARTHER HOURS = RAW MODEL
    // ------------------------------------------------------------
    const base = calculateComfort(h)?.score;
    return Number.isFinite(base) ? Math.round(base * 10) : null;

  }).filter(Number.isFinite);

  if (!scores.length) return null;

  const score = Math.round(average(scores));
  const trend = scores.at(-1) - scores[0];


// ------------------------------------------------------------
// WIND METRICS (FIXED + SAFE)
// ------------------------------------------------------------
const windValues = hours.map((h, i) => {
  const raw = Number.isFinite(h.windSpeed) ? Math.max(0, h.windSpeed) : 0;

  // smooth near-term hours only
  if (i < 3) {
    const smoothed = smoothWind(h, hours);
    return Number.isFinite(smoothed) ? Math.max(0, smoothed) : raw;
  }

  return raw;
});

const gustValues = hours.map(h =>
  Number.isFinite(h.windGust) ? Math.max(0, h.windGust) : 0
);

const maxWind = windValues.length ? Math.max(...windValues) : 0;
const maxGust = gustValues.length ? Math.max(...gustValues) : 0;

// ------------------------------------------------------------
// 🔍 DEBUG (CORRECT + USEFUL)
// ------------------------------------------------------------
if (label === "tomorrow") {
  console.log("🌬️ TOMORROW WIND FINAL", {
    maxWind,
    maxGust,
    avgWind: avg(windValues),
    sample: hours.slice(0, 8).map(h => ({
      hour: new Date(h._ts).getHours(),
      wind: h.windSpeed,
      gust: h.windGust
    }))
  });
}

if (label === "tomorrow") {
  console.log("💧 HUMIDITY + DEW CHECK", {
    humidity: hours.map(h => ({
      raw: h.humidity,
      rh: h.relativeHumidity,
      rh_alt: h.relative_humidity
    })),
    dew: hours.map(h => h.dewpointF)
  });
}

// ------------------------------------------------------------
// WIND IMPACT (STABLE)
// ------------------------------------------------------------
const windImpact = Math.max(
  ...hours.map(h => {
    const w = Number.isFinite(h.windSpeed) ? Math.max(0, h.windSpeed) : 0;
    const g = Number.isFinite(h.windGust) ? Math.max(0, h.windGust) : 0;
    return Math.max(w, g * 0.7);
  }),
  0
);

// ------------------------------------------------------------
// CHANGE METRICS (UNCHANGED)
// ------------------------------------------------------------
const { tempDrop = 0, windJump = 0, tomorrowMin = null } = change;

// ------------------------------------------------------------
// WIND CHILL (SAFE)
// ------------------------------------------------------------
const windChill = calcWindChill(snapshot.temp, snapshot.wind ?? 0);
const chillDelta = snapshot.temp - windChill;

// ------------------------------------------------------------
// FLAGS (UNCHANGED)
// ------------------------------------------------------------
const isShockDay = label === "tomorrow" && tempDrop >= 18;

const hasColdStart =
  label === "tomorrow" &&
  Number.isFinite(tomorrowMin) &&
  tomorrowMin <= 50;

  // ------------------------------------------------------------
  // INTEL + NARRATIVE (UNCHANGED)
  // ------------------------------------------------------------
  const intel = buildIntel(
    snapshot,
    score,
    trend,
    windImpact,
    maxGust,
    label
  );

  let narrative;
  try {
    narrative = assembleWithVoice(
      intel,
      label,
      mapScoreToCategory(score),
      score >= 85
    );
  } catch {
    narrative = null;
  }

return {
  label,
  score,
  snapshot,
  trend,

  hours, 

  narrativeText:
    narrative?.longNarrative ||
    narrative?.headline ||
    "",

  flags: {
    isShockDay,
    hasColdStart
  },

  change: {
    tempDrop,
    windJump,
    chillDelta,
    tomorrowMin
  },

  wind: {
    maxWind,
    maxGust,
    avgWind: avg(windValues),
    breezyHours: windValues.filter(w => w >= 10).length
  }
};

// ============================================================
// CURRENT FEELSCORE (STABLE + RESPONSIVE)
// ============================================================

function resolveDewpoint(first, tempest) {
  const model = first?.dewpointF;

  const station =
    typeof tempest?.dew_point === "number"
      ? (tempest.dew_point * 9) / 5 + 32
      : null;

  if (station == null) return model;
  if (model == null) return station;

  const diff = Math.abs(station - model);

  const resolved =
    diff <= 2 ? station :
    diff <= 8 ? station * 0.7 + model * 0.3 :
                station * 0.5 + model * 0.5;

  return Math.min(resolved, first?.temperatureF ?? resolved);
}

function buildCurrentWithTrend(hours, tempest = null) {
  if (!hours.length) return fallback("today");

  // ------------------------------------------------------------
  // STEP 1: Smooth near-term model hours
  // ------------------------------------------------------------
  hours = smoothFirstHoursWithTempest(hours, tempest);

  // ------------------------------------------------------------
  // STEP 2: Build weighted current baseline (h0 + h1 + h2)
  // ------------------------------------------------------------
  let first = buildWeightedCurrent(hours);

  // ------------------------------------------------------------
  // STEP 3: Inject real-time Tempest conditions
  // ------------------------------------------------------------
  if (tempest) {
    first = {
      ...first,

      temperatureF:
        (typeof tempest.air_temperature === "number"
          ? (tempest.air_temperature * 9) / 5 + 32
          : null) ?? first.temperatureF,

      dewpointF:
        resolveDewpoint(first, tempest),

      windSpeed:
        tempest.wind_avg ?? first.windSpeed,

      windGust: Math.max(
        first.windGust ?? 0,
        tempest.wind_gust ?? 0
      )
    };
  }

  // ------------------------------------------------------------
  // STEP 4: Wind smoothing (final pass)
  // ------------------------------------------------------------
  const smoothedWind = smoothWind(first, hours);
  const smoothedGust = smoothGust(first, hours);

  first = {
    ...first,
    windSpeed: smoothedWind,
    windGust: smoothedGust
  };

  const gustiness = calculateGustiness(
    first.windSpeed,
    first.windGust
  );

  // ------------------------------------------------------------
  // STEP 5: Recompute short-term trend using adjusted "now"
  // ------------------------------------------------------------
  const adjustedHours = [first, ...hours.slice(1, 3)];
  const shortTrend = computeShortTermTrend(adjustedHours);
// ------------------------------------------------------------
// 🆕 BASE SCORE
// ------------------------------------------------------------

let currentScore = calculateComfort(first)?.score;
if (!Number.isFinite(currentScore)) return fallback("today");

// ------------------------------------------------------------
// 🆕 GUST PENALTY
// ------------------------------------------------------------

if (gustiness >= 12) {
  currentScore -= 0.5;
} else if (gustiness >= 7) {
  currentScore -= 0.25;
}

// ------------------------------------------------------------
// TREND + SNAPSHOT (MERGED MODEL)
// ------------------------------------------------------------

const scores = hours
  .map(h => calculateComfort(h)?.score)
  .filter(Number.isFinite)
  .map(s => Math.round(s * 10));

const trend = scores.length ? scores.at(-1) - scores[0] : 0;

// ------------------------------------------------------------
// 🌧️ AGGREGATES (EVENT SIGNAL)
// ------------------------------------------------------------

const maxProb = Math.max(...hours.map(h => h.precipProbability ?? 0), 0);
const maxAmt  = Math.max(...hours.map(h => h.precipAmount ?? 0), 0);
const avgAmt  = avg(hours.map(h => h.precipAmount ?? 0)) ?? 0;

// ------------------------------------------------------------
// 🔥 SNAPSHOT (HYBRID — NOW + EVENT)
// ------------------------------------------------------------

const snapshot = {
  // ----------------------------------------------------------
  // 🌡️ CURRENT FEEL (first hour = most important)
  // ----------------------------------------------------------
  temp: first.temperatureF,
  dewPoint: first.dewpointF,
  wind: first.windSpeed,
  gust: first.windGust,
  gustiness,

  // ----------------------------------------------------------
  // 🌧️ EVENT SIGNAL (DO NOT use first hour here)
  // ----------------------------------------------------------
  precipProbability: maxProb,
  precipAmount: maxAmt,
  precipAmountAvg: avgAmt,

  // optional but useful
  isRainingNow: first.precipAmount > 0
};

// ------------------------------------------------------------
// 🌧️ PRECIP TYPE (ATTACHED HERE)
// ------------------------------------------------------------

snapshot.precipType = getPrecipType({
  precipProbability: snapshot.precipProbability,
  precipAmount: snapshot.precipAmount,
  hours
});

// ------------------------------------------------------------
// DEBUG
// ------------------------------------------------------------

console.log("🌧️ SNAPSHOT (MERGED):", {
  nowTemp: snapshot.temp,
  prob: snapshot.precipProbability,
  amtMax: snapshot.precipAmount,
  amtAvg: snapshot.precipAmountAvg,
  type: snapshot.precipType
});
// ------------------------------------------------------------
// INTEL + NARRATIVE
// ------------------------------------------------------------

const scoreScaled = currentScore * 10;

const intel = buildIntel(
  snapshot,
  scoreScaled,
  trend,
  0,
  0,
  "today",
  shortTrend
);

let narrative;
try {
  narrative = assembleWithVoice(
    intel,
    "today",
    mapScoreToCategory(scoreScaled),
    scoreScaled >= 85
  );

  // 👇 ADD THIS BLOCK
  if (narrative?.longNarrative) {
    narrative.longNarrative = applyTrendFlavor(
      narrative.longNarrative,
      shortTrend
    );
  }

} catch {
  return fallback("today");
}

// ------------------------------------------------------------
// EXPLANATION
// ------------------------------------------------------------

const explanation = buildFullExplanation(
  {
    temp: snapshot.temp,
    dewPoint: snapshot.dewPoint,
    windSpeed: snapshot.wind
  },
  narrative,
  shortTrend   // ✅ correct
);

// ------------------------------------------------------------
// FINAL OUTPUT
// ------------------------------------------------------------

return {
  label: "today",
  score: Math.round(scoreScaled),

  // 🎯 Use comfort-driven icon instead of generic emoji
  emoji: resolveComfortIcon({
    score: scoreScaled,
    temp: snapshot.temp,
    dewPoint: snapshot.dewPoint,
    wind: {
      maxWind: snapshot.wind,
      maxGust: snapshot.gust,
      avgWind: snapshot.wind,
      breezyHours: snapshot.wind >= 10 ? 3 : 0
    }
  }),

  headline:
    narrative?.headline ||
    (trend > 10
      ? "Rapid improvement in comfort ahead"
      : "Comfort gradually improving"),

  bullets: [explanation]
};
}
// ============================================================
// BUILD NARRATIVE (UNIFIED + DATA-DRIVEN + PRECIP-AWARE)
// ============================================================

function buildPeriodNarrative(ctx, label) {
  if (!ctx) return fallback(label);

  const { score, flags, change, wind, snapshot, hours } = ctx;

  const { isShockDay, hasColdStart } = flags || {};
  const { tempDrop = 0, chillDelta = 0, tomorrowMin = null } = change || {};

  const maxWind = wind?.maxWind ?? 0;
  const maxGust = wind?.maxGust ?? 0;
  const avgWind = wind?.avgWind ?? 0;
  const breezyHours = wind?.breezyHours ?? 0;

  const temp = snapshot?.temp ?? null;
  const dp = snapshot?.dewPoint ?? null;
const precipSignal = getPrecipSignal({
  precipProbability: snapshot?.precipProbability ?? 0,
  precipAmount: snapshot?.precipAmount ?? 0
});

const precipType = snapshot?.precipType ?? "none";
  // ==========================================================
  // CORE CONDITIONS
  // ==========================================================

  const isWindy = maxGust >= 30 || avgWind >= 15;

  const isBreezy =
    !isWindy &&
    ((breezyHours >= 4 && avgWind >= 8) || avgWind >= 12);

  let moisture = "dry";
  if (dp != null) {
    if (dp >= 65) moisture = "humid";
    else if (dp >= 55) moisture = "slightly_humid";
    else if (dp >= 45) moisture = "comfortable";
  }

  let tempBand = "mild";
  if (temp >= 88) tempBand = "hot";
  else if (temp >= 75) tempBand = "warm";
  else if (temp <= 55) tempBand = "cool";

  // ==========================================================
  // HEADLINE (PRECIP FIRST)
  // ==========================================================

  let headline;

if (precipSignal !== "none") {
  if (precipType === "steady_rain") {
    headline = "Periods of steady rain";
  }
  else if (precipType === "periods_of_rain") {
    headline = "Rain at times through the day";
  }
  else if (precipType === "light_rain") {
    headline = "Light rain at times";
  }
  else if (precipType === "scattered_showers") {
    headline = "Scattered showers expected";
  }
  else {
    headline = "A few showers possible";
  }
}
  
  else if (isShockDay) {
    headline =
      tempDrop >= 25
        ? "A sharp cooldown hits tomorrow"
        : "A noticeably cooler day arrives tomorrow";
  } 
  else if (hasColdStart) {
    headline = "A chilly start leads into a cool day";
  }
  else if (isWindy) {
    headline = "Windy conditions may impact plans";
  }
  else if (isBreezy) {
    headline = "A light breeze develops during the day";
  }
  else {
    if (tempBand === "hot" && moisture === "humid") {
      headline = "Hot and humid conditions build tomorrow";
    } 
    else if (tempBand === "hot") {
      headline = "Hot conditions settle in tomorrow";
    }
    else if (tempBand === "cool") {
      headline = "Cool and crisp conditions tomorrow";
    }
    else {
      headline = "Comfortable and steady conditions";
    }
  }

  // ==========================================================
  // NARRATIVE
  // ==========================================================

  let narrative = "";

const temps = ctx?.hours?.map(h => h.temperatureF).filter(Number.isFinite) || [];

const minT = temps.length ? Math.round(Math.min(...temps)) : null;
const maxT = temps.length ? Math.round(Math.max(...temps)) : null;

  if (label === "tomorrow") {

    // 🌧️ PRECIP FIRST
if (precipSignal !== "none") {
  if (precipType === "steady_rain") {
    narrative = "Steady rain is expected through much of the day.";
  }
  else if (precipType === "periods_of_rain") {
    narrative = "Rain moves through at times during the day.";
  }
  else if (precipType === "light_rain") {
    narrative = "Light rain develops at times.";
  }
  else if (precipType === "scattered_showers") {
    narrative = "Scattered showers develop at times.";
  }
  else {
    narrative = "A few passing showers are possible.";
  }
}
    // temps
    if (minT != null && maxT != null) {
      narrative += ` Temperatures start near ${minT}° and rise into the ${maxT}° range by afternoon.`;
    }

    // moisture
    if (moisture === "dry") {
      narrative += " Dry air keeps things feeling crisp and clean.";
    } else if (moisture === "humid") {
      narrative += " Humidity adds a heavier feel at times.";
    }

    // wind
    if (isWindy) {
      narrative += " Winds may be strong enough to impact plans.";
    } else if (isBreezy) {
      narrative += " A light breeze develops through the day.";
    } else {
      narrative += " Winds stay light and out of the way.";
    }
  }

  // ==========================================================
  // BULLETS
  // ==========================================================

  let bullets = [];

  // 🌧️ PRECIP BULLETS
  if (precipSignal === "high") {
    bullets.push("Rain likely");
  }
  else if (precipSignal === "moderate") {
    bullets.push("Scattered showers");
  }
  else if (precipSignal === "low") {
    bullets.push("Slight chance of rain");
  }

  if (isShockDay) {
    bullets.push("Much cooler than today");
  }

  if (hasColdStart && tomorrowMin != null) {
    bullets.push(
      tomorrowMin <= 42
        ? `Cold start near ${Math.round(tomorrowMin)}°`
        : "Cool start early"
    );
  }

  if (isWindy) {
    bullets.push("Windy at times");
  } 
  else if (isBreezy) {
    bullets.push("Light breeze develops");
  }
  else {
    bullets.push("Light winds");
  }

  if (moisture === "dry") {
    bullets.push("Dry, crisp air");
  } 
  else if (moisture === "humid") {
    bullets.push("Humid at times");
  } 
  else {
    bullets.push("Comfortable humidity");
  }

  if (chillDelta >= 5) {
    bullets.push("Feels cooler than actual temperature");
  }

  bullets = [...new Set(bullets)].slice(0, 4);

  // ==========================================================
  // FINAL
  // ==========================================================

  return {
    label,
    score,
    emoji: resolveComfortIcon({
      score,
      temp,
      dewPoint: dp,
      wind
    }),
    headline,
    narrative,
    bullets
  };
}

// ============================================================
// HELPERS
// ============================================================

const avg = arr => {
  const valid = arr.filter(Number.isFinite);
  return valid.length
    ? valid.reduce((a, b) => a + b, 0) / valid.length
    : null;
};

function average(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function extractHeadline(text = "") {
  return text.split(".")[0]?.trim() || "";
}

function extractBullets(text = "", { trend, snapshot, label }) {
  const bullets = [];
  const t = text.toLowerCase();

  if (t.includes("dry")) bullets.push("Dry air keeps things comfortable");
  if (t.includes("wind")) bullets.push("Wind plays a noticeable role");
  if (t.includes("cool") && label === "tomorrow") bullets.push("Cooler air settles in");

  if (trend > 5) bullets.push("Improves through the day");
  if (trend < -5) bullets.push("Slight drop in comfort later");

  return bullets;
}

function pickEmoji(score) {
  if (score >= 80) return "😌";
  if (score >= 65) return "🙂";
  return "😐";
}

function fallback(label) {
  return {
    label,
    score: 50,
    headline: "Conditions are steady",
    narrative: "",
    bullets: [],
    emoji: "😐"
  };
}

function fallbackAll() {
  return {
    feelscore: fallback("today"),
    tomorrow: fallback("tomorrow")
  };
}

function buildIntel(
  snapshot,
  score,
  trend,
  windImpact,
  maxGust,
  label,
  shortTerm = {}
){
return {
  signals: {
    temp: snapshot.temp,
    dewPoint: snapshot.dewPoint ?? null,
    wind: snapshot.wind ?? 0,

    // 👇 ADD THESE
    precipProbability: snapshot.precipProbability ?? 0,
    precipAmount: snapshot.precipAmount ?? 0
  },
  pattern: { trend, avg: score },
  context: { label },

  // 👇 IMPORTANT: pass full snapshot
  precipProbability: snapshot.precipProbability ?? 0,
  precipAmount: snapshot.precipAmount ?? 0,

  dominantFactor: detectDominantFactor({
    ...snapshot,
    precipProbability: snapshot.precipProbability,
    precipAmount: snapshot.precipAmount
  }),

  shortTerm
};
}

// ============================================================
// PRECIP SIGNAL (CORE INTEL — PROBABILITY FIRST)
// ============================================================

function getPrecipSignal({ precipProbability = 0, precipAmount = 0 }) {

  // 🌧️ PRIMARY: probability drives perception
  if (precipProbability >= 70) return "high";
  if (precipProbability >= 40) return "moderate";
  if (precipProbability >= 20) return "low";

  // 🌧️ SECONDARY: amount fallback (for low-prob steady rain)
  if (precipAmount >= 0.10) return "high";
  if (precipAmount >= 0.03) return "moderate";

  return "none";
}


function detectDominantFactor(s = {}) {
  const gustiness = s.gustiness ?? 0;

  const precipSignal = getPrecipSignal({
    precipProbability: s.precipProbability,
    precipAmount: s.precipAmount
  });

  // 🌧️ Rain always matters
  if (precipSignal !== "none") return "rain";

  if (gustiness >= 12) return "gusty_wind";
  if (gustiness >= 7) return "breezy";

  if (s.dewPoint >= 65) return "muggy";
  if (s.temp >= 85) return "heat";
  if (s.temp <= 45) return "cold";

  if (s.wind >= 12) return "wind";

  return "comfortable";
}

function mapScoreToCategory(score) {
  if (score >= 85) return "veryComfortable";
  if (score >= 70) return "comfortable";
  if (score >= 55) return "slight";
  if (score >= 40) return "uncomfortable";
  return "harsh";
}

function calcWindChill(temp, wind) {
  if (temp > 50 || wind < 3) return temp;

  return (
    35.74 +
    0.6215 * temp -
    35.75 * Math.pow(wind, 0.16) +
    0.4275 * temp * Math.pow(wind, 0.16)
  );
}
function smoothFirstHoursWithTempest(hours = [], tempest = null) {
  if (!hours.length || !tempest?.air_temperature) return hours;

  const baseTemp = hours[0].temperatureF;
  const delta = tempest.air_temperature - baseTemp;

  return hours.map((h, i) => {
    if (i > 2) return h; // only adjust first ~2–3 hours

    const decay = 1 - i / 2;

    return {
      ...h,
      temperatureF:
        h.temperatureF != null
          ? h.temperatureF + delta * decay
          : h.temperatureF
    };
  });
}

// ============================================================
// ICON RESOLUTION (FEELSCORE-DRIVEN)
// ============================================================

function resolveComfortIcon({
  score,
  temp,
  dewPoint,
  wind = {},
}) {
  const maxWind = wind.maxWind ?? 0;
  const maxGust = wind.maxGust ?? 0;
  const avgWind = wind.avgWind ?? 0;

  // ------------------------------------------------------------
  // DERIVE CONDITIONS (same logic as narrative)
  // ------------------------------------------------------------

  let moisture = "dry";
  if (dewPoint != null) {
    if (dewPoint >= 65) moisture = "humid";
    else if (dewPoint >= 55) moisture = "slightly_humid";
    else if (dewPoint >= 45) moisture = "comfortable";
  }

  let tempBand = "mild";
  if (temp >= 88) tempBand = "hot";
  else if (temp >= 75) tempBand = "warm";
  else if (temp <= 55) tempBand = "cool";

  const isWindy = maxGust >= 30 || avgWind >= 15;
  const isBreezy =
    !isWindy &&
    (avgWind >= 12 || (avgWind >= 8 && wind.breezyHours >= 4));

  // ------------------------------------------------------------
  // ICON LOGIC (ordered by impact)
  // ------------------------------------------------------------

  // 🌬️ Wind dominates
  if (isWindy) return "🌬️";
  if (isBreezy) return "🌤️"; // light movement, still pleasant

  // 💧 Humidity dominates
  if (moisture === "humid") return "💧";

  // 🌡️ Temperature extremes
  if (tempBand === "hot") return "☀️";
  if (tempBand === "cool") return "🌤️";

  // 🌤️ Default comfort-driven
  if (score >= 85) return "☀️";
  if (score >= 70) return "🌤️";

  return "🌥️";
}
}