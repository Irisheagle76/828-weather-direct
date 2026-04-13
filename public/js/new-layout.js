// ============================================================
// NEW LAYOUT — AVL WEATHER PREVIEW (FINAL CLEAN)
// ============================================================

import { getWeatherForUI } from '/js/adapters/weather-adapter.js';
import { calculateComfort } from '/js/intel/comfort.js';
import { normalizeOpenMeteo } from '/js/intel/normalize-hourly.js';
import { assembleWithVoice } from '/js/intel/synthesizer/assembleWithVoice.js';
import { buildHumanActionIntelFS } from '/js/intel/human-action-feelscore.js';


// ============================================================
// MAIN RENDER (FIXED DATA PIPELINE)
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

    // ------------------------------------------------------------
    // 🔥 NORMALIZE ALL WEATHER INPUT (CRITICAL FIX)
    // ------------------------------------------------------------
    const rawHourly = data.hourly || [];
    const hourly = normalizeOpenMeteo(rawHourly);

    // normalize current using same pipeline
    const current =
      normalizeOpenMeteo([data.current])[0] ||
      data.current;

    // ------------------------------------------------------------
    // 🧠 HUMAN INTEL (now uses clean data)
    // ------------------------------------------------------------
    const human = buildHumanActionIntelFS({
      ...data,
      hourly,
      current
    });

    // ------------------------------------------------------------
    // 🎯 RENDER
    // ------------------------------------------------------------
    renderFeelScore(current);
    renderToday(human.today);
    renderTimeline(hourly);
    renderTomorrow(human.tomorrow);

  } catch (err) {
    console.error('Preview load error:', err);
    container.innerHTML = `<div style="padding:20px;">Error loading preview</div>`;
  }
}

// ============================================================
// FEELSCORE (SYNTHESIZED — FULL HYBRID)
// ============================================================

function renderFeelScore(current) {
  if (!current) return;

  const comfort = calculateComfort(current);
  const score = Math.round((comfort?.score || 0) * 10);

  const category = mapScoreToCategory(score);

  // ------------------------------------------------------------
  // 🧠 BUILD RICH INTEL
  // ------------------------------------------------------------
  const intel = {
    signals: {
      temp: current.temperatureF,
      dewPoint: current.dewpointF,
      windSpeed: current.wind_speed ?? current.windSpeed ?? 0
    },

    pattern: {
      avg: score,
      trend: 0, // feelscore is "now", so neutral trend
      min: score - 5,
      max: score + 5
    },

    context: {
      label: "today",
      timeWindow: "current"
    },

    dominantFactor: detectDominantFactor(current)
  };

  // ------------------------------------------------------------
  // 🎙 SYNTH
  // ------------------------------------------------------------
  const narrative = assembleWithVoice(
    intel,
    "today",
    category,
    comfort?.goldilocks
  );

  // ------------------------------------------------------------
  // 🛟 HEADLINE (hybrid)
  // ------------------------------------------------------------
  let headline =
    narrative?.headline ||
    "Feels pretty good out";

  // soften robotic phrasing slightly
  if (headline.includes("settles in")) {
    headline = headline.replace("settles in", "settles in nicely");
  }

  // ------------------------------------------------------------
  // 🛟 BULLETS (with fallback)
  // ------------------------------------------------------------
  const fallbackBullets = [];

  if (current.dewpointF < 55) {
    fallbackBullets.push("Air feels light and easy");
  }

  if (current.dewpointF < 50 && score >= 85) {
    fallbackBullets.push("One of those classic mountain-air feels");
  }

  if ((current.wind_speed ?? 0) < 8 && score >= 85) {
    fallbackBullets.push("Nothing really pushing you around");
  }

  const bullets = (
    narrative?.bullets?.length
      ? narrative.bullets
      : fallbackBullets
  ).slice(0, 3);

  // ------------------------------------------------------------
  // 🎯 RENDER
  // ------------------------------------------------------------
  document.getElementById('feelscore').innerHTML = `
    <div class="feelscore-card">

      <div class="fs-header">
        <div class="fs-title">FEELSCORE</div>
        <div class="fs-score">${score}</div>
      </div>

      <div class="fs-headline">${headline}</div>

      ${bullets.length ? `
        <div class="fs-bullets">
          ${bullets.map(b => `<div class="fs-bullet">• ${b}</div>`).join('')}
        </div>
      ` : ``}

    </div>
  `;
}


// ============================================================
// TODAY (ROBUST RENDER)
// ============================================================

