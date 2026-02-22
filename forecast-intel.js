// forecast-intel.js
/* ----------------------------------------------------
   PART 1 — CORE HELPERS + HOURLY WINDOW TOOLS
---------------------------------------------------- */

function safeNum(arr, i) {
  if (!arr || i < 0 || i >= arr.length) return null;
  const v = arr[i];
  return typeof v === "number" && !Number.isNaN(v) ? v : null;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function avg(values) {
  let sum = 0;
  let count = 0;
  for (const v of values) {
    if (typeof v === "number" && !Number.isNaN(v)) {
      sum += v;
      count++;
    }
  }
  return count > 0 ? sum / count : null;
}

function sum(values) {
  let total = 0;
  for (const v of values) {
    if (typeof v === "number" && !Number.isNaN(v)) {
      total += v;
    }
  }
  return total;
}

/* ----------------------------------------------------
   TIME + HOURLY WINDOW HELPERS
---------------------------------------------------- */

function getHourlyDates(hourly) {
  const times = hourly?.time || [];
  return times.map(t => new Date(t));
}

function getCalendarDayWindow(hourly, targetDate) {
  const times = hourly?.time || [];
  if (!times.length) return { start: 0, end: 0 };

  const yyyy = targetDate.getFullFullYear();
  const mm = String(targetDate.getMonth() + 1).padStart(2, "0");
  const dd = String(targetDate.getDate()).padStart(2, "0");
  const targetStr = `${yyyy}-${mm}-${dd}`;

  let start = null;
  let end = null;

  for (let i = 0; i < times.length; i++) {
    const dateStr = times[i].slice(0, 10);
    if (dateStr === targetStr) {
      if (start === null) start = i;
      end = i + 1;
    }
  }

  if (start === null) return { start: 0, end: 0 };
  return { start, end };
}

function getTomorrowWindow(hourly) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);

  const { start, end } = getCalendarDayWindow(hourly, tomorrow);

  if (start === 0 && end === 0) {
    const len = hourly?.time?.length || 0;
    const s = Math.min(24, Math.max(0, len - 24));
    const e = Math.min(48, len);
    return { start: s, end: e };
  }

  return { start, end };
}

function getRelativeWindow(hourly, offsetStartHours, offsetEndHours) {
  const len = hourly?.time?.length || 0;
  const start = clamp(offsetStartHours, 0, len);
  const end = clamp(offsetEndHours, 0, len);
  return { start, end: Math.max(start, end) };
}

function findEventTiming(hourly, start, end, predicate) {
  const times = hourly.time || [];
  let first = null;
  let last = null;

  for (let i = start; i < end; i++) {
    if (predicate(i)) {
      if (first === null) first = i;
      last = i;
    }
  }

  if (first === null) {
    return { firstHour: null, lastHour: null };
  }

  return {
    firstHour: new Date(times[first]),
    lastHour: new Date(times[last])
  };
}

function describeTimeOfDay(date) {
  if (!date) return null;
  const hour = date.getHours();

  if (hour < 6) return "overnight";
  if (hour < 10) return "early morning";
  if (hour < 12) return "late morning";
  if (hour < 15) return "early afternoon";
  if (hour < 18) return "late afternoon";
  if (hour < 21) return "evening";
  return "late evening";
}

function dayName(date) {
  if (!date) return "";
  return date.toLocaleDateString(undefined, { weekday: "long" });
}

/* ----------------------------------------------------
   PRECIP + TEMP ACCUMULATION HELPERS
---------------------------------------------------- */

function accumulatePrecip(hourly, start, end) {
  const rainArr = hourly?.precipitation || [];
  const snowArr = hourly?.snowfall || [];

  let rainTotal = 0;
  let snowTotal = 0;

  for (let i = start; i < end; i++) {
    const r = safeNum(rainArr, i) ?? 0;
    const s = safeNum(snowArr, i) ?? 0;
    rainTotal += r;
    snowTotal += s;
  }

  return { rainTotal, snowTotal };
}

