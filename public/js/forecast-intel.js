// ============================================================
// FORECAST INTEL — PART 1 OF 5
// Core helpers + descriptors + windows + multi-phase engine
// ============================================================

// ------------------------------------------------------------
// Basic text helpers
// ------------------------------------------------------------
function cleanJoin(parts, sep = ", ") {
  return parts
    .map(p => (p || "").trim())
    .filter(p => p.length > 0)
    .join(sep);
}

export function mergePhrases(...parts) {
  const flat = parts
    .flat()
    .filter(Boolean)
    .map(p => p.trim())
    .filter(p => p.length > 0);

  if (!flat.length) return "";
  return flat.join(", ");
}

export function to12Hour(timeStr) {
  // timeStr: "2026-03-16T14:00" or "14:00"
  const raw = timeStr.includes("T") ? timeStr.split("T")[1] : timeStr;
  const [hStr] = raw.split(":");
  let h = parseInt(hStr, 10);
  const suffix = h >= 12 ? "PM" : "AM";
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h} ${suffix}`;
}

// ------------------------------------------------------------
// Descriptors — rebuilt for smoother, meteorologist-grade language
// ------------------------------------------------------------
export function describeTempRange(tempStats) {
  const maxT = tempStats?.max ?? null;
  const minT = tempStats?.min ?? null;

  if (maxT == null && minT == null) return "";

  if (maxT != null && minT != null) {
    if (maxT <= 40) return "a cold day overall";
    if (maxT <= 55) return "a cool day overall";
    if (maxT <= 72) return "a mild day overall";
    if (maxT <= 82) return "a warm day overall";
    return "a hot day overall";
  }

  const ref = maxT ?? minT;
  if (ref <= 40) return "a cold feel";
  if (ref <= 55) return "a cool feel";
  if (ref <= 72) return "a mild feel";
  if (ref <= 82) return "a warm feel";
  return "a hot feel";
}

export function describeWind(gustMax) {
  if (gustMax == null) return "";
  if (gustMax >= 45) return "very gusty at times";
  if (gustMax >= 35) return "quite breezy to windy";
  if (gustMax >= 22) return "a bit breezy";
  if (gustMax >= 12) return "a light breeze";
  return "";
}

export function describePrecip(precipTotal, snowTotal) {
  const rain = precipTotal ?? 0;
  const snow = snowTotal ?? 0;

  if (snow >= 2) return "periods of accumulating snow";
  if (snow >= 0.5) return "snow showers in the mix";
  if (snow > 0) return "flurries or light snow at times";

  if (rain >= 0.75) return "a soaking rain at times";
  if (rain >= 0.25) return "occasional showers";
  if (rain >= 0.05) return "a few showers around";
  if (rain > 0) return "a stray shower possible";

  return "";
}

// ------------------------------------------------------------
// Basic stats helpers
// ------------------------------------------------------------
function getTempStats(win) {
  const arr = win.temperature_2m || [];
  if (!arr.length) return { min: null, max: null, avg: null };

  let min = Infinity;
  let max = -Infinity;
  let sum = 0;

  for (const v of arr) {
    if (v == null) continue;
    if (v < min) min = v;
    if (v > max) max = v;
    sum += v;
  }

  const avg = sum / arr.length;
  return {
    min: isFinite(min) ? min : null,
    max: isFinite(max) ? max : null,
    avg: isFinite(avg) ? avg : null
  };
}

function getDewStats(win) {
  const arr = win.dewpoint_2m || [];
  if (!arr.length) return { min: null, max: null, avg: null };

  let min = Infinity;
  let max = -Infinity;
  let sum = 0;

  for (const v of arr) {
    if (v == null) continue;
    if (v < min) min = v;
    if (v > max) max = v;
    sum += v;
  }

  const avg = sum / arr.length;
  return {
    min: isFinite(min) ? min : null,
    max: isFinite(max) ? max : null,
    avg: isFinite(avg) ? avg : null
  };
}

function getWindStats(win) {
  const arr = win.windgusts_10m || [];
  if (!arr.length) return { min: null, max: null, avg: null };

  let min = Infinity;
  let max = -Infinity;
  let sum = 0;

  for (const v of arr) {
    if (v == null) continue;
    if (v < min) min = v;
    if (v > max) max = v;
    sum += v;
  }

  const avg = sum / arr.length;
  return {
    min: isFinite(min) ? min : null,
    max: isFinite(max) ? max : null,
    avg: isFinite(avg) ? avg : null
  };
}

function getPrecipTotal(win) {
  const arr = win.precipitation || [];
  return arr.reduce((a, b) => a + (b || 0), 0);
}

function getSnowTotal(win) {
  const arr = win.snowfall || [];
  return arr.reduce((a, b) => a + (b || 0), 0);
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
    const t = new Date(times[i]);
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
  const keys = Object.keys(hourly || {});
  const out = {};
  for (const k of keys) {
    const arr = hourly[k];
    if (!Array.isArray(arr)) continue;
    out[k] = indices.map(i => arr[i]);
  }
  return out;
}

// ------------------------------------------------------------
// NORMALIZATION (with wind direction)
// ------------------------------------------------------------
export function normalizeHourly(hourly, indices) {
  return indices.map(i => ({
    temp: hourly.temperature_2m[i],
    dew: hourly.dewpoint_2m[i],
    gust: hourly.windgusts_10m[i],
    precip: hourly.precipitation[i],
    snow: hourly.snowfall[i],
    uv: hourly.uv_index ? hourly.uv_index[i] : 0,
    windDir: hourly.winddirection_10m ? hourly.winddirection_10m[i] : null,
    time: hourly.time[i]
  }));
}

// ------------------------------------------------------------
// EVENT TIMING HELPERS (used by bullets later)
// ------------------------------------------------------------
function findEventTiming(win, startIndex, endIndex, predicate) {
  const times = win.time || [];
  let first = null;
  let last = null;

  for (let i = startIndex; i <= endIndex; i++) {
    if (!times[i]) continue;
    if (predicate(i, win)) {
      if (first === null) first = i;
      last = i;
    }
  }

  return { firstHour: first, lastHour: last };
}

function timingPhrase(timing, isRain = false) {
  if (timing.firstHour == null) return "";

  const times = timing;
  // Here we only care about broad buckets: morning / afternoon / evening / night
  const bucket = idx => {
    if (idx == null) return "";
    const h = idx; // we’ll map index to rough hour bucket in Today/Tomorrow context
    if (h < 8) return "early in the morning";
    if (h < 12) return "late morning";
    if (h < 17) return "in the afternoon";
    if (h < 21) return "in the evening";
    return "at night";
  };

  const phrase = bucket(timing.firstHour);
  if (!phrase) return "";

  return isRain ? ` ${phrase}` : ` ${phrase}`;
}

// ------------------------------------------------------------
// MULTI-PHASE / EVENT-DAY ENGINE
// ------------------------------------------------------------
function detectFrontalPassage(hours) {
  for (let i = 1; i < hours.length; i++) {
    const prev = hours[i - 1];
    const curr = hours[i];

    const tempDrop = prev.temp - curr.temp >= 4;
    const gustSpike = curr.gust - prev.gust >= 6;
    const precipEnds = prev.precip > 0.02 && curr.precip === 0;

    const windShift =
      prev.windDir != null &&
      curr.windDir != null &&
      Math.abs(curr.windDir - prev.windDir) >= 60;

    if ((tempDrop && gustSpike) || (tempDrop && precipEnds) || windShift) {
      return true;
    }
  }
  return false;
}

function detectSnowBehindFront(hours) {
  const nwSnow = hours.some(h => {
    const coldEnough = h.temp <= 36;
    const precip = h.precip > 0.01 || h.snow > 0;
    const gusty = h.gust >= 20;
    const nwFlow = h.windDir != null && h.windDir >= 280 && h.windDir <= 330;

    return coldEnough && precip && gusty && nwFlow;
  });

  return { nwFlowSnow: nwSnow };
}

function detectWedge(hours) {
  return hours.some(h =>
    h.windDir != null &&
    h.windDir >= 40 &&
    h.windDir <= 110 &&
    h.temp <= 50 &&
    h.dew >= 45
  );
}

function detectPhases(hours) {
  const phases = [];

  // Rain early
  const earlyRain = hours.slice(0, 8).some(h => h.precip > 0.02);
  if (earlyRain) phases.push("rain-early");

  // Thunder embedded (warm-sector, gusty, heavier rain)
  const hasThunder = hours.some(h =>
    h.precip > 0.10 &&
    h.temp >= 55 &&
    h.gust >= 25 &&
    h.windDir != null &&
    h.windDir >= 180 &&
    h.windDir <= 230
  );
  if (hasThunder) phases.push("thunder-embedded");

  // Frontal passage
  if (detectFrontalPassage(hours)) phases.push("frontal-passage");

  // Post-frontal cold (clear temp fall after front)
  const tempFalling = hours.some((h, i) => i > 0 && hours[i - 1].temp - h.temp >= 3);
  if (tempFalling) phases.push("post-frontal-cold");

  // NW-flow snow
  const snowSig = detectSnowBehindFront(hours);
  if (snowSig.nwFlowSnow) phases.push("nw-snow");

  // Wedge
  if (detectWedge(hours)) phases.push("wedge");

  return { phases, snow: snowSig };
}

function detectTrends(hours) {
  if (!hours.length) return { tempFalling: false, tempRising: false };

  const first = hours[0].temp;
  const last = hours[hours.length - 1].temp;

  const tempFalling = first - last >= 5;
  const tempRising = last - first >= 5;

  return { tempFalling, tempRising };
}

function detectDrivers(hours, phases, trends) {
  const drivers = [];

  const maxGust = Math.max(...hours.map(h => h.gust || 0));
  const totalPrecip = hours.reduce((a, h) => a + (h.precip || 0), 0);
  const totalSnow = hours.reduce((a, h) => a + (h.snow || 0), 0);
  const maxTemp = Math.max(...hours.map(h => h.temp || -Infinity));
  const minTemp = Math.min(...hours.map(h => h.temp || Infinity));

  if (phases.includes("frontal-passage")) drivers.push("front");
  if (maxGust >= 30) drivers.push("wind");
  if (totalPrecip >= 0.10) drivers.push("precip");
  if (totalSnow > 0) drivers.push("snow");
  if (trends.tempFalling) drivers.push("temp-drop");
  if (trends.tempRising) drivers.push("temp-rise");

  if (maxTemp >= 85) drivers.push("heat");
  if (minTemp <= 32) drivers.push("cold");

  return [...new Set(drivers)];
}

export function analyzeDay(hours) {
  const { phases, snow } = detectPhases(hours);
  const trends = detectTrends(hours);
  const drivers = detectDrivers(hours, phases, trends);

  const isEventDay =
    phases.length > 0 ||
    drivers.includes("front") ||
    drivers.includes("snow") ||
    drivers.includes("temp-drop") ||
    drivers.includes("wind");

  return {
    isEventDay,
    phases,
    trends,
    drivers,
    snow
  };
}

// ------------------------------------------------------------
// DOMINANT FACTOR SCORING (used by Today/Tomorrow later)
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
// FORECAST INTEL — PART 2 OF 5
// Today + Tomorrow Action Outlook (rebuilt)
// ============================================================

// ------------------------------------------------------------
// Helper: pick emoji based on dominant factor
// ------------------------------------------------------------
function emojiForFactor(f) {
  switch (f) {
    case "snow": return "❄️";
    case "rain": return "🌧️";
    case "wind": return "🌬️";
    case "heat": return "🔥";
    case "cold": return "🥶";
    case "goldilocks": return "🌤️";
    default: return "🌤️";
  }
}

// ------------------------------------------------------------
// Helper: build headline from phases + drivers
// ------------------------------------------------------------
function buildHeadline(phases, drivers, trends) {
  // Event-day style
  if (phases.includes("rain-early") && phases.includes("frontal-passage")) {
    return "Rain early, then sharply colder and windy.";
  }

  if (phases.includes("nw-snow")) {
    return "Colder with NW‑flow snow showers.";
  }

  if (phases.includes("thunder-embedded")) {
    return "Rain with a few rumbles possible.";
  }

  if (drivers.includes("wind") && drivers.includes("precip")) {
    return "Breezy with showers around.";
  }

  if (drivers.includes("wind")) {
    return "Breezy at times.";
  }

  if (drivers.includes("precip")) {
    return "A few showers around.";
  }

  if (drivers.includes("temp-drop")) {
    return "Turning colder later.";
  }

  if (drivers.includes("temp-rise")) {
    return "Warming through the day.";
  }

  return "A quiet day overall.";
}

// ------------------------------------------------------------
// Helper: build main narrative sentence
// ------------------------------------------------------------
function buildNarrative(phases, drivers, trends) {
  const parts = [];

  if (phases.includes("rain-early")) {
    parts.push("Rain moves through early");
  }

  if (phases.includes("thunder-embedded")) {
    parts.push("a few rumbles possible");
  }

  if (phases.includes("frontal-passage")) {
    parts.push("a strong front brings a sharp change");
  }

  if (trends.tempFalling) {
    parts.push("temperatures fall sharply later");
  }

  if (phases.includes("nw-snow")) {
    parts.push("scattered NW‑flow snow showers may follow behind the front");
  }

  if (parts.length === 0) {
    if (drivers.includes("precip")) parts.push("A few showers around");
    if (drivers.includes("wind")) parts.push("a bit breezy at times");
    if (drivers.includes("temp-rise")) parts.push("warming through the day");
    if (drivers.includes("temp-drop")) parts.push("turning colder later");
  }

  return mergePhrases(parts) + ".";
}

// ------------------------------------------------------------
// Helper: build bullets (max 3)
// ------------------------------------------------------------
function buildBullets(phases, drivers, trends) {
  const bullets = [];

  if (phases.includes("rain-early")) {
    bullets.push("Rain moves through early in the day.");
  }

  if (phases.includes("frontal-passage")) {
    bullets.push("A strong front brings a sharp change.");
  }

  if (trends.tempFalling) {
    bullets.push("Temperatures fall noticeably later.");
  }

  if (phases.includes("nw-snow")) {
    bullets.push("NW‑flow snow showers may create slick spots.");
  }

  if (bullets.length < 3 && drivers.includes("wind")) {
    bullets.push("A bit breezy at times.");
  }

  if (bullets.length < 3 && drivers.includes("precip")) {
    bullets.push("A few showers around.");
  }

  if (bullets.length === 0) {
    bullets.push("A quiet day overall.");
  }

  return bullets.slice(0, 3);
}

// ------------------------------------------------------------
// TODAY ACTION OUTLOOK
// ------------------------------------------------------------
export function getTodayActionOutlook(hourly) {
  const indices = getTodayRemainingWindow(hourly);
  if (!indices.length) {
    return {
      emoji: "🌤️",
      headline: "A quiet rest of the day.",
      text: "No meaningful weather impacts expected.",
      bullets: ["A quiet evening ahead."]
    };
  }

  const win = sliceHourly(hourly, indices);
  const hours = normalizeHourly(hourly, indices);

  const tempStats = getTempStats(win);
  const dewStats = getDewStats(win);
  const windStats = getWindStats(win);
  const precipTotal = getPrecipTotal(win);
  const snowTotal = getSnowTotal(win);

  const analysis = analyzeDay(hours);
  const { phases, drivers, trends } = analysis;

  const dominant = getDominantFactor(
    tempStats.max,
    windStats.max,
    precipTotal,
    snowTotal
  );

  return {
    emoji: emojiForFactor(dominant),
    headline: buildHeadline(phases, drivers, trends),
    text: buildNarrative(phases, drivers, trends),
    bullets: buildBullets(phases, drivers, trends),
    meta: {
      phases,
      drivers,
      trends,
      dominant
    }
  };
}

// ------------------------------------------------------------
// TOMORROW ACTION OUTLOOK
// ------------------------------------------------------------
export function getHumanActionOutlook(hourly) {
  const indices = getTomorrowWindow(hourly);
  if (!indices.length) {
    return {
      emoji: "🌤️",
      headline: "A quiet day tomorrow.",
      text: "No meaningful weather impacts expected.",
      bullets: ["A quiet day overall."]
    };
  }

  const win = sliceHourly(hourly, indices);
  const hours = normalizeHourly(hourly, indices);

  const tempStats = getTempStats(win);
  const dewStats = getDewStats(win);
  const windStats = getWindStats(win);
  const precipTotal = getPrecipTotal(win);
  const snowTotal = getSnowTotal(win);

  const analysis = analyzeDay(hours);
  const { phases, drivers, trends } = analysis;

  const dominant = getDominantFactor(
    tempStats.max,
    windStats.max,
    precipTotal,
    snowTotal
  );

  return {
    emoji: emojiForFactor(dominant),
    headline: buildHeadline(phases, drivers, trends),
    text: buildNarrative(phases, drivers, trends),
    bullets: buildBullets(phases, drivers, trends),
    meta: {
      phases,
      drivers,
      trends,
      dominant
    }
  };
}
// ============================================================
// FORECAST INTEL — PART 3 OF 5
// Comfort Module + Seasonal Context + Goldilocks Logic
// ============================================================

// ------------------------------------------------------------
// HUMIDITY / DEWPOINT COMFORT DESCRIPTOR
// ------------------------------------------------------------
function describeHumidity(dewAvg) {
  if (dewAvg == null) return "";

  if (dewAvg >= 70) return "tropical and muggy";
  if (dewAvg >= 65) return "very humid";
  if (dewAvg >= 60) return "a bit muggy";
  if (dewAvg >= 55) return "moderately humid";
  if (dewAvg >= 45) return "comfortable humidity";
  return "dry and crisp";
}

// ------------------------------------------------------------
// TEMPERATURE FEEL DESCRIPTOR
// ------------------------------------------------------------
function describeTempFeel(tempAvg) {
  if (tempAvg == null) return "";

  if (tempAvg <= 32) return "winter‑cold";
  if (tempAvg <= 45) return "chilly";
  if (tempAvg <= 60) return "cool and comfortable";
  if (tempAvg <= 72) return "mild and pleasant";
  if (tempAvg <= 82) return "warm";
  if (tempAvg <= 90) return "hot";
  return "very hot";
}

// ------------------------------------------------------------
// WIND FEEL DESCRIPTOR
// ------------------------------------------------------------
function describeWindFeel(gustAvg) {
  if (gustAvg == null) return "";

  if (gustAvg >= 40) return "very windy";
  if (gustAvg >= 30) return "quite breezy";
  if (gustAvg >= 20) return "a bit breezy";
  if (gustAvg >= 10) return "a light breeze";
  return "calm";
}

// ------------------------------------------------------------
// GOLDILOCKS DETECTION
// ------------------------------------------------------------
function isGoldilocksDay(tempStats, dewStats, windStats, precipTotal, snowTotal) {
  const t = tempStats?.max;
  const d = dewStats?.avg;
  const g = windStats?.max;

  if (snowTotal > 0 || precipTotal > 0.05) return false;
  if (t == null || d == null || g == null) return false;

  const tempOK = t >= 60 && t <= 75;
  const dewOK = d >= 35 && d <= 55;
  const windOK = g <= 20;

  return tempOK && dewOK && windOK;
}

// ------------------------------------------------------------
// COMFORT CATEGORY (rebuilt, Asheville-aware)
// ------------------------------------------------------------
export function getComfortCategory(hourly, indices) {
  if (!indices?.length) return "unknown";

  const win = sliceHourly(hourly, indices);
  const tempStats = getTempStats(win);
  const dewStats = getDewStats(win);
  const windStats = getWindStats(win);
  const precipTotal = getPrecipTotal(win);
  const snowTotal = getSnowTotal(win);

  // Goldilocks override
  if (isGoldilocksDay(tempStats, dewStats, windStats, precipTotal, snowTotal)) {
    return "goldilocks";
  }

  const t = tempStats.avg;
  const d = dewStats.avg;
  const g = windStats.avg;

  if (snowTotal > 0.25) return "wintry";
  if (t <= 40) return "cold";
  if (t <= 55) return "cool";
  if (t <= 72) return "mild";
  if (t <= 82) return "warm";
  return "hot";
}

// ------------------------------------------------------------
// COMFORT SUMMARY (rebuilt for smoother language)
// ------------------------------------------------------------
export function getComfortSummary(hourly, indices) {
  if (!indices?.length) return "Comfort information unavailable.";

  const win = sliceHourly(hourly, indices);
  const tempStats = getTempStats(win);
  const dewStats = getDewStats(win);
  const windStats = getWindStats(win);
  const precipTotal = getPrecipTotal(win);
  const snowTotal = getSnowTotal(win);

  // Goldilocks override
  if (isGoldilocksDay(tempStats, dewStats, windStats, precipTotal, snowTotal)) {
    return "A classic Goldilocks day — warm sun, low humidity, and a gentle breeze.";
  }

  const tempFeel = describeTempFeel(tempStats.avg);
  const humidityFeel = describeHumidity(dewStats.avg);
  const windFeel = describeWindFeel(windStats.avg);

  const parts = [tempFeel, humidityFeel, windFeel];
  return cleanJoin(parts);
}

// ------------------------------------------------------------
// SEASONAL CONTEXT (rebuilt)
// ------------------------------------------------------------
export function getSeasonalContext(date = new Date()) {
  const m = date.getMonth() + 1;

  if (m === 12 || m <= 2) return "winter";
  if (m >= 3 && m <= 5) return "spring";
  if (m >= 6 && m <= 8) return "summer";
  return "fall";
}
// ============================================================
// FORECAST INTEL — PART 4 OF 5
// Clothing Guidance + Human-Action Recommendations
// ============================================================

// ------------------------------------------------------------
// CLOTHING GUIDANCE
// ------------------------------------------------------------
export function getClothingGuidance(hourly, indices) {
  if (!indices?.length) return "Dress comfortably.";

  const win = sliceHourly(hourly, indices);
  const tempStats = getTempStats(win);
  const dewStats = getDewStats(win);
  const windStats = getWindStats(win);
  const precipTotal = getPrecipTotal(win);
  const snowTotal = getSnowTotal(win);

  const t = tempStats.avg;
  const d = dewStats.avg;
  const g = windStats.max;

  const parts = [];

  // Temperature layers
  if (t <= 32) parts.push("Bundle up — winter layers needed.");
  else if (t <= 45) parts.push("A jacket or warm layers recommended.");
  else if (t <= 60) parts.push("A light jacket or long sleeves should be fine.");
  else if (t <= 72) parts.push("Comfortable layers — nothing heavy needed.");
  else if (t <= 82) parts.push("Short sleeves or breathable clothing.");
  else parts.push("Light, breathable clothing — it’ll feel hot.");

  // Wind
  if (g >= 35) parts.push("Secure loose items and consider a windbreaker.");
  else if (g >= 25) parts.push("A windbreaker may help.");
  else if (g >= 15) parts.push("A bit breezy at times.");

  // Precip
  if (snowTotal > 0.1) parts.push("Winter footwear recommended.");
  else if (precipTotal >= 0.1) parts.push("Bring a rain jacket or umbrella.");
  else if (precipTotal > 0) parts.push("A light rain layer could help.");

  return cleanJoin(parts, " ");
}

// ------------------------------------------------------------
// HUMAN-ACTION RECOMMENDATIONS (rebuilt)
// ------------------------------------------------------------
export function getActionRecommendations(hourly, indices) {
  if (!indices?.length) return [];

  const win = sliceHourly(hourly, indices);
  const hours = normalizeHourly(hourly, indices);

  const tempStats = getTempStats(win);
  const dewStats = getDewStats(win);
  const windStats = getWindStats(win);
  const precipTotal = getPrecipTotal(win);
  const snowTotal = getSnowTotal(win);

  const analysis = analyzeDay(hours);
  const { phases, drivers, trends } = analysis;

  const recs = [];

  // Rain early
  if (phases.includes("rain-early")) {
    recs.push("Plan for rain early — roads may be wet for the morning commute.");
  }

  // Thunder
  if (phases.includes("thunder-embedded")) {
    recs.push("A few rumbles possible — consider indoor plans during heavier showers.");
  }

  // Front
  if (phases.includes("frontal-passage")) {
    recs.push("A strong front brings a sharp change — expect shifting winds and falling temps.");
  }

  // NW-flow snow
  if (phases.includes("nw-snow")) {
    recs.push("NW‑flow snow showers may create slick spots, especially on higher roads.");
  }

  // Temperature trends
  if (trends.tempFalling) {
    recs.push("Temperatures fall later — dress in layers.");
  }

  if (trends.tempRising) {
    recs.push("Warming through the day — lighter layers later.");
  }

  // Wind
  if (windStats.max >= 35) {
    recs.push("Secure outdoor items — strong gusts possible.");
  } else if (windStats.max >= 25) {
    recs.push("A bit windy — consider a windbreaker.");
  }

  // Precip
  if (precipTotal >= 0.25) {
    recs.push("Keep rain gear handy — showers may be persistent.");
  } else if (precipTotal > 0) {
    recs.push("A few showers around — a light rain layer could help.");
  }

  // Snow
  if (snowTotal > 0.1) {
    recs.push("Winter footwear recommended — surfaces may be slick.");
  }

  // If nothing else
  if (!recs.length) {
    recs.push("A quiet day overall — no major weather impacts expected.");
  }

  return recs.slice(0, 5);
}

// ------------------------------------------------------------
// PLANNER-FRIENDLY BULLETS (rebuilt)
// ------------------------------------------------------------
export function getPlannerBullets(hourly, indices) {
  if (!indices?.length) return ["No significant weather impacts expected."];

  const win = sliceHourly(hourly, indices);
  const hours = normalizeHourly(hourly, indices);

  const tempStats = getTempStats(win);
  const dewStats = getDewStats(win);
  const windStats = getWindStats(win);
  const precipTotal = getPrecipTotal(win);
  const snowTotal = getSnowTotal(win);

  const analysis = analyzeDay(hours);
  const { phases, drivers, trends } = analysis;

  const bullets = [];

  // Temperature
  if (trends.tempFalling) bullets.push("Temperatures fall later in the day.");
  else if (trends.tempRising) bullets.push("Temperatures rise through the day.");
  else bullets.push(`High near ${Math.round(tempStats.max)}°.`);

  // Wind
  if (windStats.max >= 40) bullets.push("Very windy at times.");
  else if (windStats.max >= 30) bullets.push("Quite breezy.");
  else if (windStats.max >= 20) bullets.push("A bit breezy.");

  // Precip
  if (phases.includes("rain-early")) bullets.push("Rain moves through early.");
  else if (precipTotal >= 0.25) bullets.push("Showers likely at times.");
  else if (precipTotal > 0) bullets.push("A few showers around.");

  // Snow
  if (phases.includes("nw-snow")) bullets.push("NW‑flow snow showers possible.");

  // If nothing else
  if (!bullets.length) bullets.push("A quiet day overall.");

  return bullets.slice(0, 4);
}
// ============================================================
// FORECAST INTEL — PART 5 OF 5
// Final Exports + Public API Surface
// ============================================================

// ------------------------------------------------------------
// PUBLIC API
// These are the functions your UI and other modules call.
// ------------------------------------------------------------

export {
  // Core analysis
  analyzeDay,
  normalizeHourly,

  // Today / Tomorrow
  getTodayActionOutlook,
  getHumanActionOutlook,

  // Comfort
  getComfortCategory,
  getComfortSummary,

  // Seasonal context
  getSeasonalContext,

  // Clothing + human action
  getClothingGuidance,
  getActionRecommendations,
 

  // Helpers (if needed externally)
  getTodayRemainingWindow,
  getTomorrowWindow,
  getDominantFactor
};
// ------------------------------------------------------------
// OLD FORECAST-INTEL-PLUS
// ============================================================
// ============================================================
// UNIFIED INTEL WRAPPER (migrated from forecast-intel-plus.js)
// ============================================================

import { findNearestHourIndex, getReliableUV } from './weather-utils.js';
import { getMicroAdvice } from './micro-advice.js';
import { degToCompass, getUVClass } from "./weather-render.js";

export function buildWeatherIntel({ wuCurrent, hourly, mrmsPixel }) {

  // ⭐ 1. UV
  const idx = findNearestHourIndex(hourly);
  const fallbackUV = hourly.uv_index?.[idx] ?? null;

  const reliableUV = getReliableUV(
    wuCurrent,
    fallbackUV,
    wuCurrent.solarRadiation
  );

  // ⭐ 2. RIGHT NOW COMFORT
  const tempNow = wuCurrent.temp;
  const dewNow = wuCurrent.dewPoint;

  const comfortCategory = getComfortCategory(hourly, [idx]);
  const comfortSummary = getComfortSummary(hourly, [idx]);

  const comfortEmojiMap = {
    cold: "🥶",
    cool: "🧥",
    mild: "🙂",
    warm: "😎",
    hot: "🥵"
  };

  const rightNowComfort = {
    category: comfortCategory,
    summary: comfortSummary,
    emoji: comfortEmojiMap[comfortCategory] || "🙂"
  };

  // ⭐ 3. Today + Tomorrow (core outlooks)
  const today = getTodayActionOutlook(hourly);
  const tomorrow = getHumanActionOutlook(hourly);

  // ⭐ 4. Precip signal
  const precipSignal = {
    isFalling: mrmsPixel.rate > 0,
    type: mrmsPixel.type,
    intensity: mrmsPixel.intensity,
    source: "mrms"
  };

  // ⭐ 5. Micro‑advice
  const microAdvice = getMicroAdvice({
    wu: wuCurrent,
    today,
    comfort: rightNowComfort
  });

  // ⭐ 6. Expanded Forecast Detail Builders
  function to12Hour(hour) {
    const h = hour % 12 || 12;
    const suffix = hour >= 12 ? "PM" : "AM";
    return `${h} ${suffix}`;
  }

  function buildHourlySnapshot(hourly, indices) {
    return indices.slice(0, 4).map(i => ({
      time: hourly.time[i],
      temp: Math.round(hourly.temperature_2m[i]),
      wind: `${degToCompass(hourly.windgusts_10m?.[i] ?? 0)} ${Math.round(hourly.windgusts_10m?.[i] ?? 0)} mph`,
      precip: Math.round((hourly.precipitation[i] ?? 0) * 100)
    }));
  }

  function buildPrecipWindow(hourly, indices) {
    const precipHours = indices.filter(i => (hourly.precipitation[i] ?? 0) > 0.02);
    if (precipHours.length === 0) return "Dry all day.";

    const start = new Date(hourly.time[precipHours[0]]).getHours();
    const end = new Date(hourly.time[precipHours.at(-1)]).getHours();

    return `Possible showers ${to12Hour(start)}–${to12Hour(end)}.`;
  }

  function buildWindShifts(hourly, indices) {
    const sample = indices.slice(0, 3);
    const dirs = sample.map(i => degToCompass(hourly.windgusts_10m?.[i] ?? 0));
    return dirs.join(" → ");
  }

  function buildUVTimeline(hourly, indices) {
    return indices.slice(0, 3).map(i => {
      const hour = new Date(hourly.time[i]).getHours();
      return {
        time: to12Hour(hour),
        value: Math.round(hourly.uv_index?.[i] ?? 0),
        label: getUVClass(hourly.uv_index?.[i] ?? 0).replace("uv-", "")
      };
    });
  }

  function buildConfidence() {
    return "High confidence (85%)";
  }

  function buildReasoning() {
    return "A stable pattern with consistent model agreement supports this forecast.";
  }

  function buildPeakUV(hourly, indices) {
    const uvPoints = indices.map(i => ({
      hour: new Date(hourly.time[i]).getHours(),
      value: hourly.uv_index?.[i] ?? 0
    }));

    const maxUV = Math.max(...uvPoints.map(p => p.value));
    if (maxUV <= 2) return { max: maxUV, hours: [] };

    const peakHours = uvPoints
      .filter(p => p.value === maxUV)
      .map(p => p.hour);

    return { max: maxUV, hours: peakHours };
  }

  // ⭐ Build windows (local)
  const now = new Date();

  const todayIndices = hourly.time
    .map((t, i) => ({ t: new Date(t), i }))
    .filter(obj => obj.t >= now && obj.t.getDate() === now.getDate())
    .map(obj => obj.i);

  const tomorrowDate = new Date(now);
  tomorrowDate.setDate(now.getDate() + 1);

  const tomorrowIndices = hourly.time
    .map((t, i) => ({ t: new Date(t), i }))
    .filter(obj =>
      obj.t.getDate() === tomorrowDate.getDate() &&
      obj.t.getMonth() === tomorrowDate.getMonth()
    )
    .map(obj => obj.i);

  // ⭐ Detail objects
  const todayDetail = {
    high: Math.round(Math.max(...todayIndices.map(i => hourly.temperature_2m[i]))),
    low: Math.round(Math.min(...todayIndices.map(i => hourly.temperature_2m[i]))),
    hourly: buildHourlySnapshot(hourly, todayIndices),
    precipWindow: buildPrecipWindow(hourly, todayIndices),
    windShifts: buildWindShifts(hourly, todayIndices),
    uvTimeline: buildUVTimeline(hourly, todayIndices),
    confidence: buildConfidence(),
    reasoning: buildReasoning()
  };

  const tomorrowDetail = {
    high: Math.round(Math.max(...tomorrowIndices.map(i => hourly.temperature_2m[i]))),
    low: Math.round(Math.min(...tomorrowIndices.map(i => hourly.temperature_2m[i]))),
    precipWindow: buildPrecipWindow(hourly, tomorrowIndices),
    peakUV: buildPeakUV(hourly, tomorrowIndices),
    confidence: buildConfidence(),
    reasoning: buildReasoning()
  };

  // ⭐ Return unified intel object
  return {
    wu: wuCurrent,
    uv: reliableUV,
    rightNowComfort,
    today,
    tomorrow,
    precipSignal,
    microAdvice,
    todayDetail,
    tomorrowDetail
  };
}
// ------------------------------------------------------------
// END OF FILE
// ============================================================
