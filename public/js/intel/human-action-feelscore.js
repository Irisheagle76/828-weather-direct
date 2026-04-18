// ============================================================
// HUMAN ACTION — FEELSCORE (NARRATIVE + CHANGE-AWARE)
// ============================================================

import { calculateComfort } from "./comfort.js";
import { assembleWithVoice } from "./synthesizer/assembleWithVoice.js";

// ============================================================
// MAIN
// ============================================================

export function buildHumanActionIntelFS(raw) {
  const hourly = Array.isArray(raw?.hourly) ? raw.hourly : [];
  if (!hourly.length) return fallbackAll();

  const now = Date.now();

  const todayHours = hourly.filter(h => h.ts >= now && h.ts < now + 24 * 3600e3);
  const tomorrowHours = hourly.filter(h => h.ts >= now + 24 * 3600e3 && h.ts < now + 48 * 3600e3);

  const todaySnapshot = buildSnapshot(todayHours);
  const tomorrowSnapshot = buildSnapshot(tomorrowHours);

  const tempDrop =
    typeof todaySnapshot.temp === "number" &&
    typeof tomorrowSnapshot.temp === "number"
      ? todaySnapshot.temp - tomorrowSnapshot.temp
      : 0;

  const windJump =
    (tomorrowSnapshot.wind || 0) - (todaySnapshot.wind || 0);

  return {
    feelscore: buildCurrentWithTrend(todayHours),
    tomorrow: buildPeriod(tomorrowHours, "tomorrow", {
      tempDrop,
      windJump
    })
  };
}

// ============================================================
// PERIOD (TOMORROW — NOW CHANGE-AWARE)
// ============================================================

function buildPeriod(hours, label, change = {}) {
  if (!Array.isArray(hours) || !hours.length) return fallback(label);

  const mapped = mapComfort(hours);

  const scores = mapped.map(h => h.score).filter(s => typeof s === "number");
  if (!scores.length) return fallback(label);

  const avg = average(scores);
  const trend = scores.at(-1) - scores[0];
  const score = Math.round(avg);

  const snapshot = buildSnapshot(hours);
  const windChill = calcWindChill(snapshot.temp, snapshot.wind);
const chillDelta = snapshot.temp - windChill;
  if (typeof snapshot.temp !== "number") return fallback(label);

  const { tempDrop = 0, windJump = 0 } = change;
  const isShockDay =
  label === "tomorrow" &&
  tempDrop >= 20 &&
  snapshot.temp <= 65;

  const intel = buildIntel(snapshot, score, trend, 0, 0, label);

  let narrative;
  try {
    narrative = assembleWithVoice(
      intel,
      label,
      mapScoreToCategory(score),
      score >= 85
    );
  } catch {
    return fallback(label);
  }

  const narrativeText =
    narrative?.longNarrative ||
    narrative?.headline ||
    "";

// ------------------------------------------------------------
// 🔥 CHANGE-DRIVEN HEADLINE + BULLETS (UPGRADED)
// ------------------------------------------------------------

let headline;

// ------------------------------------------------------------
// PRIORITY: SHOCK > COOL DOWN > BASE
// ------------------------------------------------------------
if (label === "tomorrow") {

  if (tempDrop >= 30) {
    headline = "A big temperature swing hits tomorrow";
  } 
  else if (tempDrop >= 20) {
    headline = "A much cooler, windier day moves in";
  } 
  else if (tempDrop >= 12) {
    headline = "Noticeably cooler air settles in";
  } 
  else {
    headline =
      extractHeadline(narrativeText) ||
      narrative?.headline ||
      buildHeadline(score, snapshot);
  }

} else {
  headline =
    extractHeadline(narrativeText) ||
    narrative?.headline ||
    buildHeadline(score, snapshot);
}


// ------------------------------------------------------------
// BASE BULLETS FROM NARRATIVE
// ------------------------------------------------------------
let bullets = extractBullets(narrativeText, {
  trend,
  snapshot,
  label
});


// ------------------------------------------------------------
// 🔥 CHANGE LAYER (ORDERED BY IMPORTANCE)
// ------------------------------------------------------------
if (label === "tomorrow") {

  const enhanced = [];

  // 1. BIG STORY FIRST (temperature shock)
  if (tempDrop >= 20) {
    enhanced.push("Much colder than today — a noticeable drop");
  }

  // 2. WIND IMPACT (more human wording)
  if (windJump >= 8) {
    enhanced.push("Breezy to gusty winds at times");
  }

  // 3. WIND CHILL / FEELS-LIKE
  if (snapshot.temp <= 50 && snapshot.wind >= 10) {
    enhanced.push("Feels colder than the temperature suggests");
  }

  // 4. HUMAN BEHAVIOR (this is what you were missing)
  if (tempDrop >= 25) {
    enhanced.push("You’ll likely want a jacket after today's warmth");
  } 
  else if (tempDrop >= 15) {
    enhanced.push("A hoodie or light jacket will feel good");
  }

  // ------------------------------------------------------------
  // MERGE (CHANGE FIRST, THEN NARRATIVE)
  // ------------------------------------------------------------
  bullets = [...enhanced, ...(bullets || [])];
}


// ------------------------------------------------------------
// CLEAN + LIMIT
// ------------------------------------------------------------
bullets = [...new Set(bullets)].slice(0, 3);


// ------------------------------------------------------------
// RETURN
// ------------------------------------------------------------
return {
  label,
  score,
  emoji: pickEmoji(score),
  headline,
  bullets
};

// ============================================================
// FEELSCORE (UNCHANGED CORE — CLEANED)
// ============================================================

function buildCurrentWithTrend(hours) {
  if (!Array.isArray(hours) || !hours.length) return fallback("today");

  const mapped = mapComfort(hours);

  const scores = mapped.map(h => h.score).filter(s => typeof s === "number");
  if (!scores.length) return fallback("today");

  const avg = average(scores);
  const trend = scores.at(-1) - scores[0];
  const score = Math.round(avg);

  const snapshot = buildSnapshot(hours);
  if (typeof snapshot.temp !== "number") return fallback("today");

  const intel = buildIntel(snapshot, score, trend, 0, 0, "today");

  let narrative;
  try {
    narrative = assembleWithVoice(
      intel,
      "today",
      mapScoreToCategory(score),
      score >= 85
    );
  } catch {
    return fallback("today");
  }

  const narrativeText =
    narrative?.longNarrative ||
    narrative?.headline ||
    "";

  const headline =
    extractHeadline(narrativeText) ||
    narrative?.headline ||
    "";

  const subHeadline =
    trend > 5
      ? "Improving through the afternoon"
      : trend < -5
      ? "Slightly less comfortable later"
      : "";

  let bullets = extractBullets(narrativeText, {
    trend,
    snapshot,
    label: "today"
  });

  if (bullets.length < 2) {
    if (snapshot.dewPoint < 55) {
      bullets.push("Dry air keeps things comfortable");
    }
  }

  bullets = [...new Set(bullets)].slice(0, 3);

  return {
    label: "today",
    score,
    emoji: pickEmoji(score),
    headline,
    subHeadline,
    bullets
  };
}
}
// ============================================================
// HELPERS (UNCHANGED CORE)
// ============================================================