function summarizeTemps(hourly, start, end) {
  const tempArr = hourly?.temperature_2m || [];
  let minTemp = Infinity;
  let maxTemp = -Infinity;
  const temps = [];

  for (let i = start; i < end; i++) {
    const t = safeNum(tempArr, i);
    if (t != null) {
      temps.push(t);
      if (t < minTemp) minTemp = t;
      if (t > maxTemp) maxTemp = t;
    }
  }

  if (!temps.length) {
    return { minTemp: null, maxTemp: null, avgTemp: null, count: 0 };
  }

  return {
    minTemp,
    maxTemp,
    avgTemp: avg(temps),
    count: temps.length
  };
}

function computeDiurnalSpread(hourly, start, end) {
  const { minTemp, maxTemp } = summarizeTemps(hourly, start, end);
  if (minTemp == null || maxTemp == null) {
    return { minT: null, maxT: null, spread: null };
  }
  return { minT: minTemp, maxT: maxTemp, spread: maxTemp - minTemp };
}

function summarizeWindGusts(hourly, start, end) {
  const gustArr = hourly?.windgusts_10m || [];
  let maxGust = 0;

  for (let i = start; i < end; i++) {
    const g = safeNum(gustArr, i);
    if (g != null && g > maxGust) {
      maxGust = g;
    }
  }

  return { maxGust };
}

function summarizeDewAndUV(hourly, start, end) {
  const dewArr = hourly?.dewpoint_2m || [];
  const uvArr = hourly?.uv_index || [];

  let maxDew = -Infinity;
  let maxUV = 0;
  let dewSeen = false;

  for (let i = start; i < end; i++) {
    const d = safeNum(dewArr, i);
    if (d != null) {
      dewSeen = true;
      if (d > maxDew) maxDew = d;
    }

    const uv = safeNum(uvArr, i);
    if (uv != null && uv > maxUV) {
      maxUV = uv;
    }
  }

  return {
    maxDew: dewSeen ? maxDew : null,
    maxUV
  };
}

/* ----------------------------------------------------
   PART 2 — ASHEVILLE‑TUNED QPF INTERPRETER
---------------------------------------------------- */

function classifyRain(rainTotal) {
  if (rainTotal < 0.01) return { type: "none", label: "No rain", severity: 0 };
  if (rainTotal < 0.05) return { type: "trace", label: "Trace moisture", severity: 1 };
  if (rainTotal < 0.15) return { type: "spotty", label: "Spotty showers", severity: 2 };
  if (rainTotal < 0.40) return { type: "light", label: "Light rain", severity: 3 };
  if (rainTotal < 0.75) return { type: "steady", label: "Steady rain", severity: 4 };
  if (rainTotal < 1.25) return { type: "soaking", label: "A soaking rain", severity: 5 };
  return { type: "heavy", label: "Heavy rain", severity: 6 };
}

function classifySnow(snowTotal) {
  if (snowTotal < 0.05) return { type: "none", label: "No snow", severity: 0 };
  if (snowTotal < 0.10) return { type: "flurries", label: "Flurries", severity: 1 };
  if (snowTotal < 0.50) return { type: "dusting", label: "Dusting possible", severity: 2 };
  if (snowTotal < 1.0) return { type: "light", label: "Light accumulation", severity: 3 };
  if (snowTotal < 3.0) return { type: "accumulating", label: "Accumulating snow", severity: 4 };
  if (snowTotal < 6.0) return { type: "plowable", label: "Plowable snow", severity: 5 };
  return { type: "significant", label: "Significant snowfall", severity: 6 };
}

function detectConvective(rainArr, start, end) {
  let convective = false;
  let maxSpike = 0;

  for (let i = start + 1; i < end; i++) {
    const prev = rainArr[i - 1] ?? 0;
    const curr = rainArr[i] ?? 0;
    const spike = curr - prev;

    if (spike >= 0.20) {
      convective = true;
      if (spike > maxSpike) maxSpike = spike;
    }
  }

  return { convective, maxSpike };
}

function detectStratiform(rainArr, start, end) {
  let gentleHours = 0;

  for (let i = start; i < end; i++) {
    const r = rainArr[i] ?? 0;
    if (r > 0.01 && r < 0.10) gentleHours++;
  }

  return gentleHours >= 4;
}

