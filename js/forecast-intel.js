// ----------------------------------------------------
// PART 1 — Core Helpers + Hourly Window Tools
// ----------------------------------------------------

// Basic math helpers
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function avg(arr) {
  if (!arr || !arr.length) return null;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

// ----------------------------------------------------
// LOW-IMPACT PHRASE ROTATION
// ----------------------------------------------------
let lastLowImpactPhrase = null;

export function getLowImpactPhrase(tempHighF, isGoldilocks) {
  if (isGoldilocks) return "Goldilocks! Just right!";

  const coolPhrases = [
    "Mild and seemingly uneventful.",
    "Quiet and comfortably straightforward.",
    "A gentle, low‑impact kind of day."
  ];

  const warmPhrases = [
    "Calm and easygoing overall.",
    "Nothing demanding on the weather front.",
    "A simple, low‑stress kind of day."
  ];

  let pool;
  if (tempHighF >= 68) pool = warmPhrases;
  else if (tempHighF <= 55) pool = coolPhrases;
  else pool = [...coolPhrases, ...warmPhrases];

  const options = pool.filter(p => p !== lastLowImpactPhrase);
  const choice = options[Math.floor(Math.random() * options.length)];
  lastLowImpactPhrase = choice;
  return choice;
}

// ----------------------------------------------------
// Time helpers
// ----------------------------------------------------
function toLocalDate(isoString) {
  return new Date(isoString);
}

function sameCalendarDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function to12Hour(hour) {
  const h = hour % 24;
  const suffix = h >= 12 ? "PM" : "AM";
  const base = h % 12 === 0 ? 12 : h % 12;
  return `${base} ${suffix}`;
}

function getTodayFullWindow(hourly) {
  const now = new Date();
  return getHourlyWindowForDay(hourly, now);
}

function shouldSuppressTempDesc(swing) {
  return swing >= 15 || swing <= -15;
}

// ----------------------------------------------------
// Helper: Find tomorrow's 2 PM forecast index
// ----------------------------------------------------
function getTomorrow2pmIndex(hourly) {
  const now = new Date();
  const target = new Date(now);
  target.setDate(now.getDate() + 1);
  target.setHours(14, 0, 0, 0);

  let bestIndex = 0;
  let bestDiff = Infinity;

  hourly.time.forEach((t, i) => {
    const d = new Date(t);
    const diff = Math.abs(d - target);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIndex = i;
    }
  });

  return bestIndex;
}

// ----------------------------------------------------
// Core window selector for any calendar day
// ----------------------------------------------------
function getHourlyWindowForDay(hourly, targetDate) {
  const times = hourly.time || [];
  const indices = [];

  const start = new Date(targetDate);
  start.setHours(0, 0, 0, 0);

  const end = new Date(targetDate);
  end.setHours(23, 59, 59, 999);

  for (let i = 0; i < times.length; i++) {
    const t = toLocalDate(times[i]);
    if (t >= start && t <= end) indices.push(i);
  }

  return indices;
}

// ----------------------------------------------------
// TOMORROW WINDOW — 00:00 → 23:59 (requires 6 hours)
// ----------------------------------------------------
function getTomorrowWindow(hourly) {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);

  const indices = getHourlyWindowForDay(hourly, tomorrow);
  if (indices.length < 6) return [];
  return indices;
}

// ----------------------------------------------------
// TODAY WINDOW — Now → Midnight (requires 3 hours)
// ----------------------------------------------------
function getTodayRemainingWindow(hourly) {
  const times = hourly.time || [];
  const indices = [];

  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  for (let i = 0; i < times.length; i++) {
    const t = new Date(times[i]);
    if (t >= now && t <= end) indices.push(i);
  }

  if (indices.length < 3) return [];
  return indices;
}

// ----------------------------------------------------
// Slice helper — extracts only the selected hours
// ----------------------------------------------------
function sliceHourly(hourly, indices) {
  const result = {};
  for (const key of Object.keys(hourly)) {
    const arr = hourly[key];
    if (!Array.isArray(arr)) continue;
    result[key] = indices.map(i => arr[i]);
  }
  return result;
}

