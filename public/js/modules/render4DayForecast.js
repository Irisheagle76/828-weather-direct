// ============================================================
// 4-DAY FORECAST (TIME-AWARE + TRUSTED SIGNAL — FIXED)
// ============================================================

import { getWeatherForUI } from '/js/adapters/weather-adapter.js';
import { calculateComfort } from '/js/intel/comfort.js';
import { assemble } from '/js/intel/synthesizer/assemble.js';

// ============================================================
// MAIN
// ============================================================

export async function render4DayForecast(container) {
  if (!container) return;

  try {
    const data = await getWeatherForUI({
      lat: 35.5951,
      lon: -82.5515,
      includeDaily: true
    });

    const hourly = data?.hourly || [];

    const days = buildDays(hourly);
    const enriched = days.map((d, i) => buildDay(d, i));

    container.innerHTML = `
      <div class="page-container forecast-page">
        ${renderHeader()}
        ${renderSummary(enriched)}
        ${enriched.map(renderDay).join("")}
      </div>
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
  const byDay = {};

  hourly.forEach(h => {
    const d = new Date(h.timestamp);
    const key = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    if (!byDay[key]) byDay[key] = [];
    byDay[key].push(h);
  });

  const today = new Date();
  today.setHours(0,0,0,0);

  const days = [];

  for (let i = 1; i <= 4; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);

    const key = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const hours = byDay[key] || [];

    days.push({ date: d, hours });
  }

  return days;
}

// ============================================================
// BUILD DAY (TIME CONTEXT + HONEST PRECIP)
// ============================================================

function buildDay(day, index) {
  const hours = day.hours;

  const temps = hours.map(h => h.temperatureF);
  const high = temps.length ? Math.round(Math.max(...temps)) : "--";
  const low = temps.length ? Math.round(Math.min(...temps)) : "--";

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
        precipProbability: rain.peak,
        score: fs,
        dominantFactor: rain.type !== "none" ? "rain" : "sun"
      }
    : null;

  let narrative = null;

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

  return {
    date: day.date,
    hours,
    high,
    low,
    fs,
    icon: pickIcon(hours, rain),
    takeaway: narrative
  };
}

// ============================================================
// RAIN ANALYSIS (FIXED — NO FALSE POSITIVES)
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
    const p = getProb(h);

    // Require meaningful probability
   const hasRealRain =
  (h.precipAmount ?? 0) > 0.01 || p >= 0.45;

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

  if (coverage < 0.25) {
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
// ICON SELECTION (FIXED — HONEST CLOUD + RAIN)
// ============================================================

function pickIcon(hours, rain) {
if (rain.peak >= 0.7 && rain.coverage > 0.2) return "🌧️";
if (rain.coverage > 0.30) return "🌦️";

  const cloud =
    hours.reduce((s,h)=>s+(h.cloudCover||0),0)/hours.length;

  if (cloud > 0.75) return "☁️";
  if (cloud > 0.45) return "⛅";

  return "☀️";
}

// ============================================================
// PROB NORMALIZATION
// ============================================================

function getProb(h) {
  const p = h.precipProbability ?? 0;
  return p > 1 ? p / 100 : p;
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
  return `
    <div class="card forecast-row expandable">

      <div class="row-top">
        <div class="day">${formatDay(d.date)}</div>
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
          <div class="takeaway">${d.takeaway}</div>
        </div>
      ` : ""}

      <div class="expand-content">
        <div class="hourly-strip">
          ${d.hours.slice(6,18).map(renderHour).join("")}
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

// ============================================================
// PRECIP LEVEL (FIXED — NO FALSE BARS)
// ============================================================

function getPrecipLevel(h) {
  const prob = getProb(h);
  const amt = h.precipAmount ?? 0;

  // require real signal
  if (amt < 0.005 && prob < 0.30) return 0;

  if (prob >= 0.80 || amt > 0.15) return 5;
  if (prob >= 0.65 || amt > 0.08) return 4;
  if (prob >= 0.50 || amt > 0.04) return 3;
  if (prob >= 0.40 || amt > 0.02) return 2;

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

function formatDay(date) {
  const tomorrow = new Date();
  tomorrow.setDate(new Date().getDate() + 1);

  if (date.toDateString() === tomorrow.toDateString()) {
    return "TOMORROW";
  }

  return date.toLocaleDateString([], { weekday: "long" }).toUpperCase();
}

function formatHour(h) {
  if (h === 0) return "12a";
  if (h < 12) return `${h}a`;
  if (h === 12) return "12p";
  return `${h - 12}p`;
}

// ============================================================
// HEADER + SUMMARY
// ============================================================

function renderHeader() {
  return `
    <div class="section-header">
      <h1>4-Day Forecast</h1>
      <p class="subtitle">Quick look ahead</p>
    </div>
  `;
}

function renderSummary(days) {
  const best = days.reduce((a, b) => b.fs > a.fs ? b : a);

  return `
    <div class="card forecast-summary">
      Best conditions: ${formatDay(best.date)}
    </div>
  `;
}

// ============================================================
// CATEGORY
// ============================================================

function classifyCategory(intel) {
  const s = intel?.score ?? 50;

  if (s >= 90) return "veryComfortable";
  if (s >= 75) return "comfortable";
  if (s >= 60) return "slightlyUncomfortable";
  if (s >= 45) return "uncomfortable";
  return "harsh";
}

// ============================================================
// EXPAND
// ============================================================

function bindExpand() {
  const cards = document.querySelectorAll('.forecast-row');

  cards.forEach(card => {
    card.addEventListener('click', () => {
      const open = card.classList.contains('open');
      cards.forEach(c => c.classList.remove('open'));
      if (!open) card.classList.add('open');
    });
  });
}