function detectNWFlowSnow(hourly, start, end) {
  const gustArr = hourly.windgusts_10m || [];
  const tempArr = hourly.temperature_2m || [];
  const snowArr = hourly.snowfall || [];

  let coldEnough = false;
  let lightSnow = false;
  let gustPattern = false;

  for (let i = start; i < end; i++) {
    const t = safeNum(tempArr, i);
    const s = safeNum(snowArr, i);
    const g = safeNum(gustArr, i);

    if (t != null && t <= 34) coldEnough = true;
    if (s != null && s > 0 && s < 0.20) lightSnow = true;

    if (g != null && g >= 18 && g <= 32) gustPattern = true;
  }

  return coldEnough && lightSnow && gustPattern;
}

function analyzeQPF(hourly, start, end) {
  const rainArr = hourly.precipitation || [];
  const snowArr = hourly.snowfall || [];

  let rainTotal = 0;
  let snowTotal = 0;

  for (let i = start; i < end; i++) {
    rainTotal += rainArr[i] ?? 0;
    snowTotal += snowArr[i] ?? 0;
  }

  const rainClass = classifyRain(rainTotal);
  const snowClass = classifySnow(snowTotal);

  const conv = detectConvective(rainArr, start, end);
  const strat = detectStratiform(rainArr, start, end);
  const nwFlow = detectNWFlowSnow(hourly, start, end);

  return {
    rain: rainClass,
    snow: snowClass,
    convective: conv.convective,
    maxSpike: conv.maxSpike,
    stratiform: strat,
    nwFlowSnow: nwFlow,
    rainTotal,
    snowTotal
  };
}
/* ----------------------------------------------------
   PART 2 — SEASON‑AWARE COMFORT MODULE
---------------------------------------------------- */

/* ---------------- SEASONAL NORMALS (Asheville) ---------------- */
function getSeasonalNormalHigh(month) {
  const normals = {
    0: 47,  // Jan
    1: 51,  // Feb
    2: 59,  // Mar
    3: 68,  // Apr
    4: 75,  // May
    5: 82,  // Jun
    6: 85,  // Jul
    7: 84,  // Aug
    8: 79,  // Sep
    9: 69,  // Oct
    10: 59, // Nov
    11: 50  // Dec
  };
  return normals[month];
}

/* ---------------- SEASONAL ANOMALY ---------------- */
function getTempAnomaly(temp, month) {
  const normal = getSeasonalNormalHigh(month);
  return temp - normal;
}

/* ---------------- SEASONAL FEEL ---------------- */
function describeSeasonalFeel(temp, month) {
  const anomaly = getTempAnomaly(temp, month);

  if (anomaly >= 15) return "unseasonably warm";
  if (anomaly >= 8)  return "mild for this time of year";
  if (anomaly >= 3)  return "a bit warmer than normal";

  if (anomaly <= -15) return "unseasonably cool";
  if (anomaly <= -8)  return "cool for this time of year";
  if (anomaly <= -3)  return "a bit cooler than normal";

  return "seasonable";
}

/* ---------------- ABSOLUTE FEEL ---------------- */
function describeAbsoluteFeel(temp) {
  if (temp >= 90) return "hot";
  if (temp >= 80) return "warm";
  if (temp >= 70) return "mild";
  if (temp >= 60) return "cool";
  if (temp >= 50) return "chilly";
  if (temp >= 40) return "cold";
  return "very cold";
}

/* ---------------- FINAL COMFORT CATEGORY ---------------- */
export function getComfortCategory(temp, dew, wind, dateObj = new Date()) {
  const month = dateObj.getMonth();

  const seasonal = describeSeasonalFeel(temp, month);
  const absolute = describeAbsoluteFeel(temp);

  let blended;

  if (seasonal.includes("unseasonably")) {
    blended = seasonal;
  } else if (seasonal.includes("mild") && absolute === "cool") {
    blended = "mild and pleasant";
  } else if (seasonal.includes("cool") && absolute === "mild") {
    blended = "cool for the season";
  } else {
    blended = seasonal === "seasonable" ? absolute : seasonal;
  }

  if (dew >= 65 && temp >= 75) blended += ", humid";
  if (dew <= 30 && temp >= 60) blended += ", dry and comfortable";

  if (wind >= 35) blended += ", windy";
  else if (wind >= 25) blended += ", breezy";

  return blended.trim();
}

