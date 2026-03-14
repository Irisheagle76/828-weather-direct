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

function getTodayFullWindow(hourly) {
  const now = new Date();
  return getHourlyWindowForDay(hourly, now);
}

function shouldSuppressTempDesc(swing) {
  return swing >= 15 || swing <= -15;
}

function getFallingPrecipSignal(wu, mrms) {
  const fromWU = wu && wu.precipRate > 0;
  const fromMRMS = mrms && mrms.rate > 0;

  if (!fromWU && !fromMRMS) {
    return { isFalling: false, type: "none", intensity: "none", source: "none" };
  }

  if (fromMRMS) {
    return {
      isFalling: true,
      type: mrms.type,
      intensity: mrms.intensity,
      source: fromWU ? "both" : "mrms"
    };
  }

  return {
    isFalling: true,
    type: "rain",
    intensity: wu.precipRate > 0.2 ? "moderate" : "light",
    source: "wu"
  };
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

  // True overnight event
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

  if (amt < 0.2) return false;     // flurries
  if (amt < 0.5) return false;     // light, non-impactful
  return true;                     // ≥ 0.5" meaningful
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
  return (
    (hourly.temperature_2m[i] ?? 0) >= 88 &&
    (hourly.dewpoint_2m[i] ?? 0) >= 68
  );
}
// ----------------------------------------------------
// PART 3 — Stats + Derived Metrics
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
// PART 4 — Descriptors + Simple Impact Helpers
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

  // High temp for warm/cool phrasing
  const tempHighF = tempStats.max ?? tempStats.avg ?? null;

  // Goldilocks override
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
    snowTotal === 0 &&
    (
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
  if (isGoldilocks) {
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
  // Temperature Swing Add‑On
  // Today’s high → Tomorrow’s 2 PM temperature
  // ============================================================
  let finalTempDesc = tempDesc;

  try {
    // 1. Compute today's true high
    const todayIndices = getTodayFullWindow(hourly);
    const todayWin = sliceHourly(hourly, todayIndices);
    const todayTempStats = getTempStats(todayWin);
    const todayHigh = todayTempStats.max ?? todayTempStats.avg ?? null;

    // 2. Tomorrow's 2 PM temperature
    const idx2pm = getTomorrow2pmIndex(hourly);
    const tomorrow2pmTemp = hourly.temperature_2m[idx2pm];

    // 3. Compute swing
    const swing = tomorrow2pmTemp - todayHigh;

    // 4. Human‑friendly swing phrasing
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

    // 5. Suppress temp descriptor if swing is major
    if (shouldSuppressTempDesc(swing)) {
      finalTempDesc = "";
    }

    // 6. Merge swing phrase into the reason text
    if (swingPhrase) {
      const base = mapActionOutcome(
        dominant,
        finalTempDesc,
        precipDesc,
        windDesc,
        tempHighF,
        isGoldilocks
      );

      let windLower = base.text
        .trim()
        .replace(/\.*\s*$/, "")
        .replace(/^([A-Z])/, m => m.toLowerCase());

      let merged = windLower + ` with ${swingPhrase.charAt(0).toLowerCase() + swingPhrase.slice(1)}`;
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
  // ACTION MAPPING (shared)
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

  // End‑of‑day fallback
  if (!indices.length) {
    return {
      badge: { text: "No Hazards", class: "badge-easy" },
      emoji: "🌙",
      headline: "The day is winding down.",
      text: {
        main: "No more meaningful weather impacts expected tonight.",
        actions: []
      },
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

  // High temp for warm/cool phrasing
  const tempHighF = tempStats.max ?? tempStats.avg ?? null;

  // Goldilocks override
  const isGoldilocks =
    precipTotal < 0.05 &&
    snowTotal === 0 &&
    gustMax < 26 &&
    avgTemp != null &&
    avgTemp >= 60 &&
    avgTemp <= 75;

  // ⭐ NEW — Clothing guidance (correct placement)
  const clothingAdvice = buildClothingAdvice({
    tempStats,
    precipDesc,
    windDesc,
    avgTemp,
    gustMax
  });

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
    snowTotal === 0 &&
    (
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
  if (isGoldilocks) {
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
  const base = mapActionOutcome(
    dominant,
    tempDesc,
    precipDesc,
    windDesc,
    tempHighF,
    isGoldilocks
  );

  // -----------------------------
  // ⭐ Build Today text (main + bullets)
  // -----------------------------
  const todayText = buildTodayText({
    tempDesc,
    precipDesc,
    windDesc,
    clothing: clothingAdvice,
    isGoldilocks
  });

  return {
    ...base,
    text: todayText
  };
}
// ===============================================
// TODAY ACTION OUTLOOK (with warm human bullets)
// ===============================================
export function getTodayActionOutlook(hourly) {
  const now = new Date();
  const currentHour = now.getHours();

  // Pull key stats
  const temps = hourly.temperature_2m;
  const gusts = hourly.windgusts_10m;
  const precip = hourly.precipitation;

  const tempNow = temps[currentHour];
  const tempHigh = Math.max(...temps.slice(currentHour, currentHour + 12));
  const tempLow = Math.min(...temps.slice(currentHour, currentHour + 12));

  const gustMax = Math.max(...gusts.slice(currentHour, currentHour + 12));
  const precipTotal = precip.slice(currentHour, currentHour + 12).reduce((a, b) => a + b, 0);

  // Determine dominant factor (existing logic)
  const dominant = getDominantFactor(tempHigh, gustMax, precipTotal);

  // Get the base outcome (emoji, headline, text)
  const base = mapActionOutcome(
    dominant,
    describeTemp(tempNow, tempHigh),
    describePrecip(precipTotal),
    describeWind(gustMax),
    tempHigh,
    isGoldilocks(tempNow, tempHigh)
  );

  // Build bullets
  const bullets = buildTodayBullets({
    tempNow,
    tempHigh,
    tempLow,
    gustMax,
    precipTotal,
    precipHours: precip.slice(currentHour, currentHour + 12)
  });

  return {
    ...base,
    bullets,
    suppressMicroAdvice: false
  };
}

// ===============================================
// BULLET ENGINE — Warm, human, Asheville‑friendly
// ===============================================
function buildTodayBullets({ tempNow, tempHigh, tempLow, gustMax, precipTotal, precipHours }) {
  const bullets = [];

  // 🌡️ Temperature bullets
  if (tempNow <= 40) bullets.push("Chilly start — a light jacket feels good.");
  else if (tempNow <= 50) bullets.push("Cool morning air — layers help.");
  else if (tempHigh >= 75) bullets.push("Warm afternoon ahead — short sleeves weather.");

  // 💨 Wind bullets
  if (gustMax >= 30) bullets.push("Gusty at times — you’ll notice it 💨");
  else if (gustMax >= 20) bullets.push("A bit breezy this afternoon.");

  // 🌧️ Rain bullets
  if (precipTotal > 0.05) {
    const firstWet = precipHours.findIndex(v => v > 0.02);
    if (firstWet !== -1) {
      const hour = new Date().getHours() + firstWet;
      const label = to12Hour(hour);
      bullets.push(`Rain may drift in around ${label} 🌧️`);
    } else {
      bullets.push("Spotty showers possible later today.");
    }
  }

  // 🌡️ Temperature swing
  if (tempHigh - tempLow >= 18) {
    bullets.push("Big warm‑up from morning to afternoon.");
  }

  // Remove duplicates
  const unique = [...new Set(bullets)];

  // Limit to 3 bullets max
  return unique.slice(0, 3);
}
// ----------------------------------------------------
// Clothing Logic (shared)
// ----------------------------------------------------
function buildClothingAdvice({ tempStats, precipDesc, windDesc, avgTemp, gustMax }) {
  const actions = [];

  // Cold logic
  if (avgTemp <= 45) actions.push("A jacket will feel good");
  if (avgTemp <= 32) actions.push("Bundle up — it’ll feel cold");

  // Warm logic
  if (avgTemp >= 78) actions.push("Hydration important");
  if (avgTemp >= 85) actions.push("Light, breathable clothing recommended");

  // Rain logic
  if (precipDesc && precipDesc.includes("rain")) {
    actions.push("Rain gear recommended");
  }

  // Wind logic
  if (gustMax >= 25) actions.push("A windbreaker will help");

  return actions[0] || "";
}
// ----------------------------------------------------
// TODAY TEXT BUILDER — main sentence + bullet actions
// ----------------------------------------------------
function buildTodayText({ tempDesc, precipDesc, windDesc, clothing, isGoldilocks }) {
  const phrases = [];

  // Goldilocks override
  if (isGoldilocks) {
    phrases.push("A comfortable, easygoing day with ideal temperatures.");
  } else {
    if (tempDesc) phrases.push(tempDesc);
  }

  // Precipitation
  if (precipDesc && precipDesc !== "mainly dry") {
    phrases.push(precipDesc);
  }

  // Wind
  if (windDesc && windDesc !== "Generally light wind") {
    phrases.push(windDesc);
  }

  // Merge into polished English
  const merged = mergePhrases(...phrases);
  const main = merged.charAt(0).toUpperCase() + merged.slice(1) + ".";

  // Bullet list
  const actions = [];

  if (clothing) actions.push(clothing);
  if (precipDesc.includes("rain")) actions.push("Rain gear recommended");
  if (windDesc.toLowerCase().includes("gust")) actions.push("Windbreaker helpful");
  if (tempDesc.includes("hot") || tempDesc.includes("warm")) actions.push("Hydration important");

  return { main, actions };
}

// ----------------------------------------------------
// SHARED PHRASE MERGER
// ----------------------------------------------------
function mergePhrases(...parts) {
  const cleaned = parts
    .filter(Boolean)
    .map((p, i) => {
      let s = p.trim();

      // Remove trailing punctuation
      s = s.replace(/[.,]+$/, "");

      // Remove leading "Expect"
      s = s.replace(/^Expect\s+/i, "");

      // Normalize dryness
      if (/^mainly dry$/i.test(s)) s = "mainly dry conditions";

      // Normalize wind phrasing
      s = s
        .replace(/light wind$/i, "light winds")
        .replace(/generally light wind$/i, "generally light winds")
        .replace(/quite gusty$/i, "quite gusty winds")
        .replace(/very windy$/i, "very windy conditions");

      // Lowercase secondary phrases
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

  // Default low‑impact phrase
  let action = getLowImpactPhrase(tempHighF, isGoldilocks);

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
      // Keep the rotated low‑impact phrase
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

  return "Comfortable";
}

function comfortEmoji(feel) {
  switch (feel) {
    case "biting": return "🥶";
    case "cold": return "🧥";
    case "chilly": return "🧣";
    case "cool": return "🍃";
    case "mild": return "🙂";
    case "warm": return "🌤️";
    case "hot": return "🥵";
    default: return "🙂";
  }
}
