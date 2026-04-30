// ============================================================
// 4-DAY FORECAST (SYSTEM-INTEGRATED REBUILD)
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
    const daily = data?.daily || [];

    console.log("==== RAW DAILY ====", daily);
    console.log("==== RAW HOURLY COUNT ====", hourly.length);

    const days = buildDays(hourly, daily);
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

    const hours = byDay[key] || [];

    console.log("DAY BUILD:", d.toDateString(), {
      hours: hours.length,
      samplePrecip: hours.slice(6,12).map(h => ({
        hr: new Date(h.timestamp).getHours(),
        p: h.precipitation,
        prob: h.precipProbability
      })),
      hasDaily: !!dailyMatch
    });

    days.push({
      date: d,
      hours,
      daily: dailyMatch || null
    });
  }

  return days;
}

// ============================================================
// BUILD DAY (SYSTEM-ALIGNED)
// ============================================================

function buildDay(day, index) {
  const hours = day.hours;

  const temps = hours.map(h => h.temperatureF);
  const high = temps.length ? Math.round(Math.max(...temps)) : "--";
  const low = temps.length ? Math.round(Math.min(...temps)) : "--";

  const fs = computeFS(hours);

  // --------------------------------------------------
  // BUILD INTEL OBJECT FOR NARRATIVE ENGINE
  // --------------------------------------------------

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
        precipProbability: anchor.precipProbability,
        precipAmount: anchor.precipitation,
        score: fs,
        dominantFactor: detectDominant(hours)
      }
    : null;

  // --------------------------------------------------
  // 🔥 USE YOUR REAL ASSEMBLER (NOT GENERATE NARRATIVE)
  // --------------------------------------------------

  let narrative = null;

  if (intel) {
    const category = classifyCategory(intel);
    const gold = category === "veryComfortable";

    narrative = assemble.assemble(
      intel,
      index === 0 ? "tomorrow" : "future",
      category,
      gold
    );
  }

  return {
    date: day.date,
    hours,
    high,
    low,
    fs,
    icon: narrative?.emoji || pickIcon(hours),
    takeaway: narrative?.narrative || "",
    timing: narrative?.temporal || ""
  };
}

// ============================================================
// DOMINANT FACTOR DETECTION (CRITICAL FIX)
// ============================================================

function detectDominant(hours) {
  const rain = hours.reduce((s,h)=>s+(h.precipitation||0),0);
  const maxProb = Math.max(...hours.map(h=>h.precipProbability||0));

  if (rain > 0.2 || maxProb > 0.5) return "rain";

  const wind = Math.max(...hours.map(h=>h.windSpeed||0));
  if (wind > 20) return "wind";

  const temp = hours[Math.floor(hours.length/2)]?.temperatureF || 70;

  if (temp > 85) return "heat";
  if (temp < 40) return "cold";

  return "sun";
}

// ============================================================
// CATEGORY (MATCHES YOUR SYSTEM)
// ============================================================

function classifyCategory(intel) {
  if (intel.score >= 90) return "veryComfortable";
  if (intel.score >= 75) return "comfortable";
  if (intel.score >= 60) return "slightlyUncomfortable";
  if (intel.score >= 45) return "uncomfortable";
  return "harsh";
}

// ============================================================
// ICON (NOW ALIGNED)
// ============================================================

function pickIcon(hours) {
  if (!hours.length) return "☁️";

  const rain = hours.reduce((s,h)=>s+(h.precipitation||0),0);
  const prob = Math.max(...hours.map(h=>h.precipProbability||0));

  if (rain > 0.2) return "🌧️";
  if (prob > 0.4) return "🌦️";

  const cloud =
    hours.reduce((s,h)=>s+(h.cloudCover||0),0)/hours.length;

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
          <div class="timing">${d.timing}</div>
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
// HOURLY (FIXED)
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
  const amt = h.precipitation ?? h.rain ?? 0;

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