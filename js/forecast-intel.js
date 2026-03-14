// ============================================================
// forecast-intel.js (Option A Edition)
// Full rewrite — Section 1 of 4
// Core Helpers + Stats + Descriptors + Dominant Factor
// ============================================================

// ------------------------------------------------------------
// BASIC HELPERS
// ------------------------------------------------------------
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function avg(arr) {
  if (!arr || !arr.length) return null;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function toLocalDate(isoString) {
  return new Date(isoString);
}

function to12Hour(hour) {
  const h = hour % 12 || 12;
  const suffix = hour >= 12 ? "PM" : "AM";
  return `${h} ${suffix}`;
}

// ------------------------------------------------------------
// TIME + WINDOW HELPERS
// ------------------------------------------------------------
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

function getTomorrowWindow(hourly) {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);

  const indices = getHourlyWindowForDay(hourly, tomorrow);
  if (indices.length < 6) return [];
  return indices;
}

function sliceHourly(hourly, indices) {
  const result = {};
  for (const key of Object.keys(hourly)) {
    const arr = hourly[key];
    if (!Array.isArray(arr)) continue;
    result[key] = indices.map(i => arr[i]);
  }
  return result;
}

// ------------------------------------------------------------
// STATS HELPERS
// ------------------------------------------------------------
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

  return { min, max, avg: sum / arr.length };
}

function getTempStats(win) {
  return basicStats(win.temperature_2m || []);
}

function getDewStats(win) {
  return basicStats(win.dewpoint_2m || []);
}

function getWindStats(win) {
  return basicStats(win.windgusts_10m || []);
}

function getPrecipTotal(win) {
  const arr = win.precipitation || [];
  return arr.length ? arr.reduce((a, b) => a + b, 0) : 0;
}

function getSnowTotal(win) {
  const arr = win.snowfall || [];
  return arr.length ? arr.reduce((a, b) => a + b, 0) : 0;
}

// ------------------------------------------------------------
// DESCRIPTORS
// ------------------------------------------------------------
function describePrecip(precipTotal, snowTotal) {
  if (snowTotal >= 1.0) return "accumulating snow";
  if (snowTotal >= 0.5) return "light accumulating snow";
  if (snowTotal >= 0.2) return "a few flurries";
  if (snowTotal > 0)   return "a stray flake or two";

  if (precipTotal < 0.02) return "mainly dry conditions";
  if (precipTotal < 0.10) return "a few light showers";
  if (precipTotal < 0.25) return "on-and-off showers";
  if (precipTotal < 0.75) return "a soaking rain at times";
  return "periods of heavy rain";
}

function describeWind(gustMax) {
  if (gustMax >= 45) return "very windy conditions";
  if (gustMax >= 40) return "quite gusty winds";
  if (gustMax >= 35) return "breezy at times";
  if (gustMax >= 30) return "a light breeze";
  return "generally light winds";
}

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

function describeTemp(tempNow, tempHigh) {
  if (tempHigh <= 40) return "a cold day overall";
  if (tempHigh <= 55) return "a cool day overall";
  if (tempHigh <= 72) return "a mild day overall";
  if (tempHigh <= 82) return "a warm day overall";
  return "a hot day overall";
}

// ------------------------------------------------------------
// PHRASE MERGER (shared)
// ------------------------------------------------------------
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

// ------------------------------------------------------------
// DOMINANT FACTOR SCORING
// ------------------------------------------------------------
function getDominantFactor(tempHigh, gustMax, precipTotal, snowTotal) {
  const drivers = [];

  if (snowTotal >= 0.5) {
    drivers.push({ type: "snow", score: 80 + snowTotal * 10 });
  }

  if (snowTotal === 0 && precipTotal >= 0.10) {
    drivers.push({ type: "rain", score: 55 + precipTotal * 20 });
  }

  if (gustMax >= 40) {
    drivers.push({ type: "wind", score: 50 + gustMax });
  }

  if (tempHigh >= 88) {
    drivers.push({ type: "heat", score: 55 + (tempHigh - 88) * 2 });
  }

  if (tempHigh <= 35) {
    drivers.push({ type: "cold", score: 55 + (35 - tempHigh) * 2 });
  }

  if (
    precipTotal < 0.05 &&
    snowTotal === 0 &&
    gustMax < 26 &&
    tempHigh >= 60 &&
    tempHigh <= 75
  ) {
    drivers.push({ type: "goldilocks", score: 40 });
  }

  if (!drivers.length) return "easy";

  drivers.sort((a, b) => b.score - a.score);
  return drivers[0].type;
}
// ============================================================
// PART 2 — TODAY — Human‑Action Outlook (Option A)
// ============================================================

