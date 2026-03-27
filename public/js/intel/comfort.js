// /intel/comfort.js
// FULL HYBRID — Narrative Engine + Asheville Comfort Score

import { LOCATION } from "../config/location.js?v=1.0.0";

// ------------------------------------------------------------
// SOLAR ELEVATION
// ------------------------------------------------------------
function computeSolarElevation(timestamp, lat, lon) {
  const date = new Date(timestamp);
  const rad = Math.PI / 180;

  const day = Math.floor(
    (date - new Date(date.getFullYear(), 0, 0)) / 86400000
  );

  const decl =
    23.45 * rad *
    Math.sin(rad * ((360 / 365) * (day - 81)));

  const time = date.getHours() + date.getMinutes() / 60;
  const solarTime = time + (lon / 15);

  const hourAngle = rad * (15 * (solarTime - 12));
  const latRad = lat * rad;

  const elevation =
    Math.asin(
      Math.sin(latRad) * Math.sin(decl) +
      Math.cos(latRad) * Math.cos(decl) * Math.cos(hourAngle)
    );

  return elevation * (180 / Math.PI);
}

// ------------------------------------------------------------
// DEW → RH
// ------------------------------------------------------------
function dewToRH(tempF, dewF) {
  const t = (tempF - 32) * 5/9;
  const d = (dewF - 32) * 5/9;

  const rh =
    100 *
    (Math.exp((17.625 * d) / (243.04 + d)) /
     Math.exp((17.625 * t) / (243.04 + t)));

  return Math.max(0, Math.min(100, rh));
}

// ------------------------------------------------------------
// ASHEVILLE COMFORT SCORE
// ------------------------------------------------------------
function computeComfortScore(temp, dew, wind, elev, windDir) {
  const rh = dewToRH(temp, dew);

  const tIdeal = 70;
  const tDiff = Math.abs(temp - tIdeal);
  const tScore = Math.min(tDiff / 35, 1);

  let drynessPenalty = 0;
  if (rh < 25) drynessPenalty = 1;
  else if (rh < 35) drynessPenalty = 0.75;
  else if (rh < 45) drynessPenalty = 0.5;
  else drynessPenalty = 0.2;

  let windPenalty = Math.min(wind / 25, 1) * 0.4;

  // ⭐ FIX: windDir may be a number → convert safely
  const dir = String(windDir ?? "");
  if (dir.includes("W")) {
    windPenalty += 0.2;
  }

  let solarBonus = 0;
  if (elev > 20 && temp < 75) solarBonus = 0.15;

  let score =
    (tScore * 0.5) +
    (drynessPenalty * 0.9) +
    windPenalty - 
    solarBonus;

  return Math.round(
    Math.max(0, Math.min(100, 100 - (score * 100)))
  );
}

// ------------------------------------------------------------
// COLOR + LABEL
// ------------------------------------------------------------
export function getComfortColor(score) {
  if (score >= 80) return "#4f7cff";
  if (score >= 65) return "#2ec4b6";
  if (score >= 45) return "#ff9f1c";
  return "#e63946";
}

export function getComfortLabel(score) {
  if (score >= 80) return "Great";
  if (score >= 65) return "Comfortable";
  if (score >= 50) return "Dry";
  if (score >= 35) return "Very Dry";
  return "Harsh / Fire Risk";
}

// ------------------------------------------------------------
// WIND CHILL
// ------------------------------------------------------------
function computeWindChill(tempF, windMph) {
  if (tempF > 50 || windMph < 3) return tempF;
  return (
    35.74 +
    0.6215 * tempF -
    35.75 * Math.pow(windMph, 0.16) +
    0.4275 * tempF * Math.pow(windMph, 0.16)
  );
}

// ------------------------------------------------------------
// HUMIDITY FEEL
// ------------------------------------------------------------
function humidityFeel(dew) {
  if (dew <= 40) return "Dry and comfortable.";
  if (dew <= 55) return "Humidity stays manageable.";
  if (dew <= 65) return "A bit humid at times.";
  if (dew <= 70) return "Humid and noticeable.";
  return "Tropical and heavy.";
}

// ------------------------------------------------------------
// SUN FEEL
// ------------------------------------------------------------
function sunAngleFeel(elev) {
  if (elev <= 0) return "Nighttime calm.";
  if (elev < 10) return "Low sun adds a gentle warmth.";
  if (elev < 30) return "Morning sun gives a mild boost.";
  if (elev < 60) return "Daytime sun adds warmth.";
  return "Strong sun overhead.";
}

function isSolarHelpful(intel, elev) {
  const wu = intel.wu;
  if (!wu) return false;

  const cloud = wu.cloudCover ?? 100;
  const windDir = String(wu.windDir ?? "");
  const trend = intel.tempTrend ?? 0;

  return (
    elev > 15 &&
    cloud < 60 &&
    trend >= 0 &&
    !windDir.includes("W")
  );
}

