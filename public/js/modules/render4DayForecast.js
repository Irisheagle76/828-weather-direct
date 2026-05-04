// ============================================================
// 4-DAY FORECAST (STABLE TIME + OVERRIDES)
// ============================================================

import { getWeatherForUI } from '/js/adapters/weather-adapter.js';
import { calculateComfort } from '/js/intel/comfort.js';
import { assemble } from '/js/intel/synthesizer/assemble.js';
import { analyzePattern, mapToInputs } from '../modules/analyzePattern.js';

// ============================================================
// OVERRIDE
// ============================================================

let forecastOverrides = {};

async function loadForecastOverrides() {
  try {
    const res = await fetch('/forecast-overrides.json');
    forecastOverrides = await res.json();
  } catch {
    forecastOverrides = {};
  }
}

function getDateKey(date) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  ).toISOString().split('T')[0];
}

// ============================================================
// MAIN
// ============================================================

export async function render4DayForecast(container) {
  if (!container) return;

  try {
    const data = await getWeatherForUI({
      lat: 35.5951,
      lon: -82.5515
    });

    await loadForecastOverrides();

    // 🔥 Normalize ONCE (single source of truth)
    const hourly = (data?.hourly || []).map(h => {
      const d = new Date(h.timestamp);

      return {
        ...h,
        localDate: d,
        localHour: d.getHours(),
        dayKey: d.toISOString().split('T')[0]
      };
    });

    // ==================================================
    // 🔥 ADD THIS BLOCK RIGHT HERE
    // ==================================================

    const inputs = mapToInputs({
      ...data,
      hourly // pass normalized hourly if needed later
    });

    const pattern = analyzePattern(inputs);

    console.log("PATTERN:", pattern);
    const timeline = buildTimeline(hourly);
console.log("TIMELINE:", timeline);

// ==================================================
// 🔥 BUILD FORECAST OBJECT (SAFE ADD)
// ==================================================

const forecast = {
  conditions: {
    dominantType: pattern.dayType,
    confidence: pattern.confidence?.overall,
    variability: pattern.tension?.length ? "changing" : "steady"
  },

  drivers: {
    tempTrend: pattern.temperature?.trend,
    dewPoint: data?.hourly?.dewpoint?.[12],
    wind: pattern.windProfile?.speed,
    skyCover: pattern.skyBehavior?.coverage,
    instability: pattern.convection?.intensity,
    moistureDepth: pattern.moistureProfile?.depth
  },

  hazards: pattern.hazards,
  localEffects: pattern.localEffects,

human: buildHumanForecast(pattern)
};

console.log("FORECAST:", forecast);

    // ==================================================
    // 🔥 Continue with older code
    // ==================================================
    const days = buildDays(hourly);
   const enriched = days.map((d, i) => buildDay(d, i, forecast));

container.innerHTML = `
  <div style="padding:12px;font-size:18px;font-weight:600;">
    ${forecast.human.headline}
  </div>

  <div style="padding:8px 12px;font-size:14px;opacity:0.85;">
    <strong>Morning:</strong> ${timeline.morning} |
    <strong>Midday:</strong> ${timeline.midday} |
    <strong>Afternoon:</strong> ${timeline.afternoon} |
    <strong>Evening:</strong> ${timeline.evening}
  </div>

  ${renderSummary(enriched)}
  ${enriched.map(renderDay).join("")}
`;

    bindExpand();

  } catch (err) {
    console.error("Forecast error:", err);
  }
}

// ============================================================
// BUILD DAYS (timezone-safe)
// ============================================================

function buildDays(hourly) {
  const now = new Date();

  const start = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );

  const days = [];

  for (let i = 1; i <= 4; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);

    const key = d.toISOString().split('T')[0];

    const hours = hourly
      .filter(h => h.dayKey === key)
      .sort((a, b) => a.localDate - b.localDate);

    days.push({ date: d, hours });
  }

  return days;
}

// ============================================================
// BUILD DAY
// ============================================================