// Clothing helper — returns a short phrase or null
function getClothingAdviceToday(tempNow, tempHigh, dewNow, gustMax) {
  const advice = [];

  if (tempNow <= 32) advice.push("warm layers recommended");
  else if (tempNow <= 45) advice.push("a jacket helps early");
  else if (tempHigh >= 75) advice.push("short sleeves feel good");
  else if (tempHigh - tempNow >= 18) advice.push("layers helpful with the warm‑up");

  if (gustMax >= 30) advice.push("wind‑resistant layers useful");
  if (dewNow >= 65) advice.push("light, breathable clothing helps");

  if (!advice.length) return null;

  // Return a single merged clothing phrase
  return advice[0];
}

// ------------------------------------------------------------
// TODAY ACTION OUTLOOK (Option A)
// ------------------------------------------------------------
export function getTodayActionOutlook(hourly) {
  const indices = getTodayRemainingWindow(hourly);

  // END‑OF‑DAY OVERRIDE
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
  const snow = hourly.snowfall || [];

  const tempNow = temps[currentHour];
  const tempHigh = Math.max(...temps.slice(currentHour, currentHour + 12));
  const tempLow = Math.min(...temps.slice(currentHour, currentHour + 12));

  const dewNow = dew[currentHour];
  const gustMax = Math.max(...gusts.slice(currentHour, currentHour + 12));
  const precipTotal = precip.slice(currentHour, currentHour + 12).reduce((a, b) => a + b, 0);
  const snowTotal = snow.slice(currentHour, currentHour + 12).reduce((a, b) => a + b, 0);

  // Dominant factor
  const dominant = getDominantFactor(tempHigh, gustMax, precipTotal, snowTotal);

  // Base descriptors
  const tempDesc = describeTemp(tempNow, tempHigh);
  const precipDesc = describePrecip(precipTotal, snowTotal);
  const windDesc = describeWind(gustMax);

  // Clothing logic (A2)
  const clothing = getClothingAdviceToday(tempNow, tempHigh, dewNow, gustMax);

  // Build main sentence (Option A)
  let mainSentence = mergePhrases(tempDesc, precipDesc, windDesc);
  if (clothing && (dominant === "cold" || dominant === "heat" || dominant === "wind")) {
    mainSentence = mergePhrases(mainSentence, clothing);
  }
  mainSentence = mainSentence.charAt(0).toUpperCase() + mainSentence.slice(1) + ".";

  // Emoji + headline (unchanged)
  let emoji = "🙂";
  let headline = "A straightforward day.";

  switch (dominant) {
    case "snow":
      emoji = "❄️";
      headline = "Allow extra travel time.";
      break;
    case "rain":
      emoji = "🌧️";
      headline = "Bring a rain jacket.";
      break;
    case "wind":
      emoji = "💨";
      headline = "Secure loose outdoor items.";
      break;
    case "heat":
      emoji = "🥵";
      headline = "Stay hydrated.";
      break;
    case "cold":
      emoji = "🥶";
      headline = "Dress in warm layers.";
      break;
    case "goldilocks":
      emoji = "🌟";
      headline = "Make outdoor plans.";
      break;
    default:
      emoji = "🙂";
      headline = "A calm, easygoing day.";
  }

  // Build bullets (Option A — supporting details only)
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
    sunset: hourly.sunset,
    clothing
  });

  return {
    badge: { text: "Today", class: "badge-easy" },
    emoji,
    headline,
    text: mainSentence,
    bullets,
    suppressMicroAdvice: false,
    isEndOfDay: false
  };
}