/* ----------------------------------------------------
   PART 3 — THERMAL PROFILE ENGINE
---------------------------------------------------- */

/* ---------------- WET‑BULB TEMPERATURE ---------------- */
function computeWetBulb(tempF, dewF) {
  if (tempF == null || dewF == null) return null;

  const spread = tempF - dewF;

  if (spread <= 2) return tempF - 0.5;
  if (spread >= 15) return tempF - 8;

  return tempF - (spread * 0.5);
}

/* ---------------- HOURLY PRECIP‑TYPE CLASSIFIER ---------------- */
function classifyHourlyPrecipType(tempF, dewF, snowIn) {
  if (snowIn != null && snowIn > 0.05) return "snow";

  const tw = computeWetBulb(tempF, dewF);
  if (tw == null) return "unknown";

  if (tw <= 31.5) return "snow";
  if (tw <= 33.0) return "mix";
  return "rain";
}

/* ---------------- CAD DETECTION ---------------- */
function detectCAD(hourly, start, end) {
  const tempArr = hourly.temperature_2m || [];
  const dewArr = hourly.dewpoint_2m || [];
  const gustArr = hourly.windgusts_10m || [];

  let fallingTemps = false;
  let risingDew = false;
  let cadWind = false;

  for (let i = start + 1; i < end; i++) {
    const tPrev = safeNum(tempArr, i - 1);
    const tCurr = safeNum(tempArr, i);
    const dPrev = safeNum(dewArr, i - 1);
    const dCurr = safeNum(dewArr, i);
    const g = safeNum(gustArr, i);

    if (tPrev != null && tCurr != null && tCurr < tPrev) fallingTemps = true;
    if (dPrev != null && dCurr != null && dCurr > dPrev) risingDew = true;
    if (g != null && g >= 10 && g <= 25) cadWind = true;
  }

  return fallingTemps && risingDew && cadWind;
}

/* ---------------- FREEZING DRIZZLE DETECTION ---------------- */
function detectFreezingDrizzle(hourly, start, end) {
  const tempArr = hourly.temperature_2m || [];
  const dewArr = hourly.dewpoint_2m || [];
  const rainArr = hourly.precipitation || [];

  let possible = false;

  for (let i = start; i < end; i++) {
    const t = safeNum(tempArr, i);
    const d = safeNum(dewArr, i);
    const r = safeNum(rainArr, i);

    if (t == null || d == null || r == null) continue;

    const spread = t - d;

    if (t >= 28 && t <= 32 && r > 0 && r < 0.05 && spread <= 4) {
      possible = true;
    }
  }

  return possible;
}

/* ---------------- THERMAL PROFILE SUMMARY ---------------- */
function analyzeThermalProfile(hourly, start, end) {
  const tempArr = hourly.temperature_2m || [];
  const dewArr = hourly.dewpoint_2m || [];
  const snowArr = hourly.snowfall || [];

  let minTemp = Infinity;
  let maxTemp = -Infinity;
  let wetBulbMin = Infinity;
  let wetBulbMax = -Infinity;

  let rainCount = 0;
  let snowCount = 0;
  let mixCount = 0;

  for (let i = start; i < end; i++) {
    const t = safeNum(tempArr, i);
    const d = safeNum(dewArr, i);
    const s = safeNum(snowArr, i);

    if (t != null) {
      if (t < minTemp) minTemp = t;
      if (t > maxTemp) maxTemp = t;
    }

    const tw = computeWetBulb(t, d);
    if (tw != null) {
      if (tw < wetBulbMin) wetBulbMin = tw;
      if (tw > wetBulbMax) wetBulbMax = tw;
    }

    const type = classifyHourlyPrecipType(t, d, s);
    if (type === "rain") rainCount++;
    if (type === "snow") snowCount++;
    if (type === "mix") mixCount++;
  }

  let precipType = "none";
  if (snowCount > 0 && rainCount === 0) precipType = "snow";
  else if (rainCount > 0 && snowCount === 0) precipType = "rain";
  else if (mixCount > 0 || (rainCount > 0 && snowCount > 0)) precipType = "mix";

  const freezingDrizzle = detectFreezingDrizzle(hourly, start, end);
  const cad = detectCAD(hourly, start, end);

  return {
    precipType,
    freezingDrizzle,
    cad,
    minTemp: minTemp === Infinity ? null : minTemp,
    maxTemp: maxTemp === -Infinity ? null : maxTemp,
    wetBulbMin: wetBulbMin === Infinity ? null : wetBulbMin,
    wetBulbMax: wetBulbMax === -Infinity ? null : wetBulbMax
  };
}
/* ----------------------------------------------------
   PART 4 — MICROCLIMATE + HUMAN‑ACTION INTELLIGENCE
---------------------------------------------------- */