function buildDay(day, index, forecast) {
  const hours = day.hours;

  const temps = hours.map(h => h.temperatureF);
  const high = temps.length ? Math.max(...temps) : "--";
  const low = temps.length ? Math.min(...temps) : "--";

  const fs = computeFS(hours);
  const rain = analyzeRain(hours);

  // 🔥 anchor uses localHour ONLY
  const anchor =
    hours.find(h => h.localHour >= 11 && h.localHour <= 15) ||
    hours[Math.floor(hours.length / 2)];

  const intel = anchor
    ? {
        temperature: anchor.temperatureF,
        dewpoint: anchor.dewpointF,
        windSpeed: anchor.windSpeed,
        windGust: anchor.windGust,
        cloudCover: anchor.cloudCover,
        precipProbability: rain.type === "none" ? 0 : rain.peak,
        score: fs,
        dominantFactor: rain.type !== "none" ? "rain" : "sun"
      }
    : null;

let narrative = "";

// ==================================================
// 🔥 NEW HUMAN NARRATIVE (PRIMARY)
// ==================================================

if (index === 0 && forecast?.human?.narrative) {
  narrative = forecast.human.narrative;
}

// ==================================================
// 🔁 FALLBACK TO OLD SYSTEM (SAFE)
// ==================================================

if (!narrative && intel) {
  const category = classifyCategory(intel);

  let timeContext = null;

  if (rain.type === "morning") timeContext = "rain early, then clearing";
  else if (rain.type === "midday") timeContext = "periods of rain midday";
  else if (rain.type === "afternoon") timeContext = "dry early, showers later";
  else if (rain.type === "evening") timeContext = "dry through the day, rain late";

  const result = assemble.assemble(
    { ...intel, timeContext },
    index === 0 ? "tomorrow" : "future",
    category,
    category === "veryComfortable"
  );

  narrative = result?.narrative || "";
}

  // ============================================================
  // OVERRIDES
  // ============================================================

  const key = getDateKey(day.date);
  const override = forecastOverrides[key];

  let takeaway = narrative;

  if (override) {
    if (override.type === "override") {
      takeaway = override.text;
    } else {
      takeaway = {
        base: narrative || null,
        extra: override
      };
    }
  }

  return {
    date: day.date,
    hours,
    high: Math.round(high),
    low: Math.round(low),
    fs,
    icon: pickIcon(hours, rain),
    takeaway,
    index
  };
}

// ============================================================
// RAIN ANALYSIS (uses localHour)
// ============================================================

function analyzeRain(hours) {
  if (!hours.length) return { type: "none", coverage: 0, peak: 0 };

  const buckets = {
    morning: [],
    midday: [],
    afternoon: [],
    evening: []
  };

  hours.forEach(h => {
    const hr = h.localHour;
    const p = h.precipProbability ?? 0;
    const amt = h.precipAmount ?? 0;

    const hasRain = amt > 0.01 || p >= 0.45;
    if (!hasRain) return;

    if (hr >= 5 && hr < 10) buckets.morning.push(p);
    else if (hr < 14) buckets.midday.push(p);
    else if (hr < 18) buckets.afternoon.push(p);
    else buckets.evening.push(p);
  });

  const counts = Object.entries(buckets).map(([k,v]) => ({
    key: k,
    count: v.length,
    peak: v.length ? Math.max(...v) : 0
  }));

  const totalRain = counts.reduce((s,c)=>s+c.count,0);
  const coverage = totalRain / hours.length;

  if (coverage < 0.20) {
    return { type: "none", coverage, peak: 0 };
  }

  const dominant = counts.sort((a,b)=>b.count-a.count)[0];

  return {
    type: dominant.key,
    coverage,
    peak: dominant.peak
  };
}

// ============================================================
// ICONS
// ============================================================

function pickIcon(hours, rain) {
  if (rain.coverage > 0.55) return "🌧️";
  if (rain.coverage > 0.30) return "🌦️";

  const cloud =
    hours.reduce((s,h)=>s+(h.cloudCover || 0),0)/hours.length;

  if (cloud > 0.75) return "☁️";
  if (cloud > 0.45) return "⛅";

  return "☀️";
}

// ============================================================
// FEELSCORE
// ============================================================

function computeFS(hours) {
  if (!hours.length) return 50;

  const scores = hours.map(h =>
    (calculateComfort(h)?.score ?? 5) * 10
  );

  return Math.round(scores.reduce((a,b)=>a+b,0)/scores.length);
}

// ============================================================
// RENDER
// ============================================================