// ----------------------------------------------------
// Daypart window (morning, afternoon, evening, etc.)
// ----------------------------------------------------
function getDaypartWindow(hourly, targetDate, startHour, endHour) {
  const times = hourly.time || [];
  const indices = [];

  const start = new Date(targetDate);
  start.setHours(startHour, 0, 0, 0);

  const end = new Date(targetDate);
  end.setHours(endHour, 59, 59, 999);

  for (let i = 0; i < times.length; i++) {
    const t = toLocalDate(times[i]);
    if (t >= start && t <= end) indices.push(i);
  }

  return indices;
}

// ----------------------------------------------------
// TIMING HELPERS — index-based, human-friendly
// ----------------------------------------------------
function hourIndexToLocalHour(index) {
  return index % 24;
}

function describeTimeOfDay(hourIndex) {
  const hour = hourIndexToLocalHour(hourIndex);

  if (hour >= 5 && hour < 9) return "early morning";
  if (hour >= 9 && hour < 12) return "late morning";
  if (hour >= 12 && hour < 15) return "early afternoon";
  if (hour >= 15 && hour < 18) return "late afternoon";
  if (hour >= 18 && hour < 22) return "evening";
  return "overnight";
}

function findEventTiming(windowed, start, end, conditionFn) {
  let first = null;
  let last = null;

  for (let i = start; i <= end; i++) {
    if (conditionFn(i, windowed)) {
      if (first === null) first = i;
      last = i;
    }
  }

  return { firstHour: first, lastHour: last };
}

function timingPhrase(timing, isTomorrow) {
  if (timing.firstHour === null || timing.lastHour === null) return "";

  const start = timing.firstHour;
  const end = timing.lastHour;
  const duration = end - start + 1;

  const startPart = describeTimeOfDay(start);
  const endPart = describeTimeOfDay(end);

  const dayLabel = isTomorrow ? " tomorrow" : "";

  if (duration >= 8 || (startPart === "early morning" && endPart === "evening")) {
    return ` throughout the day${dayLabel}`;
  }

  const dayparts = new Set([startPart, endPart]);
  if (dayparts.size >= 3) {
    return ` most of the day${dayLabel}`;
  }

  const startHourLocal = hourIndexToLocalHour(start);
  const endHourLocal = hourIndexToLocalHour(end);
  if (startHourLocal >= 22 || endHourLocal <= 6) {
    return ` overnight${dayLabel}`;
  }

  if (startPart === endPart) {
    return ` ${startPart}${dayLabel}`;
  }

  return ` from ${startPart}${dayLabel} into ${endPart}${dayLabel}`;
}

// ----------------------------------------------------
// EVENT CONDITION HELPERS
// ----------------------------------------------------
function isRain(i, windowed) {
  return (windowed.precipitation[i] ?? 0) > 0.02;
}

function isSnow(i, windowed) {
  const amt = windowed.snowfall[i] ?? 0;
  if (amt < 0.2) return false;
  if (amt < 0.5) return false;
  return true;
}

function isWind(i, windowed) {
  return (windowed.windgusts_10m[i] ?? 0) >= 30;
}

function isFreeze(i, windowed) {
  return (windowed.temperature_2m[i] ?? 999) <= 32;
}

function isHardFreeze(i, windowed) {
  return (windowed.temperature_2m[i] ?? 999) <= 28;
}

function isHeat(i, windowed) {
  return (
    (windowed.temperature_2m[i] ?? 0) >= 88 &&
    (windowed.dewpoint_2m[i] ?? 0) >= 68
  );
}
// ----------------------------------------------------
// PART 2 — Stats + Derived Metrics
// ----------------------------------------------------

// Generic stats helper
function basicStats(arr) {
  if (!arr || !arr.length) {
    return { min: null, max: null, avg: null };
  }

  let min = arr[0];
  let max = arr[0];
  let sum = 0;

  for (const v of arr) {
    if (v < min) min = v;
    if (v > max) max = v;
    sum += v;
  }

  return {
    min,
    max,
    avg: sum / arr.length
  };
}

// Temperature stats
function getTempStats(windowed) {
  return basicStats(windowed.temperature_2m || []);
}

// Dewpoint stats
function getDewStats(windowed) {
  return basicStats(windowed.dewpoint_2m || []);
}

// Wind gust stats
function getWindGustStats(windowed) {
  return basicStats(windowed.windgusts_10m || []);
}