// ------------------------------------------------------------
// TODAY BULLET ENGINE (Option A)
// ------------------------------------------------------------
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
  sunset,
  clothing
}) {
  const bullets = [];

  // 🌡️ Temperature bullets
  if (tempNow <= 32) bullets.push("Cold start — layers feel good this morning.");
  else if (tempNow <= 45) bullets.push("Chilly morning air — a jacket helps.");
  else if (tempNow <= 55) bullets.push("Cool but comfortable — layers work well.");
  else if (tempHigh >= 75) bullets.push("Warm afternoon ahead — short sleeves weather.");
  else if (tempHigh - tempLow >= 18) bullets.push("Big warm‑up from morning to afternoon.");

  // 💨 Wind bullets
  if (gustMax >= 35) bullets.push("Gusty at times — you’ll notice it.");
  else if (gustMax >= 22) bullets.push("A bit breezy this afternoon.");

  // 🌧️ Rain bullets
  if (precipTotal > 0.05) {
    const firstWet = precipHours.findIndex(v => v > 0.02);
    if (firstWet !== -1) {
      const hour = new Date().getHours() + firstWet;
      bullets.push(`Rain may drift in around ${to12Hour(hour)}.`);
    } else {
      bullets.push("Spotty showers possible later today.");
    }
  }

  // ❄️ Snow bullets
  if (snowTotal > 0.05) {
    if (snowTotal < 0.5) bullets.push("Light snow possible — nothing major.");
    else if (snowTotal < 2) bullets.push("Snow showers may coat colder spots.");
    else bullets.push("Accumulating snow possible — travel may slow down.");
  }

  // 💧 Humidity bullets
  if (dewNow >= 65) bullets.push("Humidity may feel noticeable at times.");
  else if (dewNow <= 25) bullets.push("Dry air — very comfortable outside.");

  // 🌄 Sunrise / sunset bullets
  if (sunrise && sunrise.length > 0) {
    const sunriseHour = new Date(sunrise[0]).getHours();
    if (new Date().getHours() < sunriseHour) {
      bullets.push(`Sunrise around ${to12Hour(sunriseHour)}.`);
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
    bullets.push("Cooler on the ridges — breezy in higher spots.");
  }

  if (precipTotal > 0.05 && tempNow <= 40) {
    bullets.push("Colder hollows may see a brief mix early.");
  }

  if (tempHigh >= 70 && dewNow >= 60) {
    bullets.push("Warm valley feel — a touch muggy in sheltered spots.");
  }

  // 👕 Clothing bullet (Option A2 — only if not used in main sentence)
  if (clothing) bullets.push(clothing.charAt(0).toUpperCase() + clothing.slice(1) + ".");

  // De‑duplicate + cap at 3
  const unique = [...new Set(bullets)];
  return unique.slice(0, 3);
}
// ============================================================
// PART 3 — TOMORROW — Human‑Action Outlook (Option A)
// ============================================================

// Clothing helper — returns a short phrase or null
function getClothingAdviceTomorrow(tempStats, dewStats, windStats) {
  const advice = [];

  const maxT = tempStats.max;
  const minT = tempStats.min;
  const avgDew = dewStats.avg ?? null;
  const maxGust = windStats.max ?? 0;

  if (maxT <= 40) advice.push("warm layers recommended");
  else if (maxT <= 55) advice.push("a jacket helps");
  else if (maxT >= 75) advice.push("short sleeves feel good");

  if (maxGust >= 30) advice.push("wind‑resistant layers useful");
  if (avgDew >= 65) advice.push("light, breathable clothing helps");

  if (!advice.length) return null;
  return advice[0];
}

// ------------------------------------------------------------
// TOMORROW ACTION OUTLOOK (Option A)
// ------------------------------------------------------------
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
  const windStats = getWindStats(win);
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

  // Clothing logic (A2)
  const clothing = getClothingAdviceTomorrow(tempStats, dewStats, windStats);

  // Build main sentence (Option A)
  let mainSentence = mergePhrases(tempDesc, precipDesc, windDesc);

  if (clothing && (dominant === "cold" || dominant === "heat" || dominant === "wind")) {
    mainSentence = mergePhrases(mainSentence, clothing);
  }

  mainSentence = mainSentence.charAt(0).toUpperCase() + mainSentence.slice(1) + ".";

  // Emoji + headline
  let emoji = "🙂";
  let headline = "A straightforward day.";

  switch (dominant) {
    case "snow":
      emoji = "❄️";
      headline = "Allow extra travel time.";
      break;
    case "rain":
      emoji = "🌧️";
      headline = "Bring a rain jacket.";
      break;
    case "wind":
      emoji = "💨";
      headline = "Factor in the wind.";
      break;
    case "heat":
      emoji = "🥵";
      headline = "Stay hydrated.";
      break;
    case "cold":
      emoji = "🥶";
      headline = "Dress in warm layers.";
      break;
    case "goldilocks":
      emoji = "🌟";
      headline = "Make outdoor plans.";
      break;
    default:
      emoji = "🙂";
      headline = "A calm, easygoing day.";
  }

  // Build bullets (Option A — supporting details only)
  const bullets = buildTomorrowBullets({
    win,
    tempStats,
    dewStats,
    windStats,
    precipTotal,
    snowTotal,
    clothing
  });

  return {
    badge: { text: isGoldilocks ? "Goldilocks Day" : "Tomorrow", class: isGoldilocks ? "badge-goldilocks" : "badge-easy" },
    emoji,
    headline,
    text: mainSentence,
    bullets
  };
}