function renderDay(d) {

  const displayHours = d.hours
    .filter(h => h.localHour >= 7 && h.localHour < 19);

  return `
    <div class="card forecast-row expandable">

      <div class="row-top">
        <div class="day">${formatDay(d.date, d.index)}</div>
        <div class="icon">${d.icon}</div>
      </div>

      <div class="row-main">
        <div class="temps">
          <span class="high">${d.high}°</span>
          <span class="low">${d.low}°</span>
        </div>

        <div class="feelscore">
          <span class="fs-value">${d.fs}</span>
          <span class="fs-label">${mapFS(d.fs)}</span>
        </div>
      </div>

      <div class="fs-bar">
        <div class="fs-fill" style="width:${d.fs}%"></div>
      </div>

      ${renderTakeaway(d.takeaway)}

      <div class="expand-content">
        <div class="hourly-strip">
          ${displayHours.map(renderHour).join("")}
        </div>
      </div>

    </div>
  `;
}

function renderTakeaway(t) {
  if (!t) return "";

  if (typeof t === "string") {
    return `<div class="row-bottom"><div class="takeaway">${t}</div></div>`;
  }

  return `
    <div class="row-bottom">
      ${t.base ? `<div class="takeaway">${t.base}</div>` : ""}
      <div class="override-note ${t.extra.type}">
        ${t.extra.text}
      </div>
    </div>
  `;
}

// ============================================================
// HOURLY
// ============================================================

function renderHour(h) {
  const level = getPrecipLevel(h);

  return `
    <div class="hour">
      <div class="hour-time">${formatHour(h.localHour)}</div>
      <div class="hour-temp">${Math.round(h.temperatureF)}°</div>
      <div class="precip-bar">
        <div class="precip-fill level-${level}"></div>
      </div>
    </div>
  `;
}

// ============================================================
// HELPERS
// ============================================================

function getPrecipLevel(h) {
  const prob = h.precipProbability ?? 0;
  const amt = h.precipAmount ?? 0;

  if (amt < 0.005 && prob < 0.50) return 0;

  const hasSignal = amt >= 0.01 || prob >= 0.60;
  if (!hasSignal) return 0;

  if (amt >= 0.15 || prob >= 0.85) return 5;
  if (amt >= 0.08 || prob >= 0.70) return 4;
  if (amt >= 0.04 || prob >= 0.60) return 3;
  if (amt >= 0.02 || prob >= 0.55) return 2;

  return 1;
}

function mapFS(fs) {
  if (fs >= 90) return "Ideal";
  if (fs >= 75) return "Excellent";
  if (fs >= 60) return "Comfortable";
  if (fs >= 45) return "Unsettled";
  return "Harsh";
}

function formatDay(date, index) {
  if (index === 0) return "TOMORROW";
  return date.toLocaleDateString([], { weekday: "long" }).toUpperCase();
}

function formatHour(h) {
  if (h === 0) return "12a";
  if (h < 12) return `${h}a`;
  if (h === 12) return "12p";
  return `${h - 12}p`;
}

function classifyCategory(intel) {
  const s = intel?.score ?? 50;

  if (s >= 90) return "veryComfortable";
  if (s >= 75) return "comfortable";
  if (s >= 60) return "slightlyUncomfortable";
  if (s >= 45) return "uncomfortable";
  return "harsh";
}

function renderSummary(days) {
  if (!days.length) return "";

  const best = days.reduce((a, b) => b.fs > a.fs ? b : a);

  return `
    <div class="card forecast-summary">
      <div class="summary-line">
        Best: <strong>${formatDay(best.date, best.index)}</strong>
        <span class="summary-score">${best.fs}</span>
      </div>

      <div class="summary-meta">
        ${best.fs >= 80
          ? "Great outdoor conditions expected"
          : best.fs >= 65
          ? "Comfortable overall"
          : "Some limitations in comfort"}
      </div>
    </div>
  `;
}
  // -----------------------------
  // BUILD HUMAN FORECAST
  // -----------------------------
