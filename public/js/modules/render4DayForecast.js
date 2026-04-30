// ============================================================
// 4-DAY FORECAST MODULE (HYBRID + EXPANDABLE)
// ============================================================

import { getWeatherForUI } from '/js/adapters/weather-adapter.js';
import { calculateComfort } from '/js/intel/comfort.js';
import { generateNarrative } from '/js/intel/synthesizer/index.js';

// ============================================================
// MAIN ENTRY
// ============================================================

export async function render4DayForecast(container) {
  if (!container) return;

  try {
    const data = await getWeatherForUI({
      lat: 35.5951,
      lon: -82.5515,
      includeDaily: true
    });

    const hourly = Array.isArray(data?.hourly) ? data.hourly : [];
    const daily = Array.isArray(data?.daily) ? data.daily : [];

    const days = buildCleanDays(hourly, daily);
    const enriched = days.map(buildDay);

    container.innerHTML = `
      <div class="page-container forecast-page">
        ${renderHeader()}
        ${renderSummary(enriched)}
        ${enriched.map(renderDayCard).join("")}
      </div>
    `;

    bindExpand();

  } catch (err) {
    console.error("4-day forecast error:", err);
    container.innerHTML = "";
  }
}

// ============================================================
// BUILD DAYS (HYBRID)
// ============================================================

function buildCleanDays(hourly, daily) {
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

    days.push({
      dayStart: key,
      hours: byDay[key] || [],
      daily: dailyMatch || null
    });
  }

  return days;
}

// ============================================================
// BUILD DAY
// ============================================================

function buildDay(day) {
  const hours = day.hours;

  let high, low;

  if (hours.length) {
    const temps = hours.map(h => h.temperatureF);
    high = Math.round(Math.max(...temps));
    low = Math.round(Math.min(...temps));
  } else if (day.daily) {
    high = Math.round(day.daily.tempMax);
    low = Math.round(day.daily.tempMin);
  } else {
    high = "--";
    low = "--";
  }

  let fs;
  if (hours.length) {
    fs = computeDailyFS(hours);
  } else if (day.daily) {
    fs = Math.round((day.daily.tempMax + day.daily.tempMin) / 2);
  } else {
    fs = 50;
  }

  const narrative = generateNarrative({
    current: hours[0] || null,
    hourly: hours,
    span: "day"
  });

  return {
    date: new Date(day.dayStart),
    hours,
    daily: day.daily,
    high,
    low,
    fs,
    icon: hours.length ? pickIcon(hours) : pickDailyIcon(day.daily),
    takeaway: narrative?.narrative || "Comfortable conditions",
    timing: narrative?.trend || ""
  };
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
  const best = days.reduce((a, b) => b.fs > a.fs ? b : a, days[0]);

  return `
    <div class="card forecast-summary">
      <div class="summary-line">
        Best conditions: ${formatDay(best.date)}
      </div>
    </div>
  `;
}

function renderDayCard(d) {
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
          <span class="fs-label">${mapFSLabel(d.fs)}</span>
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
        ${renderExpanded(d)}
      </div>

    </div>
  `;
}

// ============================================================
// EXPANDED CONTENT
// ============================================================

function renderExpanded(d) {
  if (d.hours.length) {
    return `
      <div class="expanded-inner">
        ${d.hours.slice(4,16).map(renderHour).join("")}
      </div>
    `;
  }

  if (d.daily) {
    return `
      <div class="expanded-inner">
        ${renderPart("Morning", d.daily.tempMin + 5)}
        ${renderPart("Afternoon", d.daily.tempMax)}
        ${renderPart("Evening", d.daily.tempMin + 2)}
      </div>
    `;
  }

  return "";
}

function renderHour(h) {
  const hour = new Date(h.timestamp).getHours();
  const p = h.precipProbability || 0;
  const level = getPrecipLevel(p);

  return `
    <div class="hour">
      <div class="hour-time">${formatHour(hour)}</div>
      <div class="hour-temp">${Math.round(h.temperatureF)}°</div>
      <div class="precip-bar">
        <div class="precip-fill level-${level}"></div>
      </div>
    </div>
  `;
}

function renderPart(label, temp) {
  return `
    <div class="expanded-row">
      <div>${label}</div>
      <div>${Math.round(temp)}°</div>
    </div>
  `;
}

// ============================================================
// HELPERS
// ============================================================

function computeDailyFS(hours) {
  if (!hours.length) return 50;

  const scores = hours.map(h =>
    (calculateComfort(h)?.score ?? 5) * 10
  );

  return Math.round(scores.reduce((a,b)=>a+b,0)/scores.length);
}

function pickIcon(hours) {
  const peak = Math.max(...hours.map(h => h.precipProbability || 0));
  if (peak > 0.7) return "🌧️";
  if (peak > 0.4) return "🌦️";

  const cloud = hours.reduce((s,h)=>s+(h.cloudCover||0),0)/hours.length;
  if (cloud > 0.6) return "⛅";

  return "☀️";
}

function pickDailyIcon(d) {
  if (!d) return "☁️";

  if ((d.precipProbability || 0) > 0.6) return "🌧️";
  if ((d.precipProbability || 0) > 0.3) return "🌦️";
  if ((d.cloudCover || 0) > 0.6) return "⛅";

  return "☀️";
}

function getPrecipLevel(p) {
  if (p > 0.7) return 5;
  if (p > 0.5) return 4;
  if (p > 0.3) return 3;
  if (p > 0.15) return 2;
  if (p > 0.05) return 1;
  return 0;
}

function mapFSLabel(fs) {
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
// EXPAND BEHAVIOR
// ============================================================

function bindExpand() {
  const cards = document.querySelectorAll('.forecast-row.expandable');

  cards.forEach(card => {
    card.addEventListener('click', () => {
      const isOpen = card.classList.contains('open');

      cards.forEach(c => c.classList.remove('open'));

      if (!isOpen) card.classList.add('open');
    });
  });
}