// ------------------------------------------------------------
// TOMORROW BULLET ENGINE (Option A)
// ------------------------------------------------------------
function buildTomorrowBullets({
  win,
  tempStats,
  dewStats,
  windStats,
  precipTotal,
  snowTotal,
  clothing
}) {
  const bullets = [];

  const maxT = tempStats.max;
  const minT = tempStats.min;
  const avgT = tempStats.avg;
  const maxGust = windStats.max ?? 0;
  const avgDew = dewStats.avg ?? null;

  const precipArr = win.precipitation || [];
  const snowArr = win.snowfall || [];

  // 🌡️ Temperature bullets
  if (maxT != null && minT != null) {
    if (maxT <= 40) bullets.push("Plan for a cold day overall.");
    else if (maxT <= 55) bullets.push("Plan for a cool day overall.");
    else if (maxT <= 72) bullets.push("Expect a mild afternoon.");
    else if (maxT <= 82) bullets.push("Expect a warm afternoon.");
    else bullets.push("Plan for a hot afternoon.");
  }

  // 💧 Humidity bullets
  if (avgDew != null) {
    if (avgDew >= 65) bullets.push("Humidity may feel noticeable at times.");
    else if (avgDew <= 25) bullets.push("Air stays dry and comfortable.");
  }

  // 💨 Wind bullets
  if (maxGust >= 35) bullets.push("Gusty at times — factor in wind for outdoor plans.");
  else if (maxGust >= 22) bullets.push("A bit breezy, especially in the afternoon.");

  // 🌧️ Rain timing
  const rainTiming = findEventTiming(win, 0, (win.time || []).length - 1, (i, w) => (w.precipitation[i] ?? 0) > 0.02);

  if (precipTotal > 0.05 && rainTiming.firstHour !== null) {
    const phrase = timingPhrase(rainTiming, true);
    bullets.push(`Rain most likely${phrase}.`);
  } else if (precipTotal > 0.05) {
    bullets.push("Scattered showers possible at times.");
  }

  // ❄️ Snow bullets
  const snowTotalTomorrow = snowArr.length
    ? snowArr.reduce((a, b) => a + b, 0)
    : snowTotal;

  if (snowTotalTomorrow > 0.05) {
    if (snowTotalTomorrow < 0.5) bullets.push("Light snow or flurries possible.");
    else if (snowTotalTomorrow < 2) bullets.push("Snow showers may create slick spots.");
    else bullets.push("Accumulating snow could slow travel at times.");
  }

  // 🏔️ Mountain microclimate
  if (maxGust >= 20 && maxT <= 55) {
    bullets.push("Cooler and breezier on higher ridges.");
  }

  // 👕 Clothing bullet (Option A2 — only if not used in main sentence)
  if (clothing) bullets.push(clothing.charAt(0).toUpperCase() + clothing.slice(1) + ".");

  // De‑duplicate + cap at 3
  const unique = [...new Set(bullets)];
  return unique.slice(0, 3);
}
// ============================================================
// PART 4 — Comfort Module + Seasonal Context + Final Exports
// ============================================================

// ------------------------------------------------------------
// Comfort Category
// ------------------------------------------------------------
export function getComfortCategory(temp, dew) {
  if (temp == null) return "mild";

  if (temp <= 40) return "cold";
  if (temp <= 55) return "cool";
  if (temp <= 72) return "mild";
  if (temp <= 82) return "warm";
  return "hot";
}

// ------------------------------------------------------------
// Comfort Summary
// ------------------------------------------------------------
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

// ------------------------------------------------------------
// Seasonal Normals
// ------------------------------------------------------------
const NORMAL_HIGHS = {
  0: 47, 1: 51, 2: 59, 3: 68, 4: 75, 5: 82,
  6: 85, 7: 84, 8: 78, 9: 69, 10: 59, 11: 50
};

const NORMAL_LOWS = {
  0: 28, 1: 31, 2: 36, 3: 43, 4: 52, 5: 60,
  6: 64, 7: 63, 8: 57, 9: 46, 10: 37, 11: 31
};

// ------------------------------------------------------------
// Seasonal Context
// ------------------------------------------------------------
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

// ------------------------------------------------------------
// Goldilocks Check (shared)
// ------------------------------------------------------------
function isGoldilocks(tempNow, tempHigh) {
  if (tempNow == null || tempHigh == null) return false;
  return (
    tempHigh >= 60 &&
    tempHigh <= 75 &&
    tempNow >= 55 &&
    tempNow <= 78
  );
}

// ------------------------------------------------------------
// Final Exports (already exported inline where needed)
// ------------------------------------------------------------
// getTodayActionOutlook
// getHumanActionOutlook
// getComfortCategory
// getComfortSummary
// getSeasonalContext

// Everything else is intentionally internal.
// ============================================================