// ------------------------------------------------------------
// PRECIP FEEL (RESTORED)
// ------------------------------------------------------------
function fallingPrecipFeel(intel) {
  const rate = intel.wu?.precipRate ?? 0;
  const type = intel.wu?.precipType ?? "";

  if (rate <= 0) return null;

  if (type === "snow" && rate < 0.1)
    return { emoji: "❄️", summary: "Light snow falling — a wintry feel." };

  if (type === "snow")
    return { emoji: "🌨️", summary: "Steady snow falling — bundle up out there." };

  if (type === "rain" && rate < 0.05)
    return { emoji: "🌦️", summary: "Light rain falling — a damp, cool feel." };

  if (type === "rain")
    return { emoji: "🌧️", summary: "Rain falling — a noticeably damp feel." };

  return null;
}

// ------------------------------------------------------------
// TREND + DROP (RESTORED)
// ------------------------------------------------------------
function computeShortTermTrend(intel) {
  const temps = intel.hourly?.temperature_2m;
  if (!temps) return null;

  const t1 = temps[0];
  const t3 = temps[2];
  if (t1 == null || t3 == null) return null;

  const delta = t3 - t1;

  if (delta >= 4) return "warming quickly";
  if (delta >= 2) return "warming gradually";
  if (delta <= -4) return "cooling quickly";
  if (delta <= -2) return "cooling gradually";

  return null;
}

function computeTempDropFeel(intel) {
  const wu = intel.wu;
  if (!wu) return null;

  const hour = new Date(wu.obsTimeLocal).getHours();
  if (hour < 11) return null;

  const current = wu.temp;
  const high = intel?.today?.stats?.maxTemp ?? current;

  const drop = high - current;

  if (drop >= 20) return "a sharp drop compared to earlier today";
  if (drop >= 12) return "noticeably colder than earlier today";
  if (drop >= 6) return "a cooler turn compared to earlier today";

  return null;
}

// ------------------------------------------------------------
// ⭐ INLINE EMOJI PICKER (replaces missing pickComfortEmoji)
// ------------------------------------------------------------
function pickComfortEmoji(state) {
  switch (state) {
    case "cold": return "🥶";
    case "cool": return "🧥";
    case "mild": return "🙂";
    case "warm": return "😌";
    case "hot":  return "🥵";
    default:     return "😐";
  }
}

// ------------------------------------------------------------
// MAIN ENGINE
// ------------------------------------------------------------
export function computeComfort(intel) {
  const wu = intel.wu;
  const sky = intel.sky ?? {};   // ⭐ unified sky intelligence
  if (!wu) return {};

  const temp = wu.temp ?? 0;
  const dew = wu.dewPoint ?? 0;
  const wind = wu.windSpeed ?? 0;
  const windDir = wu.windDir ?? "";
  const timestamp = wu.obsTimeLocal ?? Date.now();

  const elev = computeSolarElevation(timestamp, LOCATION.lat, LOCATION.lon);
  const feelsLike = computeWindChill(temp, wind);

  // ⭐ Asheville‑tuned score
  const comfortScore = computeComfortScore(temp, dew, wind, elev, windDir);

  // --- precip override
  const precipOverride = fallingPrecipFeel(intel);
  if (precipOverride) {
    return {
      ...precipOverride,
      comfortScore,
      label: getComfortLabel(comfortScore),
      color: getComfortColor(comfortScore)
    };
  }

  // --- state
  let state = "mild";
  if (feelsLike <= 32) state = "cold";
  else if (feelsLike <= 50) state = "cool";
  else if (feelsLike <= 70) state = "mild";
  else if (feelsLike <= 85) state = "warm";
  else state = "hot";

  const emoji = pickComfortEmoji(state);

  let baseFeel =
    state === "cold" ? "Cold with a noticeable chill" :
    state === "cool" ? "Cool and manageable" :
    state === "warm" ? "Warm with a gentle edge" :
    state === "hot" ? "Hot and energetic" :
    "Comfortable overall";

  const dropFeel = computeTempDropFeel(intel);
  const trend = computeShortTermTrend(intel);

  let firstSentence = `${baseFeel}.`;

  if (dropFeel) {
    firstSentence = `${baseFeel} — ${dropFeel}.`;
  } else if (trend) {
    firstSentence = `${baseFeel} — ${trend} over the next few hours.`;
  }

  const parts = [firstSentence];

  const humidText = humidityFeel(dew);
  if (humidText) parts.push(humidText);

  // ⭐ unified cloud cover
  const cloud = sky.cloud ?? wu.cloudCover ?? 100;

  // ⭐ unified UV
  const uv = sky.uv ?? intel.uv ?? wu.uv ?? 0;

  // ⭐ unified solar radiation
  const solar = sky.solar ?? wu.solarRadiation ?? null;

  // solar helpfulness now uses unified sky
  if (isSolarHelpful(intel, elev)) {
    parts.push(sunAngleFeel(elev));
  }

  if (wind >= 15) {
    parts.push("A noticeable breeze adds some edge.");
  }

  // 🔥 fire messaging overlay
  if (comfortScore < 45) {
    parts.push("Dry air and wind are increasing fire danger.");
  }

  return {
    emoji,
    summary: parts.join(" "),
    comfortScore,
    label: getComfortLabel(comfortScore),
    color: getComfortColor(comfortScore),
    feelsLike
  };
}