// UV index stats
function getUVStats(windowed) {
  return basicStats(windowed.uv_index || []);
}

// Total precipitation (liquid)
function getPrecipTotal(windowed) {
  const arr = windowed.precipitation || [];
  return arr.length ? arr.reduce((a, b) => a + b, 0) : 0;
}

// Total snowfall
function getSnowTotal(windowed) {
  const arr = windowed.snowfall || [];
  return arr.length ? arr.reduce((a, b) => a + b, 0) : 0;
}

// ----------------------------------------------------
// PART 3 — Descriptors + Simple Impact Helpers
// ----------------------------------------------------

// Precipitation descriptor (rain + snow)
function describePrecip(precipTotal, snowTotal) {
  if (snowTotal >= 1.0) return "accumulating snow";
  if (snowTotal >= 0.5) return "light accumulating snow";
  if (snowTotal >= 0.2) return "a few flurries";
  if (snowTotal > 0)   return "a stray flake or two";

  if (precipTotal < 0.02) return "mainly dry";
  if (precipTotal < 0.10) return "a few light showers";
  if (precipTotal < 0.25) return "on-and-off showers";
  if (precipTotal < 0.75) return "a soaking rain at times";
  return "periods of heavy rain";
}

// Wind descriptor
function describeWind(gustMax) {
  if (gustMax >= 45) return "Very windy";
  if (gustMax >= 40) return "Quite gusty";
  if (gustMax >= 35) return "Breezy at times";
  if (gustMax >= 30) return "A light breeze";
  return "Generally light wind";
}

// Temperature descriptor (range-based)
function describeTempRange(stats) {
  if (!stats || stats.min == null || stats.max == null) {
    return "temperature details unavailable";
  }

  const { min, max } = stats;

  if (max <= 40) return "a cold day overall";
  if (max <= 55) return "a cool day overall";
  if (max <= 72) return "a mild day overall";
  if (max <= 82) return "a warm day overall";
  return "a hot day overall";
}

// Simple current vs high descriptor for Today
function describeTemp(tempNow, tempHigh) {
  if (tempNow == null || tempHigh == null) return "";

  if (tempHigh <= 40) return "a cold day overall";
  if (tempHigh <= 55) return "a cool day overall";
  if (tempHigh <= 72) return "a mild day overall";
  if (tempHigh <= 82) return "a warm day overall";
  return "a hot day overall";
}

// ----------------------------------------------------
// SHARED PHRASE MERGER
// ----------------------------------------------------
function mergePhrases(...parts) {
  const cleaned = parts
    .filter(Boolean)
    .map((p, i) => {
      let s = p.trim();

      s = s.replace(/[.,]+$/, "");
      s = s.replace(/^Expect\s+/i, "");

      if (/^mainly dry$/i.test(s)) s = "mainly dry conditions";

      s = s
        .replace(/light wind$/i, "light winds")
        .replace(/generally light wind$/i, "generally light winds")
        .replace(/quite gusty$/i, "quite gusty winds")
        .replace(/very windy$/i, "very windy conditions");

      if (i > 0) {
        s = s.charAt(0).toLowerCase() + s.slice(1);
      }

      return s;
    });

  if (cleaned.length === 0) return "";
  if (cleaned.length === 1) return cleaned[0];

  const [first, ...rest] = cleaned;
  return first + " with " + rest.join(" and ");
}

// ----------------------------------------------------
// PART 4 — Dominant Factor Scoring
// ----------------------------------------------------
function getDominantFactor(tempHigh, gustMax, precipTotal, snowTotal) {
  const drivers = [];

  if (snowTotal >= 0.5) {
    drivers.push({
      type: "snow",
      score: 80 + snowTotal * 10
    });
  }

  if (snowTotal === 0 && precipTotal >= 0.10) {
    drivers.push({
      type: "rain",
      score: 55 + precipTotal * 20
    });
  }

  if (gustMax >= 40) {
    drivers.push({
      type: "wind",
      score: 50 + gustMax
    });
  }

  if (tempHigh >= 88) {
    drivers.push({
      type: "heat",
      score: 55 + (tempHigh - 88) * 2
    });
  }

  if (tempHigh <= 35) {
    drivers.push({
      type: "cold",
      score: 55 + (35 - tempHigh) * 2
    });
  }

  if (
    precipTotal < 0.05 &&
    snowTotal === 0 &&
    gustMax < 26 &&
    tempHigh >= 60 &&
    tempHigh <= 75
  ) {
    drivers.push({
      type: "goldilocks",
      score: 40
    });
  }

  if (!drivers.length) {
    return "easy";
  }

  drivers.sort((a, b) => b.score - a.score);
  return drivers[0].type;
}

