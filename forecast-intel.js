// forecast-intel.js
// 828 Weather Direct — Forecast Intelligence Engine
// COMPLETE, CLEAN, DEDUPED, TIME-CORRECTED VERSION

// ----------------------------------------------------
// PART 1 — Core Helpers + Hourly Window Tools
// ----------------------------------------------------

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

function getTomorrowWindow(hourly) {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  return getHourlyWindowForDay(hourly, tomorrow);
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
// PART 2 — Stats + Derived Metrics
// ----------------------------------------------------

function basicStats(arr) {
  if (!arr || !arr.length) return { min: null, max: null, avg: null };
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
  return arr.length ? arr.reduce((a, b) => a + b, 0) : 0;
}

function getSnowTotal(windowed) {
  const arr = windowed.snowfall || [];
  return arr.length ? arr.reduce((a, b) => a + b, 0) : 0;
}

// ----------------------------------------------------
// PART 3 — Descriptors + Simple Impact Helpers
// ----------------------------------------------------

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
  if (gustMax >= 45) return "very windy";
  if (gustMax >= 40) return "quite gusty";
  if (gustMax >= 35) return "breezy at times";
  if (gustMax >= 30) return "a light breeze";
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

// ----------------------------------------------------
// PART 4 — Human‑Action Outlook
// ----------------------------------------------------
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

  /* ----------------------------------------------------
     IMPACT SCORING
  ---------------------------------------------------- */

  const drivers = [];

  // Snow
  if (snowTotal > 0.05) {
    drivers.push({
      type: "snow",
      score: 80 + snowTotal * 10
    });
  }

  // Heavy rain
  if (precipTotal >= 0.25 && snowTotal === 0) {
    drivers.push({
      type: "rain",
      score: 60 + precipTotal * 20
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

  // Default if nothing significant
  if (!drivers.length) {
    drivers.push({ type: "easy", score: 10 });
  }

  // Select highest impact
  drivers.sort((a, b) => b.score - a.score);
  const dominant = drivers[0].type;

  /* ----------------------------------------------------
     ACTION MAPPING
  ---------------------------------------------------- */

  let badgeText = "Easy Day";
  let badgeClass = "badge-easy";
  let emoji = "🙂";
  let action = "Go about your day as usual.";
  let reason = `${tempDesc}. Expect ${precipDesc} with ${windDesc}.`;

  switch (dominant) {

    case "snow":
      badgeText = "Snow Impact";
      badgeClass = "badge-snow";
      emoji = "❄️";
      action = "Allow extra travel time.";
      reason = `${precipDesc}. Roads could become slick. ${windDesc}.`;
      break;

    case "rain":
      badgeText = "Rain Gear";
      badgeClass = "badge-rain";
      emoji = "🌧️";
      action = "Bring a rain jacket.";
      reason = `${precipDesc}. ${windDesc}.`;
      break;

    case "wind":
      badgeText = "Wind Alert";
      badgeClass = "badge-wind";
      emoji = "💨";
      action = "Secure loose outdoor items.";
      reason = `${windDesc}. ${tempDesc}.`;
      break;

    case "heat":
      badgeText = "Heat Caution";
      badgeClass = "badge-heat";
      emoji = "🥵";
      action = "Stay hydrated.";
      reason = `${tempDesc}. Heat index may rise during the afternoon.`;
      break;

    case "cold":
      badgeText = "Cold Prep";
      badgeClass = "badge-cold";
      emoji = "🥶";
      action = "Dress in warm layers.";
      reason = `${tempDesc}. Wind may make it feel colder.`;
      break;

    case "goldilocks":
      badgeText = "Goldilocks Day";
      badgeClass = "badge-goldilocks";
      emoji = "🌟";
      action = "Make outdoor plans.";
      reason = `${tempDesc}. Dry conditions with light winds.`;
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

  // ⭐ FIXED: Always use Asheville local time
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hour12: false,
      timeZone: "America/New_York"
    }).format(now)
  );

  const month = now.getMonth();

  const isGoldilocks =
    temp >= 68 && temp <= 74 &&
    dew >= 45 && dew <= 52 &&
    gust < 15 &&
    precip < 0.02;

  if (isGoldilocks) {
    return { text: "Goldilocks — just right.", emoji: "🌟" };
  }

  let feel;
  if (temp <= 25) feel = "biting";
  else if (temp <= 40) feel = "cold";
  else if (temp <= 48) feel = "chilly";
  else if (temp <= 58) feel = "cool";
  else if (temp <= 70) feel = "mild";
  else if (temp <= 82) feel = "warm";
  else feel = "hot";

  let nuance = "";
  if (dew >= 65) nuance = "humid";
  else if (dew < 40) nuance = "crisp";

  if (gust >= 40) nuance = "windy";
  else if (gust >= 30) nuance = "breezy";

  const personality = getPersonalityPhrase(feel, nuance);

  const normal = (hour < 11 || hour >= 18)
    ? NORMAL_LOWS[month]
    : NORMAL_HIGHS[month];

  const diff = temp - normal;
  const absDiff = Math.abs(diff);

  if (absDiff > 10) {
    const seasonal =
      diff > 10
        ? `unusually warm for ${monthName(month)}`
        : `much colder than normal for ${monthName(month)}`;

    return {
      text: `${personality} — ${seasonal}`,
      emoji: comfortEmoji(feel)
    };
  }

  return {
    text: personality,
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
// PART 6 — Forecast Alerts
// ----------------------------------------------------

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

// ----------------------------------------------------
// PART 7 — Default Export Bundle
// ----------------------------------------------------

export default {
  getHumanActionOutlook,
  getComfortCategory,
  getForecastAlerts
};
