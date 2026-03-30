// /intel/comfort.js
import { LOCATION } from "/js/config/location.js";

// ------------------------------------------------------------
// UTILS
// ------------------------------------------------------------
const cToF = c => (c * 9) / 5 + 32;

// ------------------------------------------------------------
// SOLAR ELEVATION
// ------------------------------------------------------------
function computeSolarElevation(timestamp, lat, lon) {
  const date = new Date(timestamp);
  const rad = Math.PI / 180;

  const day = Math.floor((date - new Date(date.getFullYear(), 0, 0)) / 86400000);

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
  if (tempF == null || dewF == null) return null;

  const t = (tempF - 32) * 5/9;
  const d = (dewF - 32) * 5/9;

  const rh =
    100 *
    (Math.exp((17.625 * d) / (243.04 + d)) /
     Math.exp((17.625 * t) / (243.04 + t)));

  return Math.max(0, Math.min(100, rh));
}

// ------------------------------------------------------------
// COMFORT SCORE (slight realism tweak: dryness weight reduced)
// ------------------------------------------------------------
function computeComfortScore(temp, dew, wind, elev, windDir) {
  if (temp == null || dew == null) return null;

  const rh = dewToRH(temp, dew);
  if (rh == null) return null;

  const tScore = Math.min(Math.abs(temp - 70) / 35, 1);

  let drynessPenalty =
    rh < 25 ? 1 :
    rh < 35 ? 0.75 :
    rh < 45 ? 0.5 : 0.2;

  const w = typeof wind === "number" ? wind : 0;
  let windPenalty = Math.min(w / 25, 1) * 0.4;

  const dir = String(windDir ?? "");
  if (dir.includes("W")) windPenalty += 0.2;

  let solarBonus = 0;
  if (elev > 20 && temp < 75) solarBonus = 0.15;

  const score =
    (tScore * 0.5) +
    (drynessPenalty * 0.6) + // slight realism improvement
    windPenalty -
    solarBonus;

  return Math.round(Math.max(0, Math.min(100, 100 - (score * 100))));
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
  if (dew == null) return null;
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
  const src = intel.tempest ?? intel.wu ?? {};
  const cloud = src.cloudCover ?? 100;
  const windDir = String(src.windDir ?? "");
  const trend = intel.tempTrend ?? 0;

  return (
    elev > 15 &&
    cloud < 60 &&
    trend >= 0 &&
    !windDir.includes("W")
  );
}

// ------------------------------------------------------------
// PRECIP FEEL
// ------------------------------------------------------------
function fallingPrecipFeel(intel) {
  const src = intel.tempest ?? intel.wu ?? {};
  const rate = src.precipRate ?? 0;
  const type = src.precipType ?? "";

  if (!rate || rate <= 0) return null;

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
// TREND + DROP
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
  const src = intel.tempest ?? intel.wu ?? {};
  const hour = new Date(src.obsTimeLocal ?? Date.now()).getHours();
  if (hour < 11) return null;

  const current = src.temp ?? null;

  const high =
    intel?.humanAction?.today?.stats?.tempMax ??
    intel?.humanAction?.tomorrow?.stats?.tempMax ??
    current;

  if (current == null || high == null) return null;

  const drop = high - current;

  if (drop >= 20) return "a sharp drop compared to earlier today";
  if (drop >= 12) return "noticeably colder than earlier today";
  if (drop >= 6) return "a cooler turn compared to earlier today";

  return null;
}

// ------------------------------------------------------------
// EMOJI PICKER
// ------------------------------------------------------------
function pickComfortEmoji(state) {
  return {
    cold: "🥶",
    cool: "🧥",
    mild: "🙂",
    warm: "😌",
    hot: "🥵"
  }[state] ?? "😐";
}

// ------------------------------------------------------------
// ⭐ MAIN ENGINE
// ------------------------------------------------------------
export function computeComfort(intel) {
  const src = intel.tempest ?? intel.wu ?? {};
  const sky = intel.sky ?? {};

  // src.temp and src.dewPoint are ALWAYS Fahrenheit here
  const temp = src.temp ?? 0;
  const dew = src.dewPoint ?? 0;
  const wind = src.windSpeed ?? 0;
  const windDir = src.windDir ?? "";
  const timestamp = src.obsTimeLocal ?? Date.now();

  const elev = computeSolarElevation(timestamp, LOCATION.lat, LOCATION.lon);
  const feelsLike = computeWindChill(temp, wind);

  const comfortScore = computeComfortScore(temp, dew, wind, elev, windDir);

  const precipOverride = fallingPrecipFeel(intel);
  if (precipOverride) {
    return {
      ...precipOverride,
      comfortScore,
      label: getComfortLabel(comfortScore),
      color: getComfortColor(comfortScore),
      feelsLike
    };
  }

   const comfortScore =
  temp != null
    ? computeComfortScore(temp, dew ?? temp - 20, wind, elev, windDir)
    : null;

  // Precip override
  const precipOverride = fallingPrecipFeel(intel);
  if (precipOverride) {
    return {
      ...precipOverride,
      comfortScore,
      label: getComfortLabel(comfortScore),
      color: getComfortColor(comfortScore),
      feelsLike
    };
  }

  // State
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

  if (isSolarHelpful(intel, elev)) {
    parts.push(sunAngleFeel(elev));
  }

  if (wind >= 15) {
    parts.push("A noticeable breeze adds some edge.");
  }

  if (comfortScore != null && comfortScore < 45) {
    parts.push("Dry air and wind are increasing fire danger.");
  }

  const summary = parts.join(" ");

  const sentences = summary.split(". ").filter(Boolean);

  const line1 = sentences[0]
    ? sentences[0] + (sentences[0].endsWith('.') ? '' : '.')
    : "";

  const line2 = sentences.slice(1).join(". ");

  return {
    emoji,
    summary,
    line1,
    line2,
    comfortScore,
    label: getComfortLabel(comfortScore),
    color: getComfortColor(comfortScore),
    feelsLike
  };
}

// ------------------------------------------------------------
// FUTURE COMFORT (FIXED)
// ------------------------------------------------------------
export function buildFutureComfort(hourlyNormalized, computeComfortFn = computeComfort) {
  if (!Array.isArray(hourlyNormalized) || hourlyNormalized.length === 0) return [];

  const now = Date.now();
  let startIndex = hourlyNormalized.findIndex(h => h.timestamp > now);
  if (startIndex === -1) startIndex = 0;

  const items = [];

for (let i = 0; i < 6; i++) {
  const idx = startIndex + i;
  if (idx >= hourlyNormalized.length) break;

  const h = hourlyNormalized[idx];

  console.log("TEMP DEBUG", {
    raw: h.temperature,
    fahrenheit: cToF(h.temperature)
  });

  const intelForHour = {
    wu: {
      temp: h.temperature,
      dewPoint: h.dewpoint,
      windSpeed: h.wind_speed,
      windDir: h.wind_dir,
      obsTimeLocal: h.timestamp,
      alreadyFahrenheit: true
    }
  };

    const c = computeComfortFn(intelForHour);

    items.push({
      index: idx,
      time: h.timestamp,
      hourLabel: h.timestamp ? formatHourLabel(h.timestamp) : `+${i}h`,
      comfortScore: c?.comfortScore ?? null,
      color: c?.color,
      label: c?.label,
      emoji: c?.emoji,
      temp: h.temperature,
      dew: h.dewpoint,
      wind: h.wind_speed
    });
  }

  return items;
}

// ------------------------------------------------------------
// TIME FORMAT
// ------------------------------------------------------------
function formatHourLabel(ts) {
  const d = new Date(ts);

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