// ----------------------------------------------------
// SHARED ACTION MAPPING FUNCTION
// ----------------------------------------------------
function mapActionOutcome(
  dominant,
  tempDesc,
  precipDesc,
  windDesc,
  tempHighF,
  isGoldilocks
) {
  let badgeText = "No Hazards";
  let badgeClass = "badge-easy";
  let emoji = "🙂";

  let action = getLowImpactPhrase(tempHighF, isGoldilocks);

  let reason = mergePhrases(tempDesc, precipDesc, windDesc);
  reason = reason.charAt(0).toUpperCase() + reason.slice(1) + ".";

  switch (dominant) {
    case "snow":
      badgeText = "Snow Impact";
      badgeClass = "badge-snow";
      emoji = "❄️";
      action = "Allow extra travel time.";
      reason = mergePhrases(
        precipDesc,
        "roads could become slick",
        windDesc
      );
      reason = reason.charAt(0).toUpperCase() + reason.slice(1) + ".";
      break;

    case "rain":
      badgeText = "Rain Gear";
      badgeClass = "badge-rain";
      emoji = "🌧️";
      action = "Bring a rain jacket.";
      reason = mergePhrases(precipDesc, windDesc);
      reason = reason.charAt(0).toUpperCase() + reason.slice(1) + ".";
      break;

    case "wind":
      badgeText = "Wind Alert";
      badgeClass = "badge-wind";
      emoji = "💨";
      action = "Secure loose outdoor items...and your hair.";
      reason = mergePhrases(windDesc, tempDesc);
      reason = reason.charAt(0).toUpperCase() + reason.slice(1) + ".";
      break;

    case "heat":
      badgeText = "Heat Caution";
      badgeClass = "badge-heat";
      emoji = "🥵";
      action = "Stay hydrated.";
      reason = mergePhrases(
        tempDesc,
        "heat index may rise during the afternoon"
      );
      reason = reason.charAt(0).toUpperCase() + reason.slice(1) + ".";
      break;

    case "cold":
      badgeText = "Cold Prep";
      badgeClass = "badge-cold";
      emoji = "🥶";
      action = "Dress in warm layers.";
      reason = mergePhrases(
        tempDesc,
        "wind may make it feel colder"
      );
      reason = reason.charAt(0).toUpperCase() + reason.slice(1) + ".";
      break;

    case "goldilocks":
      badgeText = "Goldilocks Day";
      badgeClass = "badge-goldilocks";
      emoji = "🌟";
      action = "Make outdoor plans.";
      reason = mergePhrases(
        tempDesc,
        "dry conditions",
        "light winds"
      );
      reason = reason.charAt(0).toUpperCase() + reason.slice(1) + ".";
      break;

    case "easy":
    default:
      break;
  }

  return {
    badge: { text: badgeText, class: badgeClass },
    emoji,
    headline: action,
    text: reason
  };
}
// ====================================================
// PART 5 — TODAY — Human‑Action Outlook (Now → Midnight)
// (Bullet engine + end‑of‑day override)
// ====================================================
export function getTodayActionOutlook(hourly) {
  const indices = getTodayRemainingWindow(hourly);

  // END‑OF‑DAY OVERRIDE (Trigger #2)
  if (!indices.length) {
    return {
      badge: { text: "No Hazards", class: "badge-easy" },
      emoji: "🌙",
      headline: "The day is winding down.",
      text: "Fresh forecast updates arrive tomorrow morning.",
      bullets: [],
      suppressMicroAdvice: true,
      isEndOfDay: true
    };
  }

  const now = new Date();
  const currentHour = now.getHours();

  // Pull key stats
  const temps = hourly.temperature_2m;
  const dew = hourly.dewpoint_2m;
  const gusts = hourly.windgusts_10m;
  const precip = hourly.precipitation;
  const snow = hourly.snowfall;

  const tempNow = temps[currentHour];
  const tempHigh = Math.max(...temps.slice(currentHour, currentHour + 12));
  const tempLow = Math.min(...temps.slice(currentHour, currentHour + 12));

  const dewNow = dew[currentHour];
  const gustMax = Math.max(...gusts.slice(currentHour, currentHour + 12));
  const precipTotal = precip.slice(currentHour, currentHour + 12).reduce((a, b) => a + b, 0);
  const snowTotal = snow ? snow.slice(currentHour, currentHour + 12).reduce((a, b) => a + b, 0) : 0;

  // Determine dominant factor
  const dominant = getDominantFactor(tempHigh, gustMax, precipTotal, snowTotal);

  // Base outcome (emoji, headline, main sentence)
  const base = mapActionOutcome(
    dominant,
    describeTemp(tempNow, tempHigh),
    describePrecip(precipTotal, snowTotal),
    describeWind(gustMax),
    tempHigh,
    isGoldilocks(tempNow, tempHigh)
  );

  // Build bullets (warm, human, Asheville‑aware)
  const bullets = buildTodayBullets({
    tempNow,
    tempHigh,
    tempLow,
    dewNow,
    gustMax,
    precipTotal,
    precipHours: precip.slice(currentHour, currentHour + 12),
    snowTotal,
    sunrise: hourly.sunrise,
    sunset: hourly.sunset
  });

  return {
    ...base,
    bullets,
    suppressMicroAdvice: false,
    isEndOfDay: false
  };
}