// ------------------------------------------------------------
// FUTURE BUILDER — FIXED (next 6 real future hours)
// ------------------------------------------------------------
export function buildFutureComfort(hourly, computeComfort) {
  if (!hourly || !hourly.time) return [];

  const now = Date.now();
  const times = hourly.time;

  // ⭐ Find the first hour in the future
  let startIndex = times.findIndex(t => new Date(t).getTime() > now);
  if (startIndex === -1) return [];

  const items = [];

  for (let i = 0; i < 6; i++) {
    const idx = startIndex + i;
    if (idx >= times.length) break;

    const intelForHour = {
      wu: {
        temp: hourly.temperature_2m[idx],
        dewPoint: hourly.dewpoint_2m[idx],
        windSpeed: hourly.wind_speed_10m[idx],
        windDir: hourly.wind_direction_10m?.[idx] ?? "",
        obsTimeLocal: hourly.time[idx]
      },
      hourly
    };

    const c = computeComfort(intelForHour);

    items.push({
      index: idx,
      time: hourly.time[idx],
      hourLabel: formatHourLabel(hourly.time[idx]),  // ⭐ timezone‑safe
      comfortScore: c.comfortScore,
      color: c.color,
      label: c.label,
      emoji: c.emoji,

      // raw values for phrase engine
      temp: hourly.temperature_2m[idx],
      dew: hourly.dewpoint_2m[idx],
      wind: hourly.wind_speed_10m[idx]
    });
  }

  return items;
}

// ------------------------------------------------------------
// ⭐ TIMEZONE‑SAFE HOUR LABEL
// ------------------------------------------------------------
function formatHourLabel(iso) {
  const d = new Date(iso);

  // ⭐ Force Asheville local time
  const formatter = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    hour12: true,
    timeZone: "America/New_York"
  });

  const parts = formatter.formatToParts(d);
  const hour = parts.find(p => p.type === "hour")?.value ?? "";
  const suffix = parts.find(p => p.type === "dayPeriod")?.value?.toUpperCase() ?? "";

  return `${hour} ${suffix}`;
}

