// ============================================================
// 4-DAY FORECAST MODULE (MATCHES APP ARCHITECTURE)
// ============================================================

import { getWeatherForUI } from '/js/adapters/weather-adapter.js';
import { calculateComfort } from '/js/intel/comfort.js';

// ============================================================
// MAIN EXPORT
// ============================================================

export async function render4DayForecast(container) {
  if (!container) return;

  try {
    const data = await getWeatherForUI({ lat: 35.5951, lon: -82.5515 });

    const hourly = Array.isArray(data?.hourly) ? data.hourly : [];
    if (!hourly.length) {
      container.innerHTML = '';
      return;
    }

    const days = groupByDay(hourly).slice(0, 4);
    const enriched = days.map(buildDay);

    container.innerHTML = `
      <div class="page-container forecast-page">

        <div class="section-header">
          <h1>4-Day Forecast</h1>
          <p class="subtitle">Quick look ahead</p>
        </div>

        ${renderSummary(enriched)}

        ${enriched.map(renderDayCard).join('')}

      </div>
    `;

  } catch (err) {
    console.error('4-day forecast error:', err);
    container.innerHTML = '';
  }
}

// ============================================================
// GROUP BY DAY
// ============================================================

function groupByDay(hourly) {
  const days = {};

  hourly.forEach(h => {
    if (!h?.timestamp) return;

    const key = new Date(h.timestamp).toDateString();

    if (!days[key]) days[key] = [];
    days[key].push(h);
  });

  return Object.values(days);
}

// ============================================================
// BUILD DAY OBJECT
// ============================================================

function buildDay(hours) {
  const temps = hours.map(h => h.temperatureF).filter(Number.isFinite);

  const high = Math.max(...temps);
  const low = Math.min(...temps);

  const mid = hours[Math.floor(hours.length / 2)];

  let fsRaw = calculateComfort(mid)?.score ?? 5;
  let fs = Math.round(fsRaw * 10);
  fs = Math.min(Math.max(fs, 0), 98);

  return {
    date: new Date(hours[0].timestamp),
    high: Math.round(high),
    low: Math.round(low),
    feelscore: fs,
    icon: pickIcon(hours),
    takeaway: generateTakeaway(fs),
    timing: generateTiming(hours)
  };
}

// ============================================================
// ICON LOGIC
// ============================================================

function pickIcon(hours) {
  const rain = hours.some(h => (h.precipProbability ?? 0) > 0.5);
  const clouds = hours.some(h => (h.cloudCover ?? 0) > 0.5);

  if (rain) return "🌧️";
  if (clouds) return "⛅";
  return "☀️";
}

// ============================================================
// FEELSCORE LABEL
// ============================================================

function mapFSLabel(score) {
  if (score >= 90) return "Ideal";
  if (score >= 75) return "Excellent";
  if (score >= 60) return "Comfortable";
  if (score >= 45) return "Unsettled";
  return "Harsh";
}

// ============================================================
// TAKEAWAY + TIMING
// ============================================================

function generateTakeaway(fs) {
  if (fs >= 80) return "Best day to be outside";
  if (fs >= 65) return "Still comfortable";
  if (fs >= 50) return "Some discomfort";
  return "Indoor conditions favored";
}

function generateTiming(hours) {
  const rainHour = hours.find(h => (h.precipProbability ?? 0) > 0.5);

  if (!rainHour) return "Dry all day";

  const hour = new Date(rainHour.timestamp).getHours();

  if (hour < 12) return "Rain early";
  if (hour < 17) return "Rain midday";
  return "Rain late";
}

// ============================================================
// RENDER DAY CARD
// ============================================================

function renderDayCard(d) {
  return `
    <div class="card forecast-row">

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
          <span class="fs-value">${d.feelscore}</span>
          <span class="fs-label">${mapFSLabel(d.feelscore)}</span>
        </div>
      </div>

      <div class="fs-bar">
        <div class="fs-fill" style="width:${d.feelscore}%;"></div>
      </div>

      <div class="row-bottom">
        <div class="takeaway">${d.takeaway}</div>
        <div class="timing">${d.timing}</div>
      </div>

    </div>
  `;
}

// ============================================================
// SUMMARY
// ============================================================

function renderSummary(days) {
  const best = days.reduce((a, b) =>
    b.feelscore > a.feelscore ? b : a
  );

  const worst = days.reduce((a, b) =>
    b.feelscore < a.feelscore ? b : a
  );

  return `
    <div class="card forecast-summary">
      <div class="summary-line">
        ${trendLine(days)}
      </div>
      <div class="summary-meta">
        Best Day: ${formatDay(best.date)} • Turning Point: ${formatDay(worst.date)}
      </div>
    </div>
  `;
}

// ============================================================
// HELPERS
// ============================================================

function formatDay(date) {
  return date.toLocaleDateString([], { weekday: "long" }).toUpperCase();
}

function trendLine(days) {
  if (days[0].feelscore > days[3].feelscore) {
    return "Comfort peaks early → fades later";
  }
  return "Conditions improve through the period";
}