// ====================================================
// TODAY BULLET ENGINE — Warm, human, Asheville‑aware
// ====================================================
function buildTodayBullets({
  tempNow,
  tempHigh,
  tempLow,
  dewNow,
  gustMax,
  precipTotal,
  precipHours,
  snowTotal,
  sunrise,
  sunset
}) {
  const bullets = [];

  // 🌡️ Temperature bullets
  if (tempNow <= 32) bullets.push("Cold start — layers feel good this morning 🧥");
  else if (tempNow <= 45) bullets.push("Chilly morning air — a light jacket helps.");
  else if (tempNow <= 55) bullets.push("Cool but comfortable — layers work well.");
  else if (tempHigh >= 75) bullets.push("Warm afternoon ahead — short sleeves weather.");
  else if (tempHigh - tempLow >= 18) bullets.push("Big warm‑up from morning to afternoon.");

  // 💨 Wind bullets
  if (gustMax >= 35) bullets.push("Gusty at times — you’ll notice it 💨");
  else if (gustMax >= 22) bullets.push("A bit breezy this afternoon.");

  // 🌧️ Rain bullets
  if (precipTotal > 0.05) {
    const firstWet = precipHours.findIndex(v => v > 0.02);
    if (firstWet !== -1) {
      const hour = new Date().getHours() + firstWet;
      bullets.push(`Rain may drift in around ${to12Hour(hour)} 🌧️`);
    } else {
      bullets.push("Spotty showers possible later today.");
    }
  }

  // ❄️ Snow bullets
  if (snowTotal > 0.05) {
    if (snowTotal < 0.5) bullets.push("Light snow possible — nothing major ❄️");
    else if (snowTotal < 2) bullets.push("Snow showers may coat colder spots ❄️");
    else bullets.push("Accumulating snow possible — travel may slow down ❄️");
  }

  // 💧 Humidity / comfort bullets
  if (dewNow >= 65) bullets.push("Humidity may feel noticeable at times.");
  else if (dewNow <= 25) bullets.push("Dry air — very comfortable outside.");

  // 🌄 Sunrise / sunset bullets
  if (sunrise && sunrise.length > 0) {
    const sunriseHour = new Date(sunrise[0]).getHours();
    if (new Date().getHours() < sunriseHour) {
      bullets.push(`Sunrise around ${to12Hour(sunriseHour)} — early light.`);
    }
  }

  if (sunset && sunset.length > 0) {
    const sunsetHour = new Date(sunset[0]).getHours();
    if (new Date().getHours() < sunsetHour) {
      bullets.push(`Sunset near ${to12Hour(sunsetHour)} — cooling after.`);
    }
  }

  // 🏔️ Mountain microclimate bullets
  if (gustMax >= 20 && tempHigh <= 55) {
    bullets.push("Cooler on the ridges — breezy in the higher spots.");
  }

  if (precipTotal > 0.05 && tempNow <= 40) {
    bullets.push("Colder hollows may see a brief mix early.");
  }

  if (tempHigh >= 70 && dewNow >= 60) {
    bullets.push("Warm valley feel — a touch muggy in sheltered spots.");
  }

  // De‑duplicate + cap at 3
  const unique = [...new Set(bullets)];
  return unique.slice(0, 3);
}
// ====================================================
// PART 6 — TOMORROW — Human‑Action Outlook (00:00 → 23:59)
// (Planner‑friendly + bullet engine)
// ====================================================
export function getHumanActionOutlook(hourly) {
  const indices = getTomorrowWindow(hourly);

  if (!indices.length) {
    return {
      badge: { text: "No data", class: "badge-neutral" },
      emoji: "❓",
      headline: "Check back later.",
      text: "We couldn’t find a usable forecast window for tomorrow.",
      bullets: []
    };
  }

  const win = sliceHourly(hourly, indices);
  const tempStats = getTempStats(win);
  const dewStats = getDewStats(win);
  const windStats = getWindGustStats(win);
  const precipTotal = getPrecipTotal(win);
  const snowTotal = getSnowTotal(win);

  const avgTemp = tempStats.avg ?? tempStats.max ?? tempStats.min ?? null;
  const gustMax = windStats.max ?? 0;

  const precipDesc = describePrecip(precipTotal, snowTotal);
  const windDesc = describeWind(gustMax);
  const tempDesc = describeTempRange(tempStats);

  const tempHighF = tempStats.max ?? tempStats.avg ?? null;

  const isGoldilocks =
    precipTotal < 0.05 &&
    snowTotal === 0 &&
    gustMax < 26 &&
    avgTemp != null &&
    avgTemp >= 60 &&
    avgTemp <= 75;

  const dominant = getDominantFactor(tempHighF, gustMax, precipTotal, snowTotal);

  const base = mapActionOutcome(
    dominant,
    tempDesc,
    precipDesc,
    windDesc,
    tempHighF,
    isGoldilocks
  );

  const bullets = buildTomorrowBullets({
    win,
    tempStats,
    dewStats,
    windStats,
    precipTotal,
    snowTotal
  });

  return {
    ...base,
    bullets
  };
}