/* ---------------- MICROCLIMATE DETECTION ---------------- */
function detectMicroclimates(hourly, start, end) {
  const micro = {
    nwFlowSnow: false,
    cad: false,
    ridgeWinds: false,
    layersDay: false
  };

  const temps = hourly.temperature_2m || [];
  const dew = hourly.dewpoint_2m || [];
  const windDir = hourly.winddirection_10m || [];
  const gusts = hourly.windgusts_10m || [];
  const snow = hourly.snowfall || [];

  // NW‑flow snow
  for (let i = start; i < end; i++) {
    const dir = windDir[i] ?? 0;
    const t = temps[i] ?? 40;
    const s = snow[i] ?? 0;

    if (dir >= 290 && dir <= 330 && t <= 36 && s > 0.05) {
      micro.nwFlowSnow = true;
    }
  }

  // CAD
  for (let i = start; i < end; i++) {
    const dir = windDir[i] ?? 0;
    const t = temps[i] ?? 50;
    const d = dew[i] ?? 40;

    if (dir >= 20 && dir <= 80 && t <= 45 && Math.abs(t - d) < 3) {
      micro.cad = true;
    }
  }

  // Ridge winds
  for (let i = start; i < end; i++) {
    if ((gusts[i] ?? 0) >= 35) {
      micro.ridgeWinds = true;
    }
  }

  // Layers day (big temp swings)
  const sliceTemps = temps.slice(start, end).filter(t => t != null);
  if (sliceTemps.length > 0) {
    const minT = Math.min(...sliceTemps);
    const maxT = Math.max(...sliceTemps);
    if (maxT - minT >= 22) {
      micro.layersDay = true;
    }
  }

  return micro;
}

/* ---------------- GOLDILOCKS DETECTION ---------------- */
function detectGoldilocks(qpf, thermal, wind, dew, micro) {
  const { maxTemp, minTemp } = thermal;

  const perfectTemp = maxTemp >= 68 && maxTemp <= 74;
  const perfectDew = dew.maxDew >= 45 && dew.maxDew <= 52;
  const calmWind = wind.maxGust < 20;
  const dry = qpf.rainTotal < 0.05 && qpf.snowTotal < 0.05;
  const lowUV = dew.maxUV < 6;

  if (perfectTemp && perfectDew && calmWind && dry && lowUV) return "full";
  if (perfectTemp && dry && wind.maxGust < 25 && minTemp < 45) return "afternoon";
  if (perfectTemp && dry && micro.ridgeWinds) return "valleys";
  if (perfectTemp && dew.maxDew > 60) return "earlyMuggyLate";

  return null;
}

/* ---------------- TEMPERATURE SWING DETECTOR ---------------- */
function describeTempSwing(hourly, start, end, thermal) {
  const temps = hourly.temperature_2m || [];
  const slice = temps.slice(start, end).filter(t => t != null);
  if (slice.length < 4) return null;

  const morning = slice.slice(0, 6);
  const afternoon = slice.slice(10, 18);
  const evening = slice.slice(-6);

  const morningAvg = avg(morning);
  const afternoonAvg = avg(afternoon);
  const eveningAvg = avg(evening);

  const rise = afternoonAvg - morningAvg;
  const drop = afternoonAvg - eveningAvg;

  if (morningAvg > afternoonAvg && afternoonAvg > eveningAvg) {
    return "temperatures fall steadily through the day";
  }

  if (morningAvg > afternoonAvg && rise < -8) {
    return "turning colder through the afternoon";
  }

  if (drop >= 15 && rise < 5) {
    return "warm early, dropping sharply after midday";
  }

  if (rise >= 20 && drop < 10) {
    return "cold morning, much warmer afternoon";
  }

  if (rise >= 15 && drop >= 15) {
    return "big temperature swing — cold early, warm later, then colder again";
  }

  if (thermal.maxTemp - thermal.minTemp >= 22) {
    return "big temperature swings";
  }

  return null;
}

