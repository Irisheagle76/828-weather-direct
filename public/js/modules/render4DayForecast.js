// ============================================================
// 4-DAY FORECAST (WITH EDITORIAL OVERRIDES)
// ============================================================

import { getWeatherForUI } from '/js/adapters/weather-adapter.js';
import { calculateComfort } from '/js/intel/comfort.js';
import { assemble } from '/js/intel/synthesizer/assemble.js';

// ============================================================
// OVERRIDES (NEW)
// ============================================================

let forecastOverrides = {};

async function loadForecastOverrides() {
  try {
    const res = await fetch('/data/forecast-overrides.json');
    forecastOverrides = await res.json();
  } catch {
    forecastOverrides = {};
  }
}

// safer date key (avoids timezone bugs)
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

    await loadForecastOverrides(); // 🔥 NEW

    const hourly = data?.hourly || [];

    const days = buildDays(hourly);
    const enriched = days.map((d, i) => buildDay(d, i));

    container.innerHTML = `
      ${renderSummary(enriched)}
      ${enriched.map(renderDay).join("")}
    `;

    bindExpand();

  } catch (err) {
    console.error("Forecast error:", err);
  }
}

// ============================================================
// BUILD DAYS
// ============================================================

function buildDays(hourly) {
  const now = new Date();

  const start = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );

  const buckets = {};

  // 🔥 STEP 1: group ALL hours by local date
  hourly.forEach(h => {
    const t = new Date(h.timestamp);

    const key = new Date(
      t.getFullYear(),
      t.getMonth(),
      t.getDate()
    ).toISOString();

    if (!buckets[key]) buckets[key] = [];
    buckets[key].push(h);
  });

  // 🔥 STEP 2: pull next 4 days cleanly
  const days = [];

  for (let i = 1; i <= 4; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);

    const key = new Date(
      d.getFullYear(),
      d.getMonth(),
      d.getDate()
    ).toISOString();

    days.push({
      date: d,
      hours: buckets[key] || []
    });
  }

  return days;
}

// ============================================================
// BUILD DAY (OVERRIDE APPLIED HERE)
// ============================================================

function buildDay(day, index) {
  const hours = day.hours;

  const temps = hours.map(h => h.temperatureF);
  const high = temps.length ? Math.max(...temps) : "--";
  const low = temps.length ? Math.min(...temps) : "--";

  const fs = computeFS(hours);
  const rain = analyzeRain(hours);

  const anchor =
    hours.find(h => {
      const hr = new Date(h.timestamp).getHours();
      return hr >= 11 && hr <= 15;
    }) || hours[Math.floor(hours.length / 2)];

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

  if (intel) {
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
  // APPLY OVERRIDE (🔥 CORE FEATURE)
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
// RAIN ANALYSIS
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
    const hr = new Date(h.timestamp).getHours();
    const p = h.precipProbability ?? 0;
    const amt = h.precipAmount ?? 0;

    const hasRealRain = amt > 0.01 || p >= 0.45;
    if (!hasRealRain) return;

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
// RENDER (UPDATED FOR OVERRIDES)
// ============================================================

function renderDay(d) {

  const displayHours = (d.hours || [])
    .sort((a, b) => a.timestamp - b.timestamp)
    .filter(h => {
      const hr = new Date(h.timestamp).getHours();
      return hr >= 7 && hr < 19;
    });

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

      ${d.takeaway ? `
        <div class="row-bottom">
          ${
typeof d.takeaway === "string"
  ? `<div class="takeaway">${d.takeaway}</div>`
  : `
      ${d.takeaway.base ? `<div class="takeaway">${d.takeaway.base}</div>` : ""}
      <div class="override-note ${d.takeaway.extra.type}">
        ${d.takeaway.extra.text}
      </div>
    `
          }
        </div>
      ` : ""}

      <div class="expand-content">
        <div class="hourly-strip">
          ${displayHours.map(renderHour).join("")}
        </div>
      </div>

    </div>
  `;
}

// ============================================================
// HOURLY
// ============================================================

function renderHour(h) {
  const hr = new Date(h.timestamp).getHours();
  const level = getPrecipLevel(h);

  return `
    <div class="hour">
      <div class="hour-time">${formatHour(hr)}</div>
      <div class="hour-temp">${Math.round(h.temperatureF)}°</div>
      <div class="precip-bar">
        <div class="precip-fill level-${level}"></div>
      </div>
    </div>
  `;
}

function getPrecipLevel(h) {
  const prob = h.precipProbability ?? 0;
  const amt = h.precipAmount ?? 0;

  // --------------------------------------------------
  // 1. HARD FILTER (kill noise completely)
  // --------------------------------------------------
  if (amt < 0.005 && prob < 0.50) return 0;

  // --------------------------------------------------
  // 2. REQUIRE REAL SIGNAL
  // (amount OR strong probability)
  // --------------------------------------------------
  const hasSignal =
    amt >= 0.01 || prob >= 0.60;

  if (!hasSignal) return 0;

  // --------------------------------------------------
  // 3. INTENSITY SCALING
  // --------------------------------------------------
  if (amt >= 0.15 || prob >= 0.85) return 5;
  if (amt >= 0.08 || prob >= 0.70) return 4;
  if (amt >= 0.04 || prob >= 0.60) return 3;
  if (amt >= 0.02 || prob >= 0.55) return 2;

  return 1;
}

// ============================================================
// HELPERS
// ============================================================

function mapFS(fs) {
  if (fs >= 90) return "Ideal";
  if (fs >= 75) return "Excellent";
  if (fs >= 60) return "Comfortable";
  if (fs >= 45) return "Unsettled";
  return "Harsh";
}

// ============================================================
// DAY LABEL (FIXED — NO HARDCODING)
// ============================================================

function formatDay(date, index) {
  if (index === 0) return "TOMORROW";

  return date
    .toLocaleDateString([], { weekday: "long" })
    .toUpperCase();
}

// ============================================================
// TIME
// ============================================================

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

// ============================================================
// SUMMARY
// ============================================================

function renderSummary(days) {
  if (!days.length) return "";

  const best = days.reduce((a, b) =>
    b.fs > a.fs ? b : a
  );

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