// ====================================================
// TOMORROW BULLET ENGINE — Planner‑friendly
// ====================================================
function buildTomorrowBullets({
  win,
  tempStats,
  dewStats,
  windStats,
  precipTotal,
  snowTotal
}) {
  const bullets = [];

  const maxT = tempStats.max;
  const minT = tempStats.min;
  const avgT = tempStats.avg;
  const maxGust = windStats.max ?? 0;
  const avgDew = dewStats.avg ?? null;
  const precipArr = win.precipitation || [];
  const snowArr = win.snowfall || [];

  // 🌡️ Temperature / planner bullets
  if (maxT != null && minT != null) {
    if (maxT <= 40) bullets.push("Plan for a cold day overall.");
    else if (maxT <= 55) bullets.push("Plan for a cool day overall.");
    else if (maxT <= 72) bullets.push("Expect a mild afternoon.");
    else if (maxT <= 82) bullets.push("Expect a warm afternoon.");
    else bullets.push("Plan for a hot afternoon.");
  }

  // 💧 Humidity / comfort
  if (avgDew != null) {
    if (avgDew >= 65) bullets.push("Humidity may feel noticeable at times.");
    else if (avgDew <= 25) bullets.push("Air stays dry and comfortable.");
  }

  // 💨 Wind
  if (maxGust >= 35) bullets.push("Gusty at times — factor in wind for outdoor plans.");
  else if (maxGust >= 22) bullets.push("A bit breezy, especially in the afternoon.");

  // 🌧️ Rain timing (planner‑friendly)
  const rainTiming = findEventTiming(win, 0, (win.time || []).length - 1, isRain);
  if (precipTotal > 0.05 && rainTiming.firstHour !== null) {
    const phrase = timingPhrase(rainTiming, true);
    bullets.push(`Rain most likely${phrase}.`);
  } else if (precipTotal > 0.05) {
    bullets.push("Scattered showers possible at times.");
  }

  // ❄️ Snow
  const snowTotalTomorrow = snowArr.length
    ? snowArr.reduce((a, b) => a + b, 0)
    : snowTotal;

  if (snowTotalTomorrow > 0.05) {
    if (snowTotalTomorrow < 0.5) bullets.push("Light snow or flurries possible.");
    else if (snowTotalTomorrow < 2) bullets.push("Snow showers may create slick spots.");
    else bullets.push("Accumulating snow could slow travel at times.");
  }

  // 🏔️ Simple mountain microclimate nod
  if (maxGust >= 20 && maxT <= 55) {
    bullets.push("Cooler and breezier on higher ridges.");
  }

  // De‑duplicate + cap at 3
  const unique = [...new Set(bullets)];
  return unique.slice(0, 3);
}
// ----------------------------------------------------
// PART 7 — Comfort Module 2.3 (Personality Edition)
// ----------------------------------------------------