/* ---------------- SUMMARY BUILDER ---------------- */
function buildSummary(qpf, thermal, wind, dew, micro, swingPhrase) {
  const parts = [];

  const precipPart =
    qpf.snowTotal >= 0.1
      ? `Light snow (~${qpf.snowTotal.toFixed(1)}")`
      : qpf.rainTotal >= 0.10
      ? `Around ${qpf.rainTotal.toFixed(2)}" of rain`
      : null;

  const tempPart =
    thermal.minTemp != null && thermal.maxTemp != null
      ? `temps from ${thermal.minTemp.toFixed(0)}°F to ${thermal.maxTemp.toFixed(0)}°F`
      : null;

  const windPart =
    wind.maxGust >= 30
      ? `gusts up to ${wind.maxGust.toFixed(0)} mph`
      : null;

  const sentence1 = [precipPart, tempPart, windPart]
    .filter(Boolean)
    .join(", ");

  if (sentence1) parts.push(sentence1 + ".");

  const microNotes = [];

  if (swingPhrase) microNotes.push(swingPhrase);
  else if (micro.layersDay) microNotes.push("big temperature swings");

  if (micro.ridgeWinds) microNotes.push("breezy on ridges");
  if (micro.nwFlowSnow) microNotes.push("NW‑flow flurries possible");
  if (micro.cad) microNotes.push("CAD may keep temps cooler");

  if (microNotes.length > 0) {
    parts.push(microNotes[0] + ".");
  }

  return parts.join(" ");
}

/* ---------------- ACTION RECOMMENDATIONS ---------------- */
function buildActionList({ qpf, thermal, wind, dew, uv, micro }) {
  const actions = [];

  if (qpf.rainTotal >= 0.10) {
    actions.push("carry an umbrella");
    actions.push("wear waterproof shoes or a rain jacket");
  }

  if (qpf.snowTotal >= 0.1) {
    actions.push("allow extra travel time");
    actions.push("use caution on bridges and overpasses");
    actions.push("dress warmly");
  }

  if (thermal.minTemp != null && thermal.minTemp <= 35) {
    actions.push("dress warmly in layers");
    actions.push("wear gloves and a hat");
  }

  if (thermal.maxTemp != null && thermal.maxTemp >= 82) {
    actions.push("stay hydrated");
    actions.push("wear light clothing");
  }

  if (dew.maxDew >= 65) {
    actions.push("take breaks if outdoors");
  }

  if (uv >= 6) {
    actions.push("apply sunscreen");
    actions.push("wear a hat or sunglasses");
  }

  if (wind.maxGust >= 30) {
    actions.push("secure loose items");
  }

  if (micro.layersDay) {
    actions.push("dress in layers — big temperature swings expected");
  }

  if (micro.nwFlowSnow) {
    actions.push("watch for slick spots on the Blue Ridge Parkway");
  }

  if (micro.cad) {
    actions.push("be alert for freezing drizzle in sheltered valleys");
  }

  if (micro.ridgeWinds) {
    actions.push("expect stronger winds on ridgelines");
  }

  return actions;
}

/* ---------------- HUMAN‑ACTION TEXT BUILDER ---------------- */
function buildHumanActionText({ headline, summary, actions }) {
  const cleaned = [...new Set(actions)];

  const merged = cleaned.map(a => {
    if (a.includes("dress warmly") || a.includes("dress in layers")) {
      return "dress warmly in layers";
    }
    return a;
  });

  const deduped = [...new Set(merged)];

  const priority = deduped.filter(a =>
    a.includes("travel") ||
    a.includes("secure") ||
    a.includes("dress warmly")
  );

  const finalActions = priority.length >= 2
    ? priority.slice(0, 2)
    : deduped.slice(0, 2);

  const actionSentence =
    finalActions.length > 0
      ? "Plan to " + finalActions.join(" and ") + "."
      : "";

  return (
    (headline ? headline + "\n" : "") +
    summary +
    (actionSentence ? " " + actionSentence : "")
  );
}
/* ----------------------------------------------------
   PART 5 — ICON ENGINE + CATEGORY ENGINE
---------------------------------------------------- */

