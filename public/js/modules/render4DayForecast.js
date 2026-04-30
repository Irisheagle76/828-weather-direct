// ============================================================
// 4-DAY FORECAST (CLEAN REBUILD)
// ============================================================

import { getWeatherForUI } from '/js/adapters/weather-adapter.js';
import { calculateComfort } from '/js/intel/comfort.js';
import { generateNarrative } from '/js/intel/synthesizer/index.js';

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
    const daily = data?.daily || [];

    console.log("==== RAW DAILY ====", daily);
    console.log("==== RAW HOURLY COUNT ====", hourly.length);

    const days = buildDays(hourly, daily);
    const enriched = days.map(buildDay);

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
// BUILD DAYS (TOMORROW → +4)
// ============================================================

function buildDays(hourly, daily) {
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

    const dailyMatch = daily.find(dd =>
      new Date(dd.timestamp).toDateString() === d.toDateString()
    );

    console.log("DAY BUILD:", d.toDateString(), {
      hours: (byDay[key] || []).length,
      hasDaily: !!dailyMatch
    });

    days.push({
      date: d,
      hours: byDay[key] || [],
      daily: dailyMatch || null
    });
  }

  return days;
}

// ============================================================
// BUILD DAY (CORE LOGIC)
// ============================================================

function buildDay(day) {
  const hours = day.hours;

  const temps = hours.map(h => h.temperatureF);
  const high = temps.length ? Math.round(Math.max(...temps)) : "--";
  const low = temps.length ? Math.round(Math.min(...temps)) : "--";

  const fs = computeFS(hours);

  const precip = analyzePrecip(hours);

  const anchor =
    hours.find(h => {
      const hr = new Date(h.timestamp).getHours();
      return hr >= 10 && hr <= 15;
    }) || hours[Math.floor(hours.length / 2)];

  const narrative = hours.length
    ? generateNarrative({
        current: anchor,
        hourly: hours,
        span: "day",
        precipTiming: precip
      })
    : null;

  return {
    date: day.date,
    hours,
    high,
    low,
    fs,
    icon: pickIcon(hours, precip),
    takeaway: narrative?.narrative || "Conditions evolving",
    timing: narrative?.trend || ""
  };
}

// ============================================================
// PRECIP ANALYSIS (CRITICAL)
// ============================================================

function analyzePrecip(hours) {
  const rainy = hours.filter(h => (h.precipProbability || 0) > 0.4);

  if (!rainy.length) return null;

  const first = new Date(rainy[0].timestamp).getHours();

  return {
    start: first,
    duration: rainy.length
  };
}

// ============================================================
// ICON LOGIC (FIXED)
// ============================================================

function pickIcon(hours, precip) {
  if (!hours.length) return "☁️";

  if (precip) {
    if (precip.start < 12) return "🌧️"; // morning rain
    return "🌦️"; // later rain
  }

  const cloud =
    hours.reduce((s, h) => s + (h.cloudCover || 0), 0) / hours.length;

  if (cloud > 0.6) return "⛅";
  if (cloud > 0.3) return "🌤️";

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

function renderHeader() {
  return `
    <div class="section-header">
      <h1>4-Day Forecast</h1>
      <p class="subtitle">Quick look ahead</p>
    </div>
  `;
}

function renderSummary(days) {
  const best = days.reduce((a,b)=> b.fs > a.fs ? b : a);

  return `
    <div class="card forecast-summary">
      Best conditions: ${formatDay(best.date)}
    </div>
  `;
}

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

      <div class="row-bottom">
        <div class="takeaway">${d.takeaway}</div>
        <div class="timing">${d.timing}</div>
      </div>

      <div class="expand-content">
        <div class="hourly-strip">
          ${d.hours.slice(6,18).map(renderHour).join("")}
        </div>
      </div>

    </div>
  `;
}

// ============================================================
// HOURLY (HORIZONTAL FIX)
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
// PRECIP LEVEL (AMOUNT-BASED)
// ============================================================

function getPrecipLevel(h) {
  const amt = h.precipitation || 0;

  if (amt > 0.25) return 5;
  if (amt > 0.1) return 4;
  if (amt > 0.05) return 3;
  if (amt > 0.01) return 2;
  if (amt > 0.001) return 1;
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