const NORMAL_HIGHS = {
  0: 47, 1: 51, 2: 59, 3: 68, 4: 75, 5: 82,
  6: 85, 7: 84, 8: 78, 9: 69, 10: 59, 11: 50
};

const NORMAL_LOWS = {
  0: 28, 1: 31, 2: 36, 3: 43, 4: 52, 5: 60,
  6: 64, 7: 63, 8: 57, 9: 46, 10: 37, 11: 31
};

function monthName(i) {
  return [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December"
  ][i];
}

// ----------------------------------------------------
// Comfort Category — returns:
// "cold", "cool", "mild", "warm", "hot"
// ----------------------------------------------------
export function getComfortCategory(temp, dew) {
  if (temp == null) return "mild";

  if (temp <= 40) return "cold";
  if (temp <= 55) return "cool";
  if (temp <= 72) return "mild";
  if (temp <= 82) return "warm";
  return "hot";
}

// ----------------------------------------------------
// Comfort Summary — human‑friendly phrasing
// ----------------------------------------------------
export function getComfortSummary(temp, dew) {
  const cat = getComfortCategory(temp, dew);

  switch (cat) {
    case "cold":
      return "Cold feel overall — bundle up.";
    case "cool":
      return "Cool and crisp — light layers feel good.";
    case "mild":
      return "Comfortably mild — easy to be outside.";
    case "warm":
      return "Warm feel — hydration helps.";
    case "hot":
      return "Hot and potentially muggy — take it easy.";
    default:
      return "Comfort details unavailable.";
  }
}

// ----------------------------------------------------
// Seasonal Context — compares forecast to normals
// ----------------------------------------------------
export function getSeasonalContext(tempHigh, tempLow) {
  const m = new Date().getMonth();
  const normalHigh = NORMAL_HIGHS[m];
  const normalLow = NORMAL_LOWS[m];

  let phrases = [];

  if (tempHigh != null) {
    if (tempHigh >= normalHigh + 10) phrases.push("warmer than normal");
    else if (tempHigh <= normalHigh - 10) phrases.push("colder than normal");
  }

  if (tempLow != null) {
    if (tempLow >= normalLow + 10) phrases.push("mild nights for the season");
    else if (tempLow <= normalLow - 10) phrases.push("chilly nights for the season");
  }

  if (!phrases.length) return "Typical for this time of year.";
  return phrases.join(", ") + ".";
}
// ----------------------------------------------------
// PART 8 — Final Utility Helpers
// ----------------------------------------------------

// Goldilocks check (shared)
function isGoldilocks(tempNow, tempHigh) {
  if (tempNow == null || tempHigh == null) return false;
  return (
    tempHigh >= 60 &&
    tempHigh <= 75 &&
    tempNow >= 55 &&
    tempNow <= 78
  );
}

// Simple fallback for missing arrays
function safeArray(arr) {
  return Array.isArray(arr) ? arr : [];
}

// ----------------------------------------------------
// EXPORTS (already exported inline where needed)
// ----------------------------------------------------
// getLowImpactPhrase
// getTodayActionOutlook
// getHumanActionOutlook
// getComfortCategory
// getComfortSummary
// getSeasonalContext

// Everything else is intentionally kept internal.
// ----------------------------------------------------