function getActionIcon(flags) {
  if (flags.snowy) return "❄️";
  if (flags.mixed) return "🌨️";
  if (flags.rainy) return "🌧️";
  if (flags.stormy) return "⛈️";
  if (flags.windy) return "💨";
  if (flags.hot) return "🔥";
  if (flags.cold) return "🥶";
  if (flags.goldilocks) return "🌤️";
  return "🌡️";
}

function getActionBadge(flags) {
  if (flags.snowy) return { text: "Snowy", color: "#7bb4ff" };
  if (flags.mixed) return { text: "Wintry Mix", color: "#9bb0ff" };
  if (flags.rainy) return { text: "Rainy", color: "#6fa8ff" };
  if (flags.stormy) return { text: "Stormy", color: "#ff8b5c" };
  if (flags.windy) return { text: "Windy", color: "#b0d4ff" };
  if (flags.hot) return { text: "Hot", color: "#ffb36b" };
  if (flags.cold) return { text: "Cold", color: "#9ed0ff" };
  if (flags.goldilocks) return { text: "Goldilocks", color: "#ffe28a" };
  return { text: "Typical", color: "#ddd" };
}

/* ----------------------------------------------------
   PART 6 — HUMAN‑ACTION OUTLOOK (OPTION B)
---------------------------------------------------- */

export function getHumanActionOutlook(hourly) {
  const { start, end } = getTomorrowWindow(hourly);

  // Core analyses
  const qpf = analyzeQPF(hourly, start, end);
  const thermal = analyzeThermalProfile(hourly, start, end);
  const wind = summarizeWindGusts(hourly, start, end);
  const dew = summarizeDewAndUV(hourly, start, end);
  const uv = dew.maxUV;

  const micro = detectMicroclimates(hourly, start, end);
  const goldilocksType = detectGoldilocks(qpf, thermal, wind, dew, micro);

  // Temperature swing phrase
  const swingPhrase = describeTempSwing(hourly, start, end, thermal);

  // Summary + actions
  const summary = buildSummary(qpf, thermal, wind, dew, micro, swingPhrase);
  const actions = buildActionList({ qpf, thermal, wind, dew, uv, micro });

  // Deduplicate + prioritize actions
  const cleaned = [...new Set(actions)];
  const merged = cleaned.map(a =>
    a.includes("dress warmly") || a.includes("dress in layers")
      ? "dress warmly in layers"
      : a
  );
  const deduped = [...new Set(merged)];

  const priority = deduped.filter(a =>
    a.includes("travel") ||
    a.includes("secure") ||
    a.includes("dress warmly")
  );

  const topAction =
    priority.length >= 2
      ? "Plan to " + priority.slice(0, 2).join(" and ") + "."
      : deduped.length > 0
      ? "Plan to " + deduped[0] + "."
      : "";

  // Category flags
  const flags = {
    goldilocks: !!goldilocksType,

    stormy: qpf.convective || qpf.rain.severity >= 5,
    rainy: qpf.rain.severity >= 3 && qpf.rain.severity < 5,
    mixed: qpf.precipType === "mix",
    snowy: qpf.snow.severity >= 2,

    windy: wind.maxGust >= 30,

    hot: thermal.maxTemp >= 85,
    cold: thermal.minTemp <= 35,

    dry: qpf.rainTotal < 0.02 && qpf.snowTotal < 0.02
  };

  const badge = getActionBadge(flags);
  const category = badge.text;

  return {
    headline: "Tomorrow’s Human‑Action Outlook",
    category,
    emoji: getActionIcon(flags),
    action: topAction,
    summary
  };
}
/* ----------------------------------------------------
   PART 7 — FINAL EXPORTS
---------------------------------------------------- */

export {
  getTomorrowWindow,
  analyzeQPF,
  analyzeThermalProfile,
  summarizeWindGusts,
  summarizeDewAndUV,
  detectMicroclimates,
  detectGoldilocks,
  describeTempSwing,
  buildSummary,
  buildActionList,
  buildHumanActionText
};

/* The primary export your UI calls */
export default {
  getHumanActionOutlook
};