function mapComfort(hours) {
  return hours.map(h => {
    const c = calculateComfort(h);
    return {
      hour: new Date(h.ts).getHours(),
      score: Math.round((c?.score || 0) * 10)
    };
  });
}

function buildSnapshot(hours) {
  const avg = (keys) => {
    const vals = hours
      .map(h => keys.find(k => typeof h[k] === "number") ? h[keys.find(k => typeof h[k] === "number")] : null)
      .filter(v => v != null);

    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  };

  return {
    temp: avg(["temp", "temperature", "temperatureF"]),
    dewPoint: avg(["dewPoint", "dewpoint", "dewpointF"]),
    wind: avg(["wind", "windSpeed", "windspeed", "wind_speed"]) ?? 0
  };
}

function extractHeadline(text = "") {
  return text.split(".")[0]?.trim() || "";
}

function extractBullets(text = "", { trend, snapshot, label }) {
  const bullets = [];
  const t = text.toLowerCase();

  if (t.includes("dry")) bullets.push("Dry air keeps things feeling good");
  if (t.includes("wind")) bullets.push("Wind plays a noticeable role");
  if (t.includes("cool") && label === "tomorrow") bullets.push("Cooler air settles in");

  if (trend > 5) bullets.push("Improves through the day");
  if (trend < -5) bullets.push("Slight drop in comfort later");

  return bullets;
}

function average(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
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

function buildIntel(snapshot, score, trend, min, max, label) {
  return {
    signals: {
      temp: snapshot.temp,
      dewPoint: snapshot.dewPoint ?? null,
      wind: snapshot.wind ?? 0
    },
    pattern: { trend, min, max, avg: score },
    context: { label, timeWindow: "afternoon" },
    dominantFactor: detectDominantFactor(snapshot)
  };
}

function detectDominantFactor(s = {}) {
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