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
   TIME + HOURLLY WINDOW HELPERS
   ---------------------------------------------------- */

function getHourlyDates(hourly) {
  const times = hourly?.time || [];
  return times.map(t => new Date(t));
}

function getCalendarDayWindow(hourly, targetDate) {
  const times = hourly?.time || [];
  if (!times.length) return { start: 0, end: 0 };

  const yyyy = targetDate.getFullYear();
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
  if (rainTotal < 0.01) {
    return { type: "none", label: "No rain", severity: 0 };
  }
  if (rainTotal < 0.05) {
    return { type: "trace", label: "Trace moisture", severity: 1 };
  }
  if (rainTotal < 0.15) {
    return { type: "spotty", label: "Spotty showers", severity: 2 };
  }
  if (rainTotal < 0.40) {
    return { type: "light", label: "Light rain", severity: 3 };
  }
  if (rainTotal < 0.75) {
    return { type: "steady", label: "Steady rain", severity: 4 };
  }
  if (rainTotal < 1.25) {
    return { type: "soaking", label: "A soaking rain", severity: 5 };
  }
  return { type: "heavy", label: "Heavy rain", severity: 6 };
}

function classifySnow(snowTotal) {
  if (snowTotal < 0.05) {
    return { type: "none", label: "No snow", severity: 0 };
  }
  if (snowTotal < 0.10) {
    return { type: "flurries", label: "Flurries", severity: 1 };
  }
  if (snowTotal < 0.50) {
    return { type: "dusting", label: "Dusting possible", severity: 2 };
  }
  if (snowTotal < 1.0) {
    return { type: "light", label: "Light accumulation", severity: 3 };
  }
  if (snowTotal < 3.0) {
    return { type: "accumulating", label: "Accumulating snow", severity: 4 };
  }
  if (snowTotal < 6.0) {
    return { type: "plowable", label: "Plowable snow", severity: 5 };
  }
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
   PART 2.5 — SEASON‑AWARE COMFORT MODULE
   ---------------------------------------------------- */

function getSeasonalNormalHigh(month) {
  const normals = {
    0: 47, 1: 51, 2: 59, 3: 68,
    4: 75, 5: 82, 6: 85, 7: 84,
    8: 79, 9: 69, 10: 59, 11: 50
  };
  return normals[month];
}

function getTempAnomaly(temp, month) {
  const normal = getSeasonalNormalHigh(month);
  return temp - normal;
}

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

function describeAbsoluteFeel(temp) {
  if (temp >= 90) return "hot";
  if (temp >= 80) return "warm";
  if (temp >= 70) return "mild";
  if (temp >= 60) return "cool";
  if (temp >= 50) return "chilly";
  if (temp >= 40) return "cold";
  return "very cold";
}

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

function computeWetBulb(tempF, dewF) {
  if (tempF == null || dewF == null) return null;

  const spread = tempF - dewF;

  if (spread <= 2) return tempF - 0.5;
  if (spread >= 15) return tempF - 8;

  return tempF - (spread * 0.5);
}

function classifyHourlyPrecipType(tempF, dewF, snowIn) {
  if (snowIn != null && snowIn > 0.05) {
    return "snow";
  }

  const tw = computeWetBulb(tempF, dewF);
  if (tw == null) return "unknown";

  if (tw <= 31.5) return "snow";
  if (tw <= 33.0) return "mix";
  return "rain";
}

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

    if (tPrev != null && tCurr != null && tCurr < tPrev) {
      fallingTemps = true;
    }

    if (dPrev != null && dCurr != null && dCurr > dPrev) {
      risingDew = true;
    }

    if (g != null && g >= 10 && g <= 25) {
      cadWind = true;
    }
  }

  return fallingTemps && risingDew && cadWind;
}

function detectFreezingDrizzle(hourly, start, end) {
  const tempArr = hourly.temperature_2m || [];
  const dewArr
