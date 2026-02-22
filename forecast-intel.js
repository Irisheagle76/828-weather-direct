// forecast-intel.js
// 828 Weather Direct — Core forecast intelligence
// Part 1 — Core helpers + hourly window tools

// ---------------- CORE HELPERS ----------------

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

function sameCalendarDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// ---------------- HOURLY WINDOW TOOLS ----------------

// Given Open-Meteo hourly object and a target Date (local),
// return indices that fall on that calendar day.
function getHourlyWindowForDay(hourly, targetDate) {
  const times = hourly.time || [];
  const indices = [];

  const start = new Date(targetDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(targetDate);
  end.setHours(23, 59, 59, 999);

  for (let i = 0; i < times.length; i++) {
    const t = toLocalDate(times[i]);
    if (t >= start && t <= end) {
      indices.push(i);
    }
  }
  return indices;
}

// Tomorrow’s calendar-day window (local)
function getTomorrowWindow(hourly) {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  return getHourlyWindowForDay(hourly, tomorrow);
}

// Slice an hourly object down to a set of indices
function sliceHourly(hourly, indices) {
  const result = {};
  for (const key of Object.keys(hourly)) {
    const arr = hourly[key];
    if (!Array.isArray(arr)) continue;
    result[key] = indices.map(i => arr[i]);
  }
  return result;
}

// Daypart window (e.g., 8–18 local)
function getDaypartWindow(hourly, targetDate, startHour, endHour) {
  const times = hourly.time || [];
  const indices = [];

  const start = new Date(targetDate);
  start.setHours(startHour, 0, 0, 0);
  const end = new Date(targetDate);
  end.setHours(endHour, 59, 59, 999);

  for (let i = 0; i < times.length; i++) {
    const t = toLocalDate(times[i]);
    if (t >= start && t <= end) {
      indices.push(i);
    }
  }
  return indices;
}
// Part 2 — Stats + derived metrics

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

function getTempStats(windowed) {
  return basicStats(windowed.temperature_2m || []);
}

function getDewStats(windowed) {
  return basicStats(windowed.dewpoint_2m || []);
}

function getWindGustStats(windowed) {
  return basicStats(windowed.windgusts_10m || []);
}

function getUVStats(windowed) {
  return basicStats(windowed.uv_index || []);
}

function getPrecipTotal(windowed) {
  const arr = windowed.precipitation || [];
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0);
}

function getSnowTotal(windowed) {
  const arr = windowed.snowfall || [];
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0);
}
// Part 3 — Descriptors + simple impact helpers

function describePrecip(precipTotal, snowTotal) {
  if (snowTotal > 0.05) {
    if (snowTotal >= 2) return "notable snow";
    if (snowTotal >= 0.5) return "light accumulating snow";
    return "flurries or very light snow";
  }

  if (precipTotal < 0.02) return "mainly dry";
  if (precipTotal < 0.10) return "a few light showers";
  if (precipTotal < 0.25) return "on-and-off showers";
  if (precipTotal < 0.75) return "a soaking rain at times";
  return "periods of heavy rain";
}