// ------------------------------------------------------------
// ⭐ FUTURE COMFORT PHRASE ENGINE — Asheville‑Tuned, Seasonal, Sky‑Aware
// ------------------------------------------------------------
export function generateFutureComfortPhrase(items, hourly) {
  if (!items || items.length === 0) return "";

  const first = items[0];
  const last = items[items.length - 1];

  const temps = items.map(i => i.temp);
  const dews = items.map(i => i.dew);
  const winds = items.map(i => i.wind);

  // 1. Temperature band (Asheville‑tuned)
  function tempBand(t) {
    if (t <= 42) return "cold";
    if (t <= 56) return "cool";
    if (t <= 72) return "mild";
    if (t <= 83) return "warm";
    return "hot";
  }

  const bandStart = tempBand(first.temp);
  const bandEnd = tempBand(last.temp);

  // 2. Dew point feel (Asheville‑tuned)
  function dewFeel(d) {
    if (d <= 40) return "crisp, mountain‑dry air";
    if (d <= 55) return "comfortable humidity";
    if (d <= 63) return "a touch of humidity";
    if (d <= 68) return "noticeable humidity";
    return "muggy air building";
  }

  const dewPhrase = dewFeel(first.dew);

  // 3. Wind feel (Asheville‑tuned)
  function windFeel(w) {
    if (w < 4) return "calm conditions";
    if (w < 10) return "a gentle breeze";
    if (w < 18) return "a noticeable breeze";
    return "breezy conditions";
  }

  const windPhrase = windFeel(first.wind);

  // 4. Trend detection
  const tempTrend = last.temp - first.temp;
  const dewTrend = last.dew - first.dew;
  const windTrend = last.wind - first.wind;

  let trendPhrase = "";

  if (tempTrend >= 6) trendPhrase = "warming through the afternoon";
  else if (tempTrend >= 3) trendPhrase = "warming gradually";
  else if (tempTrend <= -6) trendPhrase = "cooling off noticeably later";
  else if (tempTrend <= -3) trendPhrase = "cooling gradually";

  // 5. Seasonal tone
  const month = new Date(first.time).getMonth() + 1;
  const isWinter = month === 12 || month <= 2;
  const isSummer = month >= 6 && month <= 8;

  const seasonalMap = {
    cold: isWinter ? "Cold and brisk" : "Cold",
    cool: isWinter ? "Chilly" : "Cool and manageable",
    mild: isSummer ? "Pleasantly mild" : "Mild and easygoing",
    warm: isSummer ? "Warm and summery" : "Warm and pleasant",
    hot: isSummer ? "Hot and summery" : "Hot and energetic"
  };

  const base = seasonalMap[bandStart] ?? "Comfortable";

  // 6. Sky & solar influence (using hourly.cloudcover)
  let skyPhrase = "";
  if (hourly && Array.isArray(hourly.cloudcover)) {
    const cloud = hourly.cloudcover[first.index] ?? null;
    if (cloud != null) {
      if (cloud < 25) skyPhrase = "with sunshine adding a bit of warmth";
      else if (cloud < 55) skyPhrase = "under partly sunny skies";
      else if (cloud < 80) skyPhrase = "with filtered sun through clouds";
      else skyPhrase = "under mostly cloudy skies";
    }
  }

  // 7. Hazard‑aware modifiers
  let hazard = "";
  if (first.wind >= 20) hazard = "gusty at times";
  if (first.dew >= 69) hazard = "muggy air building";
  if (first.temp >= 88) hazard = "trending hot later";

  // 8. Time‑of‑day awareness
  const hour = new Date(first.time).getHours();
  let timePhrase = "";
  if (hour < 10) timePhrase = "this morning";
  else if (hour < 15) timePhrase = "by midday";
  else if (hour < 18) timePhrase = "this afternoon";
  else timePhrase = "this evening";

  // 9. Build final sentence
  let sentence = `${base} ${timePhrase} with ${dewPhrase} and ${windPhrase}`;
  if (skyPhrase) sentence += `, ${skyPhrase}`;
  if (hazard) sentence += ` — ${hazard}`;
  if (trendPhrase) sentence += ` — ${trendPhrase}`;

  return sentence.trim() + ".";
}

// ------------------------------------------------------------
// COMFORT NOW — CLICK TO EXPAND NEXT 6 HOURS
// ------------------------------------------------------------
export function attachComfortNowExpansion(intel) {
  const module = document.getElementById("comfort-now");
  const panel = document.getElementById("comfort-now-expanded");

  if (!module || !panel) return;

  module.addEventListener("click", () => {
    const isOpen = !panel.classList.contains("hidden");

    if (isOpen) {
      panel.classList.add("hidden");
      return;
    }

    panel.classList.remove("hidden");

    const items = buildFutureComfort(intel.hourly, computeComfort);
    renderComfortExpansion(panel, items);
  });
}

// ------------------------------------------------------------
// RENDER — MINI COMFORT TIMELINE (EMOJI + TEMP + SCORE)
// ------------------------------------------------------------
function renderComfortExpansion(panel, items) {
  if (!items.length) {
    panel.innerHTML = `<div class="hour-row">No hourly data</div>`;
    return;
  }

  panel.innerHTML = items.map(i => `
    <div class="hour-row">

      <div class="hour-time">${i.hourLabel}</div>

      <div class="hour-mainline">
        <span class="hour-emoji">${i.emoji}</span>
        <span class="hour-temp">${Math.round(i.temp)}°</span>
      </div>

      <div class="hour-score" style="color:${i.color}">
        ${i.comfortScore}
      </div>

      <div class="hour-label">
        ${i.label}
      </div>

    </div>
  `).join("");
}

// ------------------------------------------------------------
// NEXT 6 HOURS — RENDER
// ------------------------------------------------------------
export function renderNext6Hours(container, items) {
  if (!container) return;

  container.innerHTML = items.map((i, idx) => `
    <div class="hour-block" data-idx="${idx}">
      
      <div class="hour-main">
        <span class="hour-time">${i.hourLabel}</span>
        <span class="hour-temp">${Math.round(i.temp)}°</span>
      </div>

      <div class="hour-extra hidden">
        <span class="hour-emoji">${i.emoji}</span>
        <span class="hour-score" style="color:${i.color}">
          ${i.comfortScore} (${i.label})
        </span>
      </div>

    </div>
  `).join("");
}

// ------------------------------------------------------------
// NEXT 6 HOURS — CLICK TO TOGGLE EMOJI
// ------------------------------------------------------------
export function attachNext6HourToggle(container) {
  if (!container) return;

  container.addEventListener("click", (e) => {
    const block = e.target.closest(".hour-block");
    if (!block) return;

    const extra = block.querySelector(".hour-extra");
    extra.classList.toggle("hidden");
  });
}
