// ============================================================
// NEW LAYOUT — AVL WEATHER PREVIEW (CLEAN + WIRED)
// ============================================================

import { getWeatherForUI } from '/js/adapters/weather-adapter.js';
import { calculateComfort } from '/js/intel/comfort.js';


// ============================================================
// MAIN RENDER FUNCTION
// ============================================================

export async function renderNewLayout(container) {
  container.innerHTML = `
    <div class="top-stack">
      <div id="feelscore" class="card"></div>
      <div id="today" class="card"></div>
      <div id="timeline" class="card"></div>
      <div id="tomorrow" class="card"></div>
    </div>
  `;

  try {
    const data = await getWeatherForUI({
      lat: 35.5951,
      lon: -82.5515
    });

    const current = data.current;
    const hourly = data.hourly;

    renderFeelScore(current);
    renderToday(hourly);
    renderTimeline(hourly);
    renderTomorrow(data);

  } catch (err) {
    console.error('Preview load error:', err);
    container.innerHTML = `<div style="padding:20px;">Error loading preview</div>`;
  }
}


// ============================================================
// FEELSCORE (USES REAL ENGINE)
// ============================================================

function renderFeelScore(current) {
  const comfort = calculateComfort(current);

  const score = Math.round((comfort?.score || 0) * 10);
  const label = comfort?.label || "Unknown";

  const detail = getFeelDetail(comfort);
  const action = getFeelAction(score);

  document.getElementById('feelscore').innerHTML = `
    <div class="feelscore-card">
      <div class="fs-title">FEELSCORE</div>
      <div class="fs-score">${score}</div>
      <div class="fs-label">${label}</div>
      <div class="fs-detail">${detail}</div>
      <div class="fs-action">${action}</div>
    </div>
  `;
}


// ============================================================
// TODAY MODULE
// ============================================================

function renderToday(hourly) {
  if (!hourly?.length) return;

  const headline = getTodayHeadline(hourly);
  const { bestWindow, worstWindow } = getKeyWindows(hourly);

  document.getElementById('today').innerHTML = `
    <div class="today-card">
      <div class="today-headline">${headline}</div>
      <div class="today-points">
        <div>Worst: ${worstWindow}</div>
        <div>Best: ${bestWindow}</div>
      </div>
    </div>
  `;
}


// ============================================================
// TIMELINE
// ============================================================

function renderTimeline(hourly) {
  if (!hourly?.length) return;

  const nextHours = hourly.slice(0, 5);

  const html = nextHours.map(h => {
    const comfort = calculateComfort(h);
    const score = Math.round((comfort?.score || 0) * 10);
    const emoji = getSimpleIcon(score);

    return `
      <div class="hour-block">
        <div class="hour-time">${formatHour(h.time)}</div>
        <div class="hour-icon">${emoji}</div>
        <div class="hour-temp">${Math.round(h.temp)}°</div>
        <div class="hour-score">${score}</div>
      </div>
    `;
  }).join('');

  document.getElementById('timeline').innerHTML = `
    <div class="timeline-card">
      <div class="timeline-title">Next Few Hours</div>
      <div class="timeline-row">${html}</div>
    </div>
  `;
}


// ============================================================
// TOMORROW
// ============================================================

function renderTomorrow(data) {
  if (!data.daily?.[1]) return;

  const tomorrow = data.daily[1];

  const comfort = calculateComfort({
    temp: tomorrow.temp?.max,
    humidity: tomorrow.humidity,
    wind: tomorrow.wind
  });

  const score = Math.round((comfort?.score || 0) * 10);

  document.getElementById('tomorrow').innerHTML = `
    <div class="tomorrow-card">
      <div class="tomorrow-title">TOMORROW</div>
      <div class="tomorrow-score">FeelScore ${score}</div>
      <div class="tomorrow-label">${comfort?.label || ""}</div>
    </div>
  `;
}


// ============================================================
// HELPERS
// ============================================================

function getFeelDetail(comfort) {
  if (!comfort) return "";

  if (comfort.flags?.veryHumid) return "Humid air";
  if (comfort.flags?.crisp) return "Crisp air";
  if (comfort.flags?.windy) return "Breezy conditions";

  return "Balanced conditions";
}

function getFeelAction(score) {
  if (score >= 80) return "Great time to be outside";
  if (score >= 65) return "Good for most activities";
  if (score >= 50) return "Okay in short bursts";
  return "Better to limit time outside";
}


// ============================================================
// TODAY LOGIC
// ============================================================

function getTodayHeadline(hourly) {
  const now = getScore(hourly[0]);
  const later = getScore(hourly[3]);

  if (later > now + 5) return "Improves later today";
  if (later < now - 5) return "Gets less comfortable this afternoon";
  return "Stays fairly steady today";
}

function getKeyWindows(hourly) {
  let best = { score: -Infinity, index: 0 };
  let worst = { score: Infinity, index: 0 };

  hourly.slice(0, 8).forEach((h, i) => {
    const score = getScore(h);

    if (score > best.score) best = { score, index: i };
    if (score < worst.score) worst = { score, index: i };
  });

  return {
    bestWindow: formatHour(hourly[best.index].time),
    worstWindow: formatHour(hourly[worst.index].time)
  };
}


// ============================================================
// UTIL
// ============================================================

function getScore(h) {
  const c = calculateComfort(h);
  return Math.round((c?.score || 0) * 10);
}

function formatHour(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: 'numeric' });
}

function getSimpleIcon(score) {
  if (score >= 80) return "🙂";
  if (score >= 60) return "😐";
  return "😕";
}