function describeWind(gustMax) {
  if (gustMax >= 40) return "very windy";
  if (gustMax >= 30) return "quite gusty";
  if (gustMax >= 20) return "breezy at times";
  if (gustMax >= 10) return "a light breeze";
  return "generally light wind";
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
// Part 4 — Human-Action Outlook (Option A style)
// Uses tomorrow’s full-day window + comfort + simple impacts

// Exposed:
//   export function getHumanActionOutlook(hourly)
// Returns:
//   {
//     badge: { text, class },
//     emoji,
//     headline,
//     text
//   }

export function getHumanActionOutlook(hourly) {
  const indices = getTomorrowWindow(hourly);
  if (!indices.length) {
    return {
      badge: { text: "No data", class: "badge-neutral" },
      emoji: "❓",
      headline: "Tomorrow’s outlook is unavailable",
      text: "We couldn’t find a usable forecast window for tomorrow."
    };
  }

  const win = sliceHourly(hourly, indices);
  const tempStats = getTempStats(win);
  const dewStats = getDewStats(win);
  const windStats = getWindGustStats(win);
  const uvStats = getUVStats(win);
  const precipTotal = getPrecipTotal(win);
  const snowTotal = getSnowTotal(win);

  const avgTemp = tempStats.avg ?? tempStats.max ?? tempStats.min ?? null;
  const avgDew = dewStats.avg ?? avgTemp ?? 50;
  const gustMax = windStats.max ?? 0;

  const comfort = avgTemp != null
    ? getComfortCategory(avgTemp, avgDew, gustMax, precipTotal)
    : { text: "Comfort unknown", emoji: "❓" };

  const precipDesc = describePrecip(precipTotal, snowTotal);
  const windDesc = describeWind(gustMax);
  const tempDesc = describeTempRange(tempStats);

  // ---------------- BADGE LOGIC (Option A) ----------------
  let badgeText = "Easy Day";
  let badgeClass = "badge-easy";
  let emoji = "🙂";
  let headline = "A fairly straightforward day ahead.";
  let detail = `${tempDesc}. Expect ${precipDesc} with ${windDesc}. ${comfort.text}`;

  // Goldilocks detection via comfort text
  const isGoldilocks = comfort.text.startsWith("Goldilocks");
  if (isGoldilocks) {
    badgeText = "Goldilocks Day";
    badgeClass = "badge-goldilocks";
    emoji = "🌟";
    headline = "Just right — a Goldilocks kind of day.";
    detail = `${comfort.text} ${precipDesc !== "mainly dry" ? `Also, ${precipDesc}.` : ""}`.trim();
  }

  if (!isGoldilocks && precipTotal >= 0.25 && snowTotal === 0) {
    badgeText = "Rain Gear";
    badgeClass = "badge-rain";
    emoji = "🌧️";
    headline = "Have rain gear handy tomorrow.";
    detail = `${precipDesc}. ${windDesc}. ${comfort.text}`;
  }

  if (!isGoldilocks && snowTotal > 0.05) {
    badgeText = "Snow Impact";
    badgeClass = "badge-snow";
    emoji = "❄️";
    headline = "Snow may impact your plans.";
    detail = `${precipDesc}. ${windDesc}. ${comfort.text}`;
  }

  if (!isGoldilocks && gustMax >= 30) {
    badgeText = "Wind Alert";
    badgeClass = "badge-wind";
    emoji = "💨";
    headline = "It will be quite windy at times.";
    detail = `${windDesc}. ${precipDesc}. ${comfort.text}`;
  }

  // Mild, low-impact day
  if (
    !isGoldilocks &&
    precipTotal < 0.10 &&
    snowTotal === 0 &&
    gustMax < 20 &&
    avgTemp != null &&
    avgTemp >= 55 &&
    avgTemp <= 78
  ) {
    badgeText = "Easy Outdoor Day";
    badgeClass = "badge-easy";
    emoji = "🌤️";
    headline = "A great day to be outside.";
    detail = `${tempDesc}. ${comfort.text}`;
  }

  return {
    badge: {
      text: badgeText,
      class: badgeClass
    },
    emoji,
    headline,
    text: detail
  };
}
// Part 5 — Comfort Module 2.1 (Goldilocks) + alerts + exports

// ---------------- CLIMATOLOGY ----------------

const ASHEVILLE_NORMALS = {
  0: 47,  // Jan
  1: 51,  // Feb
  2: 59,  // Mar
  3: 68,  // Apr
  4: 75,  // May
  5: 82,  // Jun
  6: 85,  // Jul
  7: 84,  // Aug
  8: 78,  // Sep
  9: 69,  // Oct
  10: 59, // Nov
  11: 50  // Dec
};

function monthName(i) {
  return [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December"
  ][i];
}

// ---------------- COMFORT MODULE 2.1 (with Goldilocks) ----------------
// temp: °F, dew: °F, gust: mph, precip: inches (optional)
export function getComfortCategory(temp, dew, gust, precip = 0) {
  const month = new Date().getMonth();
  const normal = ASHEVILLE_NORMALS[month];

  // GOLDILOCKS OVERRIDE
  const isGoldilocks =
    temp >= 68 && temp <= 74 &&
    dew >= 45 && dew <= 52 &&
    gust < 15 &&
    precip < 0.02;

  if (isGoldilocks) {
    return {
      text: "Goldilocks — just right.",
      emoji: "🌟"
    };
  }

  // ABSOLUTE FEEL
  let feel;
  if (temp <= 40) feel = "Cold";
  else if (temp <= 59) feel = "Cool";
  else if (temp <= 72) feel = "Mild";
  else if (temp <= 82) feel = "Warm";
  else feel = "Hot";

  // HUMIDITY / WIND NUANCE
  let nuance = "";
  if (dew < 40) nuance = "crisp";
  else if (dew >= 65) nuance = "humid";

  if (gust >= 30) nuance = "windy";
  else if (gust >= 20) nuance = "breezy";

  // SEASONAL CONTEXT
  const diff = temp - normal;
  let seasonal;

  if (Math.abs(diff) <= 3) {
    seasonal = `seasonable for ${monthName(month)}`;
  } else if (diff > 3 && diff <= 9) {
    seasonal = `mild for ${monthName(month)}`;
  } else if (diff >= 10) {
    seasonal = `unusually warm for ${monthName(month)}`;
  } else if (diff < -3 && diff >= -9) {
    seasonal = `cooler than normal for ${monthName(month)}`;
  } else {
    seasonal = `much colder than normal for ${monthName(month)}`;
  }

  const nuancePart = nuance ? ` and ${nuance}` : "";
  const phrase = `${feel}${nuancePart} — ${seasonal}`;

  return {
    text: phrase,
    emoji: comfortEmoji(feel)
  };
}

function comfortEmoji(feel) {
  switch (feel) {
    case "Cold": return "🥶";
    case "Cool": return "🧥";
    case "Mild": return "🙂";
    case "Warm": return "🌤️";
    case "Hot": return "🔥";
    default: return "🌡️";
  }
}

// ---------------- FORECAST ALERT ICONS (Option A style) ----------------
// Returns array of { id, icon, title, detail }

export function getForecastAlerts(hourly) {
  const indices = getTomorrowWindow(hourly);
  if (!indices.length) return [];

  const win = sliceHourly(hourly, indices);
  const tempStats = getTempStats(win);
  const windStats = getWindGustStats(win);
  const precipTotal = getPrecipTotal(win);
  const snowTotal = getSnowTotal(win);

  const alerts = [];
  let idCounter = 1;

  if (precipTotal >= 0.25 && snowTotal === 0) {
    alerts.push({
      id: `rain-${idCounter++}`,
      icon: "🌧️",
      title: "Rain likely",
      detail: "Rain is expected at times tomorrow. Have an umbrella or rain jacket handy."
    });
  }

  if (snowTotal > 0.05) {
    alerts.push({
      id: `snow-${idCounter++}`,
      icon: "❄️",
      title: "Snow potential",
      detail: "Snow is in the forecast. Roads and travel may be impacted."
    });
  }

  const gustMax = windStats.max ?? 0;
  if (gustMax >= 30) {
    alerts.push({
      id: `wind-${idCounter++}`,
      icon: "💨",
      title: "Gusty winds",
      detail: "Stronger gusts may affect outdoor plans and make it feel colder."
    });
  }

  const maxTemp = tempStats.max;
  if (maxTemp != null && maxTemp >= 85) {
    alerts.push({
      id: `heat-${idCounter++}`,
      icon: "🔥",
      title: "Hot afternoon",
      detail: "Afternoon temperatures may feel hot. Hydration and shade are a good idea."
    });
  }

  const minTemp = tempStats.min;
  if (minTemp != null && minTemp <= 28) {
    alerts.push({
      id: `freeze-${idCounter++}`,
      icon: "🧊",
      title: "Freeze risk",
      detail: "Overnight temperatures may dip below freezing. Sensitive plants and pipes could be at risk."
    });
  }

  return alerts;
}

// ---------------- DEFAULT EXPORT BUNDLE ----------------

export default {
  getHumanActionOutlook,
  getComfortCategory,
  getForecastAlerts
};
