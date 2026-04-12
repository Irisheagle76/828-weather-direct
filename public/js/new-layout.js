// ============================================================
// NEW LAYOUT — AVL WEATHER PREVIEW (SYNTHESIS WIRED)
// ============================================================

import { getWeatherForUI } from '/js/adapters/weather-adapter.js';
import { calculateComfort } from '/js/intel/comfort.js';
import { assembleWithVoice } from '/js/synth/assembleWithVoice.js';
import { buildHumanActionIntel } from '/js/intel/human-action.js';

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
// FEELSCORE — NOW POWERED BY SYNTHESIZER
// ============================================================

function renderFeelScore(current) {
  if (!current) return;

  // 1. Comfort engine
  const comfort = calculateComfort(current);
  const score = Math.round((comfort?.score || 0) * 10);

  // 2. Build intel (minimal but expandable)
  const intel = {
    signals: {
      temp: current.temp,
      dewPoint: current.dewPoint ?? current.dew_point ?? null,
      windSpeed: current.wind ?? current.windSpeed ?? 0,
      cloudCover: current.cloudCover ?? null
    },
    dominantFactor: detectDominantFactor(current),
    confidence: 0.7,
    snapshot: current
  };

  // 3. Category bridge
  const category = mapScoreToCategory(score);

  // 4. Synthesizer
  const narrative = assembleWithVoice(
    intel,
    "today",
    category,
    comfort?.goldilocks
  );

  // 5. Headline override (Goldilocks)
  const headline = comfort?.goldilocks
    ? "Chef’s kiss outside"
    : narrative.headline;

  // 6. Clean bullets (max 2)
  const bullets = (narrative.bullets || []).slice(0, 2);

  // 7. Render
  document.getElementById('feelscore').innerHTML = `
    <div class="feelscore-card">

      <div class="fs-header">
        <div class="fs-title">FEELSCORE</div>
        <div class="fs-score">${score}</div>
      </div>

      <div class="fs-headline">${headline}</div>

      <div class="fs-bullets">
        ${bullets.map(b => `<div class="fs-bullet">• ${b}</div>`).join('')}
      </div>

    </div>
  `;
}


// ============================================================
// TODAY MODULE (unchanged for now)
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
// TIMELINE (unchanged)
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
// TOMORROW (unchanged)
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
// HELPERS (UPDATED)
// ============================================================

function mapScoreToCategory(score) {
  if (score >= 88) return "veryComfortable";
  if (score >= 70) return "comfortable";
  if (score >= 55) return "slightlyUncomfortable";
  if (score >= 40) return "uncomfortable";
  return "harsh";
}

function detectDominantFactor(current) {
  const dp = current.dewPoint ?? current.dew_point ?? 55;
  const temp = current.temp ?? 70;
  const wind = current.wind ?? current.windSpeed ?? 0;

  if (dp >= 68) return "muggy";
  if (temp >= 88) return "heat";
  if (temp <= 45) return "cold";
  if (wind >= 15) return "wind";

  return "sun";
}


// ============================================================
// EXISTING HELPERS (unchanged)
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

  hourly.slice(2, 10).forEach((h, i) => { // 👈 skip overnight noise
    const score = getScore(h);

    if (score > best.score) best = { score, index: i + 2 };
    if (score < worst.score) worst = { score, index: i + 2 };
  });

  return {
    bestWindow: formatHour(hourly[best.index].time),
    worstWindow: formatHour(hourly[worst.index].time)
  };
}

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