function renderToday(today) {
  if (!today) return;

  const score = today.score ?? 70;

  // ------------------------------------------------------------
  // 🎯 HEADLINE (calm-day aware)
  // ------------------------------------------------------------
  let headline = today.headline;

  if (!headline) {
    if (score >= 90) {
      headline = "One of those easy, dialed-in days";
    } else if (score >= 75) {
      headline = "Comfortable with a smooth feel overall";
    } else {
      headline = "Pretty stable conditions out there";
    }
  }

  // ------------------------------------------------------------
  // 🎯 BULLETS (intentional calm language)
  // ------------------------------------------------------------
  let bullets;

  if (today.bullets?.length) {
    bullets = today.bullets;
  } else if (score >= 90) {
    bullets = [
      "Just a smooth, easy stretch of weather",
      "Nothing really getting in your way out there"
    ];
  } else if (score >= 75) {
    bullets = [
      "Overall a comfortable and steady feel",
    ];
  } else {
    bullets = [
      "Nothing major driving conditions one way or the other"
    ];
  }

  bullets = bullets.slice(0, 3);

  document.getElementById('today').innerHTML = `
    <div class="today-card">

      <div class="today-header">
        <div class="today-title">TODAY</div>
        <div class="today-emoji">${today.emoji || ""}</div>
      </div>

      <div class="today-headline">${headline}</div>

      <div class="today-bullets">
        ${bullets.map(b => `
          <div class="today-bullet">• ${b}</div>
        `).join("")}
      </div>

    </div>
  `;
}

// ============================================================
// TOMORROW (ROBUST RENDER)
// ============================================================

function renderTomorrow(tomorrow) {
  if (!tomorrow) return;

  const score = tomorrow.score ?? 70;

  // ------------------------------------------------------------
  // 🎯 HEADLINE (avoid duplication with TODAY)
  // ------------------------------------------------------------
  let headline = tomorrow.headline;

  if (!headline) {
    if (score >= 90) {
      headline = "More of the same — things stay in a good place";
    } else if (score >= 75) {
      headline = "Another comfortable and steady day ahead";
    } else {
      headline = "Conditions look fairly stable overall";
    }
  }

  // ------------------------------------------------------------
  // 🎯 BULLETS (calm but forward-looking)
  // ------------------------------------------------------------
  let bullets;

  if (tomorrow.bullets?.length) {
    bullets = tomorrow.bullets;
  } else if (score >= 90) {
    bullets = [
      "That comfortable feel sticks around",
      "Still nothing really pushing things off balance"
    ];
  } else if (score >= 75) {
    bullets = [
      "Conditions remain fairly consistent through the day"
    ];
  } else {
    bullets = [
      "No major shifts expected"
    ];
  }

  bullets = bullets.slice(0, 3);

  document.getElementById('tomorrow').innerHTML = `
    <div class="tomorrow-card">

      <div class="tomorrow-header">
        <div class="tomorrow-title">TOMORROW</div>
        <div class="tomorrow-emoji">${tomorrow.emoji || ""}</div>
      </div>

      <div class="tomorrow-headline">${headline}</div>

      <div class="tomorrow-bullets">
        ${bullets.map(b => `
          <div class="tomorrow-bullet">• ${b}</div>
        `).join("")}
      </div>

    </div>
  `;
}

// ============================================================
// TIMELINE (UNCHANGED BASELINE)
// ============================================================

function renderTimeline(hourly) {
  if (!hourly?.length) return;

  // ------------------------------------------------------------
  // ⏱ ROUND TO NEXT HOUR
  // ------------------------------------------------------------
  const now = new Date();
  now.setMinutes(0, 0, 0);
  now.setHours(now.getHours() + 1);

  const nextHourTs = now.getTime();

  // ------------------------------------------------------------
  // 🔍 FIND START INDEX
  // ------------------------------------------------------------
  const startIndex = hourly.findIndex(h => h.timestamp >= nextHourTs);
  const safeIndex = startIndex >= 0 ? startIndex : 0;

  const nextHours = hourly.slice(safeIndex, safeIndex + 6);

  // ------------------------------------------------------------
  // 🎯 BUILD UI
  // ------------------------------------------------------------
  const html = nextHours.map(h => {
    const comfort = calculateComfort(h);
    const score = Math.round((comfort?.score || 0) * 10);
    const emoji = getSimpleIcon(score);

    return `
      <div class="hour-block">
        <div class="hour-time">${formatHour(h.timestamp)}</div>
        <div class="hour-icon">${emoji}</div>
        <div class="hour-temp">${Math.round(h.temperatureF)}°</div>
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
// HELPERS
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

function formatHour(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: 'numeric' });
}

function getSimpleIcon(score) {
  if (score >= 80) return "🙂";
  if (score >= 60) return "😐";
  return "😕";
}