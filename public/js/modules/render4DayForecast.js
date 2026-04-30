// ============================================================
// 4-DAY FORECAST (CLEAN + TRUSTED SIGNAL)
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

    console.log("==== HOURLY COUNT ====", hourly.length);

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

    console.log("DAY:", d.toDateString(), {
      hours: hours.length,
      rainHours: hours.filter(h => getProb(h) > 0.2).length
    });

    days.push({ date: d, hours });
  }

  return days;
}

// ============================================================
// BUILD DAY
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
        dominantFactor: rain.isRain ? "rain" : "sun"
      }
    : null;

  let narrative = null;

  if (intel) {
    const category = classifyCategory(intel);

    narrative = assemble.assemble(
      intel,
      index === 0 ? "tomorrow" : "future",
      category,
      category === "veryComfortable"
    );
  }

  return {
    date: day.date,
    hours,
    high,
    low,
    fs,
    icon: pickIcon(hours, rain),
    takeaway: narrative?.narrative || ""
  };
}

// ============================================================
// RAIN ANALYSIS (REAL FIX)
// ============================================================

function analyzeRain(hours) {
  if (!hours.length) return { isRain: false, peak: 0, coverage: 0 };

  const meaningful = hours.filter(h => getProb(h) >= 0.15);

  const coverage = meaningful.length / hours.length;

  const peak = Math.max(...hours.map(h => getProb(h)));

  return {
    isRain: coverage > 0.2,
    peak,
    coverage
  };
}

// ============================================================
// ICON (FIXED)
// ============================================================

function pickIcon(hours, rain) {
  if (rain.isRain) {
    if (rain.coverage > 0.5) return "🌧️";
    return "🌦️";
  }

  const cloud =
    hours.reduce((s,h)=>s+(h.cloudCover||0),0)/hours.length;

  if (cloud > 0.65) return "☁️";
  if (cloud > 0.35) return "⛅";

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
// PRECIP LEVEL (FIXED)
// ============================================================

function getPrecipLevel(h) {
  const prob = getProb(h);

  if (prob >= 0.6) return 5;
  if (prob >= 0.4) return 4;
  if (prob >= 0.25) return 3;
  if (prob >= 0.15) return 2;
  if (prob >= 0.05) return 1;

  return 0;
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