function buildHumanForecast(pattern) {
  const parts = [];

  // -----------------------------
  // HEADLINE
  // -----------------------------
  let headline = "Quiet and steady conditions";

  if (pattern.dayType === "convective") {
    headline = "Warm with building clouds and afternoon storm risk";
  } else if (pattern.dayType === "nw_flow") {
    headline = "Clouds holding firm with limited breaks";
  } else if (pattern.skyBehavior?.trend === "clearing") {
    headline = "Clouds gradually breaking for more sun";
  }

  // -----------------------------
  // OPENING (sky + evolution)
  // -----------------------------
  if (pattern.skyBehavior?.trend === "increasing clouds") {
    parts.push("Some early sun gives way to increasing cloud cover through the day.");
  } else if (pattern.skyBehavior?.trend === "clearing") {
    parts.push("Cloud cover gradually breaks, allowing more sun as the day goes on.");
  } else {
    parts.push("Conditions remain fairly steady through the day.");
  }

  // -----------------------------
  // CONVECTION (storms)
  // -----------------------------
  if (pattern.convection?.present) {
    const timing =
      pattern.convection.triggerTime <= 14
        ? "early to mid afternoon"
        : "mid to late afternoon";

    const coverage = pattern.convection.coverage;

    parts.push(
      `By ${timing}, ${coverage} showers and storms develop.`
    );

    if (pattern.convection.intensity === "strong") {
      parts.push("A few storms could be on the stronger side.");
    }
  }

  // -----------------------------
  // TENSION (this makes it human)
  // -----------------------------
  if (pattern.tension?.includes("sun vs clouds")) {
    parts.push("There’s a bit of a battle between sun and clouds, especially midday.");
  }

  if (pattern.tension?.includes("instability vs limited moisture")) {
    parts.push("Storm development may be uneven, with some areas staying dry.");
  }

  if (pattern.tension?.includes("clearing vs upslope clouds")) {
    parts.push("Low clouds may be stubborn, especially along the higher terrain.");
  }

  // -----------------------------
  // LOCAL INSIGHT (Asheville edge)
  // -----------------------------
  let localInsight = null;

  if (pattern.localEffects?.terrainInfluence === "upslope clouds") {
    localInsight = "Northwest flow may keep clouds locked in along the ridges.";
  } else if (pattern.localEffects?.valleyFog) {const pattern = analyzePat
    localInsight = "Patchy valley fog is possible early in the day.";
  }

  // -----------------------------
  // CONFIDENCE NOTE
  // -----------------------------
  let confidenceNote = null;

  if (pattern.confidence?.overall < 0.6) {
    confidenceNote = "There’s some uncertainty in how this plays out.";
  } else if (pattern.convection?.present) {
    confidenceNote = "Storm coverage will vary from place to place.";
  }

  // -----------------------------
  // FINAL NARRATIVE
  // -----------------------------
  const narrative = parts.join(" ");

  return {
    headline,
    narrative,
    keyMoments: [],
    confidenceNote,
    localInsight
  };
}
// ============================================================
// Timeline Builder
// ============================================================
function buildTimeline(hourly) {
  const buckets = {
    morning: hourly.filter(h => h.localHour >= 6 && h.localHour < 11),
    midday: hourly.filter(h => h.localHour >= 11 && h.localHour < 14),
    afternoon: hourly.filter(h => h.localHour >= 14 && h.localHour < 18),
    evening: hourly.filter(h => h.localHour >= 18 && h.localHour < 22),
    overnight: hourly.filter(h => h.localHour < 6 || h.localHour >= 22)
  };

  function summarize(hours) {
    if (!hours.length) return "—";

    const avgCloud =
      hours.reduce((s, h) => s + (h.cloudCover || 0), 0) / hours.length;

    const rainHits = hours.filter(h =>
      (h.precipAmount ?? 0) > 0.01 || (h.precipProbability ?? 0) >= 0.45
    ).length;

    const rainRatio = rainHits / hours.length;

    if (rainRatio > 0.4) return "showers likely";
    if (rainRatio > 0.15) return "spotty showers";

    if (avgCloud > 0.7) return "mostly cloudy";
    if (avgCloud > 0.4) return "partly cloudy";

    return "mostly sunny";
  }

  return {
    morning: summarize(buckets.morning),
    midday: summarize(buckets.midday),
    afternoon: summarize(buckets.afternoon),
    evening: summarize(buckets.evening),
    overnight: summarize(buckets.overnight)
  };
}
// ============================================================
// UX
// ============================================================

function bindExpand() {
  const cards = document.querySelectorAll('.forecast-row');

  cards.forEach(card => {
    card.addEventListener('click', () => {
      const isOpen = card.classList.contains('open');
      cards.forEach(c => c.classList.remove('open'));
      if (!isOpen) card.classList.add('open');
    });
  });
}