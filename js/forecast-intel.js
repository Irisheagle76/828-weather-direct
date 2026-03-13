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
  if (isGoldilocks) {
    return "Goldilocks! Just right!";
  }

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
  if (tempHighF >= 68) {
    pool = warmPhrases;
  } else if (tempHighF <= 55) {
    pool = coolPhrases;
  } else {
    pool = [...coolPhrases, ...warmPhrases];
  }

  const options = pool.filter(p => p !== lastLowImpactPhrase);
  const choice = options[Math.floor(Math.random() * options.length)];
  lastLowImpactPhrase = choice;
  return choice;
}
// Time helpers
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
function getTodayFullWindow(hourly) {
  const now = new Date();
  return getHourlyWindowForDay(hourly, now);
}
function shouldSuppressTempDesc(swing) {
  return swing >= 15 || swing <= -15;
}
function getFallingPrecipSignal(wu, mrms) {
  // wu: { precipRate, precip1hr, conditionIcon, gust }
  // mrms: { rate, type, intensity } // type: "rain" | "snow" | "mix" | "hail"

  const fromWU = wu && wu.precipRate > 0;
  const fromMRMS = mrms && mrms.rate > 0;

  if (!fromWU && !fromMRMS) {
    return { isFalling: false, type: "none", intensity: "none", source: "none" };
  }

  // Prefer MRMS for type/intensity if available
  if (fromMRMS) {
    return {
      isFalling: true,
      type: mrms.type,          // "rain" | "snow" | "mix" | "hail"
      intensity: mrms.intensity, // "light" | "moderate" | "heavy"
      source: fromWU ? "both" : "mrms"
    };
  }

  // Fallback: WU only
  return {
    isFalling: true,
    type: "rain",               // best assumption if only WU rate
    intensity: wu.precipRate > 0.2 ? "moderate" : "light",
    source: "wu"
  };
}
// ============================================================
// Helper: Find tomorrow's 2 PM forecast index
// ============================================================
function getTomorrow2pmIndex(hourly) {
  const now = new Date();
  const target = new Date(now);
  target.setDate(now.getDate() + 1);
  target.setHours(14, 0, 0, 0); // 2 PM tomorrow

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
// Core window selector for any calendar day
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

  // Require at least 6 hours to avoid garbage output
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
  const start = now;

  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  for (let i = 0; i < times.length; i++) {
    const t = new Date(times[i]);
    if (t >= start && t <= end) indices.push(i);
  }

  // Require at least 3 hours to avoid unstable output
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

// Convert an hour index (0–47) to a local hour-of-day (0–23)
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

function findEventTiming(hourly, start, end, conditionFn) {
  let first = null;
  let last = null;

  for (let i = start; i <= end; i++) {
    if (conditionFn(i, hourly)) {
      if (first === null) first = i;
      last = i;
    }
  }

  return {
    firstHour: first,
    lastHour: last
  };
}

// Smarter, less ambiguous timing phrase
function timingPhrase(timing, isTomorrow) {
  if (timing.firstHour === null || timing.lastHour === null) return "";

  const start = timing.firstHour;
  const end = timing.lastHour;
  const duration = end - start + 1;

  const startPart = describeTimeOfDay(start);
  const endPart = describeTimeOfDay(end);

  const dayLabel = isTomorrow ? " tomorrow" : "";

  // All-day or nearly all-day event
  if (duration >= 8 || (startPart === "early morning" && endPart === "evening")) {
    return ` throughout the day${dayLabel}`;
  }

  // Multi-daypart event
  const dayparts = new Set([startPart, endPart]);
  if (dayparts.size >= 3) {
    return ` most of the day${dayLabel}`;
  }

  // True overnight event (late night only)
  const startHourLocal = hourIndexToLocalHour(start);
  const endHourLocal = hourIndexToLocalHour(end);
  if (startHourLocal >= 22 || endHourLocal <= 6) {
    return ` overnight${dayLabel}`;
  }

  // Same daypart
  if (startPart === endPart) {
    return ` ${startPart}${dayLabel}`;
  }

  // Normal range
  return ` from ${startPart}${dayLabel} into ${endPart}${dayLabel}`;
}
// ----------------------------------------------------
// EVENT CONDITION HELPERS — thresholds for each hazard
// ----------------------------------------------------

function isRain(i, hourly) {
  return (hourly.precipitation[i] ?? 0) > 0.02;
}

function isSnow(i, hourly) {
  const amt = hourly.snowfall[i] ?? 0;

  // Ignore flurries and model noise
  if (amt < 0.2) return false;     // < 0.2" = flurries

  // Light snow but not impactful unless it lasts
  if (amt < 0.5) return false;     // 0.2–0.5" = light, non-impactful

  // Meaningful accumulation
  return true;                     // ≥ 0.5" = real snow
}

function isWind(i, hourly) {
  return (hourly.windgusts_10m[i] ?? 0) >= 30;
}

function isFreeze(i, hourly) {
  return (hourly.temperature_2m[i] ?? 999) <= 32;
}

function isHardFreeze(i, hourly) {
  return (hourly.temperature_2m[i] ?? 999) <= 28;
}

function isHeat(i, hourly) {
  return (hourly.temperature_2m[i] ?? 0) >= 88 &&
         (hourly.dewpoint_2m[i] ?? 0) >= 68;
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
// Snow logic
if (snowTotal >= 1.0) return "accumulating snow";
if (snowTotal >= 0.5) return "light accumulating snow";
if (snowTotal >= 0.2) return "a few flurries";
if (snowTotal > 0)   return "a stray flake or two";

  // Rain logic
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

// Temperature descriptor
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
// ----------------------------------------------------
// PART 4 — Human‑Action Outlook
// ----------------------------------------------------
// ====================================================
// TOMORROW — Human‑Action Outlook (00:00 → 23:59)
// ====================================================
export function getHumanActionOutlook(hourly) {
  const indices = getTomorrowWindow(hourly);

  if (!indices.length) {
    return {
      badge: { text: "No data", class: "badge-neutral" },
      emoji: "❓",
      headline: "Check back later.",
      text: "We couldn’t find a usable forecast window for tomorrow."
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

  // NEW — compute high temp for warm/cool phrasing
const tempHighF = tempStats.max ?? tempStats.avg ?? null;

// NEW — compute Goldilocks flag for phrase override
const isGoldilocks =
  precipTotal < 0.05 &&
  snowTotal === 0 &&
  gustMax < 26 &&
  avgTemp != null &&
  avgTemp >= 60 &&
  avgTemp <= 75;

  // -----------------------------
  // IMPACT SCORING
  // -----------------------------
  const drivers = [];

// Snow (impact only for real accumulation)
if (snowTotal >= 0.5) {
  drivers.push({
    type: "snow",
    score: 80 + snowTotal * 10
  });
}

  // Rain (patched logic)
  const precipArr = win.precipitation || [];
  const precipHours = precipArr.filter(p => p >= 0.01).length;

  if (
    snowTotal === 0 && (
      precipTotal >= 0.25 ||               // heavy rain
      precipHours >= 4 ||                  // persistent light rain
      (precipTotal >= 0.10 && precipHours >= 4)  // wet day combo
    )
  ) {
    drivers.push({
      type: "rain",
      score: 55 + (precipTotal * 20) + (precipHours * 2)
    });
  }

  // Wind
  if (gustMax >= 40) {
    drivers.push({
      type: "wind",
      score: 50 + gustMax
    });
  }

  // Heat
  if (avgTemp != null && avgTemp >= 88) {
    drivers.push({
      type: "heat",
      score: 55 + (avgTemp - 88) * 2
    });
  }

  // Cold
  if (avgTemp != null && avgTemp <= 35) {
    drivers.push({
      type: "cold",
      score: 55 + (35 - avgTemp) * 2
    });
  }

  // Goldilocks
  if (
    precipTotal < 0.05 &&
    snowTotal === 0 &&
    gustMax < 26 &&
    avgTemp != null &&
    avgTemp >= 60 &&
    avgTemp <= 75
  ) {
    drivers.push({
      type: "goldilocks",
      score: 40
    });
  }

  // Default
  if (!drivers.length) {
    drivers.push({ type: "easy", score: 10 });
  }

  drivers.sort((a, b) => b.score - a.score);
  const dominant = drivers[0].type;
// ============================================================
// ⭐ Temperature Swing Add‑On
// Today’s high → Tomorrow’s 2 PM temperature
// ============================================================
let finalTempDesc = tempDesc;

try {
  // 1. Compute today's true high using the full calendar day
  const todayIndices = getTodayFullWindow(hourly);
  const todayWin = sliceHourly(hourly, todayIndices);
  const todayTempStats = getTempStats(todayWin);
  const todayHigh = todayTempStats.max ?? todayTempStats.avg ?? null;

  // 2. Find tomorrow's 2 PM temperature
  const idx2pm = getTomorrow2pmIndex(hourly);
  const tomorrow2pmTemp = hourly.temperature_2m[idx2pm];

  // 3. Compute swing
  const swing = tomorrow2pmTemp - todayHigh;

  // 4. Human‑friendly swing phrasing (no numbers)
  let swingPhrase = "";

  if (swing >= 15) {
    swingPhrase = "Much warmer than today — a noticeable warm‑up.";
  } else if (swing >= 8) {
    swingPhrase = "A warmer day ahead — feels more comfortable.";
  } else if (swing >= 4) {
    swingPhrase = "A slight warm‑up.";
  } else if (swing <= -15) {
    swingPhrase = "A big temperature drop — much colder than today.";
  } else if (swing <= -8) {
    swingPhrase = "Noticeably cooler than today.";
  } else if (swing <= -4) {
    swingPhrase = "A slight cooldown.";
  } else {
    swingPhrase = "Temperatures stay about the same.";
  }

  // 5. Suppress temperature descriptor if swing is major
  if (shouldSuppressTempDesc(swing)) {
    finalTempDesc = "";
  }

  // 6. Merge swing phrase into the reason text
  if (swingPhrase) {
const base = mapActionOutcome(dominant, finalTempDesc, precipDesc, windDesc);

// Clean + lowercase wind phrase
let windLower = base.text
  .trim()
  .replace(/\.*\s*$/, "")        // remove trailing periods + spaces
  .replace(/^([A-Z])/, m => m.toLowerCase());  // lowercase first letter

// Build final merged sentence
let merged = windLower + ` with ${swingPhrase.charAt(0).toLowerCase() + swingPhrase.slice(1)}`;

// Capitalize the final output
merged = merged.charAt(0).toUpperCase() + merged.slice(1);

return {
  ...base,
  text: merged
};
  }

} catch (err) {
  console.warn("Temp swing calculation failed:", err);
}

// -----------------------------
// ACTION MAPPING
// -----------------------------
return mapActionOutcome(
  dominant,
  finalTempDesc,
  precipDesc,
  windDesc,
  tempHighF,
  isGoldilocks
);
}

// ====================================================
// TODAY — Human‑Action Outlook (Now → Midnight)
// ====================================================
export function getTodayActionOutlook(hourly) {
  const indices = getTodayRemainingWindow(hourly);
if (!indices.length) {
  return {
    badge: { text: "No Hazards", class: "badge-easy" },
    emoji: "🌙",
    headline: "The day is winding down.",
    text: "No more meaningful weather impacts expected tonight.",
    suppressMicroAdvice: true,
    isEndOfDay: true
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
  
// NEW — compute high temp for warm/cool phrasing
const tempHighF = tempStats.max ?? tempStats.avg ?? null;

// NEW — compute Goldilocks flag for phrase override
const isGoldilocks =
  precipTotal < 0.05 &&
  snowTotal === 0 &&
  gustMax < 26 &&
  avgTemp != null &&
  avgTemp >= 60 &&
  avgTemp <= 75;

  // -----------------------------
  // IMPACT SCORING (same as Tomorrow)
  // -----------------------------
  const drivers = [];

  // Snow
  if (snowTotal > 0.05) {
    drivers.push({
      type: "snow",
      score: 80 + snowTotal * 10
    });
  }

  // Rain (patched logic)
  const precipArr = win.precipitation || [];
  const precipHours = precipArr.filter(p => p >= 0.01).length;

  if (
    snowTotal === 0 && (
      precipTotal >= 0.25 ||
      precipHours >= 4 ||
      (precipTotal >= 0.10 && precipHours >= 4)
    )
  ) {
    drivers.push({
      type: "rain",
      score: 55 + (precipTotal * 20) + (precipHours * 2)
    });
  }

  // Wind
  if (gustMax >= 40) {
    drivers.push({
      type: "wind",
      score: 50 + gustMax
    });
  }

  // Heat
  if (avgTemp != null && avgTemp >= 88) {
    drivers.push({
      type: "heat",
      score: 55 + (avgTemp - 88) * 2
    });
  }

  // Cold
  if (avgTemp != null && avgTemp <= 35) {
    drivers.push({
      type: "cold",
      score: 55 + (35 - avgTemp) * 2
    });
  }

  // Goldilocks
  if (
    precipTotal < 0.05 &&
    snowTotal === 0 &&
    gustMax < 26 &&
    avgTemp != null &&
    avgTemp >= 60 &&
    avgTemp <= 75
  ) {
    drivers.push({
      type: "goldilocks",
      score: 40
    });
  }

  // Default
  if (!drivers.length) {
    drivers.push({ type: "easy", score: 10 });
  }

  drivers.sort((a, b) => b.score - a.score);
  const dominant = drivers[0].type;

  // -----------------------------
  // ACTION MAPPING (shared)
  // -----------------------------
return mapActionOutcome(
  dominant,
  tempDesc,
  precipDesc,
  windDesc,
  tempHighF,
  isGoldilocks
);
}

// ====================================================
// SHARED ACTION MAPPING FUNCTION
// ====================================================
function mergePhrases(...parts) {
  const cleaned = parts
    .filter(Boolean)
    .map((p, i) => {
      let s = p.trim();

      // Remove trailing punctuation
      s = s.replace(/[.,]+$/, "");

      // Remove leading "Expect"
      s = s.replace(/^Expect\s+/i, "");

      // Add missing nouns for dryness
      if (/^mainly dry$/i.test(s)) s = "mainly dry conditions";

      // Normalize wind phrasing
      s = s.replace(/light wind$/i, "light winds")
           .replace(/generally light wind$/i, "generally light winds")
           .replace(/quite gusty$/i, "quite gusty winds")
           .replace(/very windy$/i, "very windy conditions");

      // Lowercase first letter of secondary phrases
      if (i > 0) {
        s = s.charAt(0).toLowerCase() + s.slice(1);
      }

      return s;
    });

  if (cleaned.length === 0) return "";

  const [first, ...rest] = cleaned;

  if (rest.length === 0) return first;

  return first + " with " + rest.join(" and ");
}

function mapActionOutcome(dominant, tempDesc, precipDesc, windDesc, tempHighF, isGoldilocks) {
  let badgeText = "No Hazards";
  let badgeClass = "badge-easy";
  let emoji = "🙂";
 
  // Default merged reason
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
  action = getLowImpactPhrase(tempHighF, isGoldilocks);
  break;
  }

  return {
    badge: { text: badgeText, class: badgeClass },
    emoji,
    headline: action,
    text: reason
  };
}
// ----------------------------------------------------
// PART 5 — Comfort Module 2.3 (Personality Edition)
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

export function getComfortCategory(temp, dew, gust, precip = 0) {
  const now = new Date();

  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hour12: false,
      timeZone: "America/New_York"
    }).format(now)
  );

  const month = now.getMonth();

  // Goldilocks check
  const isGoldilocks =
    temp >= 68 && temp <= 74 &&
    dew >= 45 && dew <= 52 &&
    gust < 25 &&
    precip < 0.02;

  if (isGoldilocks) {
    return { text: "Goldilocks — just right.", emoji: "🌟" };
  }

  // Temperature feel
  let feel;
  if (temp <= 25) feel = "biting";
  else if (temp <= 40) feel = "cold";
  else if (temp <= 48) feel = "chilly";
  else if (temp <= 58) feel = "cool";
  else if (temp <= 70) feel = "mild";
  else if (temp <= 82) feel = "warm";
  else feel = "hot";

  // Nuance (dewpoint + wind)
  let nuance = "";
  if (dew >= 65) nuance = "humid";
  else if (dew < 40) nuance = "crisp";

  if (gust >= 40) nuance = "windy";
  else if (gust >= 30) nuance = "breezy";

  const personality = getPersonalityPhrase(feel, nuance);

  // Compare to climatological normals
  const normal = (hour < 11 || hour >= 18)
    ? NORMAL_LOWS[month]
    : NORMAL_HIGHS[month];

  const diff = temp - normal;

  let anomalyNote = "";
  if (diff >= 20) {
    anomalyNote = ` — warmer than usual for ${monthName(month)} at this time of day`;
  } else if (diff >= 12) {
    anomalyNote = ` — a bit warmer than normal at this hour`;
  } else if (diff <= -20) {
    anomalyNote = ` — colder than usual for ${monthName(month)} at this time of day`;
  } else if (diff <= -12) {
    anomalyNote = ` — a bit colder than normal at this hour`;
  }

  return {
    text: personality + anomalyNote,
    emoji: comfortEmoji(feel)
  };
}

function getPersonalityPhrase(feel, nuance) {
  if (feel === "biting") {
    if (nuance === "windy") return "Biting cold — the kind that wakes you up whether you want it to or not";
    return "Biting cold — bundle up, friend";
  }

  if (feel === "cold") {
    if (nuance === "breezy") return "Cold with a side of breeze — nature’s way of saying ‘layer up, friend.’";
    if (nuance === "crisp") return "Cold and crisp — that clean mountain chill";
    return "Cold — definitely jacket weather";
  }

  if (feel === "chilly") {
    return "Chilly but manageable — jacket weather, not misery weather";
  }

  if (feel === "cool") {
    if (nuance === "breezy") return "Cool and breezy — a light jacket and a good attitude";
    if (nuance === "crisp") return "Cool and crisp — clean, refreshing, no nonsense";
    if (nuance === "humid") return "Cool but muggy — a strange combo, but here we are";
    return "Cool — refreshing and easygoing";
  }

  if (feel === "mild") {
    if (nuance === "breezy") return "Mild with a breeze — windows‑down weather";
    if (nuance === "humid") return "Mild but muggy — a little clingy, but still friendly";
    return "Mild and calm — easygoing, like Asheville on a Sunday";
  }

  if (feel === "warm") {
    if (nuance === "breezy") return "Warm with a breeze — nature’s version of air‑conditioning";
    if (nuance === "humid") return "Yuck! Air you can wear";
    return "Warm and pleasant — Asheville at its friendliest";
  }

  if (feel === "hot") {
    if (nuance === "humid") return "Tropical jungle heat — welcome to the steam room";
    if (nuance === "breezy") return "Hot with a breeze — still hot, but at least it’s trying";
    return "Hot and dry — sun‑baked and sharp";
  }

  return "Comfort unknown";
}

function comfortEmoji(feel) {
  switch (feel) {
    case "biting": return "🥶";
    case "cold": return "❄️";
    case "chilly": return "🧥";
    case "cool": return "🍃";
    case "mild": return "🙂";
    case "warm": return "🌤️";
    case "hot": return "🔥";
    default: return "🌡️";
  }
}
// ----------------------------------------------------
// PART 6 — Forecast Alerts (with past‑event filtering)
// ----------------------------------------------------

export function getForecastAlerts(hourly) {
  const alerts = [];

  // Index-only windows:
  const todayStart = 0;
  const todayEnd = 23;
  const tomorrowStart = 24;
  const tomorrowEnd = 47;

  // ----------------------------------------------------
  // Helper: determine if an event is already over
  // ----------------------------------------------------
  function isEventObsolete(timing) {
    if (timing.firstHour === null || timing.lastHour === null) return true;

    const eventEnd = new Date(hourly.time[timing.lastHour]).getTime();
    const now = Date.now();
    return eventEnd < now;
  }

  // ----------------------------------------------------
  // RAIN
  // ----------------------------------------------------
  const rainToday = findEventTiming(hourly, todayStart, todayEnd, isRain);
  const rainTomorrow = findEventTiming(hourly, tomorrowStart, tomorrowEnd, isRain);

  if (rainToday.firstHour !== null && !isEventObsolete(rainToday)) {
    alerts.push({
      id: "rain-today",
      icon: "🌧️",
      title: "Rain Expected Today",
      detail: `Rain likely${timingPhrase(rainToday, false)}. Roads may become wet and visibility reduced.`
    });
  }

  if (rainTomorrow.firstHour !== null && !isEventObsolete(rainTomorrow)) {
    alerts.push({
      id: "rain-tomorrow",
      icon: "🌧️",
      title: "Rain Expected Tomorrow",
      detail: `Rain likely${timingPhrase(rainTomorrow, true)}. Plan for wet conditions and slower travel.`
    });
  }

  // ----------------------------------------------------
  // SNOW
  // ----------------------------------------------------
  const snowToday = findEventTiming(hourly, todayStart, todayEnd, isSnow);
  const snowTomorrow = findEventTiming(hourly, tomorrowStart, tomorrowEnd, isSnow);

  if (snowToday.firstHour !== null && !isEventObsolete(snowToday)) {
    alerts.push({
      id: "snow-today",
      icon: "❄️",
      title: "Snow Today",
      detail: `Snowfall expected${timingPhrase(snowToday, false)}. Roads may become slick.`
    });
  }

  if (
    snowTomorrow.firstHour !== null &&
    !isEventObsolete(snowTomorrow) &&
    getSnowTotal(sliceHourly(hourly, getTomorrowWindow(hourly))) >= 0.5
  ) {
    alerts.push({
      id: "snow-tomorrow",
      icon: "❄️",
      title: "Snow Tomorrow",
      detail: `Snowfall expected${timingPhrase(snowTomorrow, true)}. Allow extra travel time.`
    });
  }

  // ----------------------------------------------------
  // WIND
  // ----------------------------------------------------
  const windToday = findEventTiming(hourly, todayStart, todayEnd, isWind);
  const windTomorrow = findEventTiming(hourly, tomorrowStart, tomorrowEnd, isWind);

  if (windToday.firstHour !== null && !isEventObsolete(windToday)) {
    alerts.push({
      id: "wind-today",
      icon: "💨",
      title: "Windy Today",
      detail: `Gusty winds expected${timingPhrase(windToday, false)}. Secure loose outdoor items.`
    });
  }

  if (windTomorrow.firstHour !== null && !isEventObsolete(windTomorrow)) {
    alerts.push({
      id: "wind-tomorrow",
      icon: "💨",
      title: "Windy Tomorrow",
      detail: `Strong winds expected${timingPhrase(windTomorrow, true)}. Outdoor items may blow around.`
    });
  }

  // ----------------------------------------------------
  // FREEZE / HARD FREEZE
  // ----------------------------------------------------
  const freezeToday = findEventTiming(hourly, todayStart, todayEnd, isFreeze);
  const freezeTomorrow = findEventTiming(hourly, tomorrowStart, tomorrowEnd, isFreeze);

  const hardFreezeToday = findEventTiming(hourly, todayStart, todayEnd, isHardFreeze);
  const hardFreezeTomorrow = findEventTiming(hourly, tomorrowStart, tomorrowEnd, isHardFreeze);

  if (hardFreezeToday.firstHour !== null && !isEventObsolete(hardFreezeToday)) {
    alerts.push({
      id: "hardfreeze-today",
      icon: "🥶",
      title: "Hard Freeze Today",
      detail: `Temperatures may fall below 28°F${timingPhrase(hardFreezeToday, false)}. Protect pipes and sensitive plants.`
    });
  } else if (freezeToday.firstHour !== null && !isEventObsolete(freezeToday)) {
    alerts.push({
      id: "freeze-today",
      icon: "❄️",
      title: "Freeze Today",
      detail: `Temperatures may fall to freezing${timingPhrase(freezeToday, false)}. Cover plants and bring pets indoors.`
    });
  }

  if (hardFreezeTomorrow.firstHour !== null && !isEventObsolete(hardFreezeTomorrow)) {
    alerts.push({
      id: "hardfreeze-tomorrow",
      icon: "🥶",
      title: "Hard Freeze Tomorrow",
      detail: `Temperatures may fall below 28°F${timingPhrase(hardFreezeTomorrow, true)}. Protect pipes and sensitive plants.`
    });
  } else if (freezeTomorrow.firstHour !== null && !isEventObsolete(freezeTomorrow)) {
    alerts.push({
      id: "freeze-tomorrow",
      icon: "❄️",
      title: "Freeze Tomorrow",
      detail: `Temperatures may fall to freezing${timingPhrase(freezeTomorrow, true)}. Cover plants and bring pets indoors.`
    });
  }

  // ----------------------------------------------------
  // HEAT / HUMIDITY
  // ----------------------------------------------------
  const heatToday = findEventTiming(hourly, todayStart, todayEnd, isHeat);
  const heatTomorrow = findEventTiming(hourly, tomorrowStart, tomorrowEnd, isHeat);

  if (heatToday.firstHour !== null && !isEventObsolete(heatToday)) {
    alerts.push({
      id: "heat-today",
      icon: "🥵",
      title: "Heat & Humidity Today",
      detail: `Hot and humid conditions${timingPhrase(heatToday, false)}. Stay hydrated and limit strenuous activity during peak heat.`
    });
  }

  if (heatTomorrow.firstHour !== null && !isEventObsolete(heatTomorrow)) {
    alerts.push({
      id: "heat-tomorrow",
      icon: "🥵",
      title: "Heat & Humidity Tomorrow",
      detail: `Hot and humid conditions${timingPhrase(heatTomorrow, true)}. Plan for extra water and shade if you’ll be outside.`
    });
  }

  return alerts;
}
// ----------------------------------------------------
// PART 7 — Default Export Bundle
// ----------------------------------------------------

export default {
  getHumanActionOutlook,   // Tomorrow
  getTodayActionOutlook,   // Today (Now → Midnight)
  getComfortCategory,      // Right Now Comfort
  getForecastAlerts        // Tomorrow Alerts
};
