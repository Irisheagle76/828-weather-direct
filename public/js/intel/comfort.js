// /intel/comfort.js
// ============================================================
// COMFORT ENGINE — v2.8 (Stable, Drift-Proof, HA2.0 Compatible)
// ============================================================

import { LOCATION } from "/js/config/location.js";

// ------------------------------------------------------------
// SOLAR ELEVATION
// ------------------------------------------------------------
function computeSolarElevation(timestamp, lat, lon) {
  const date = new Date(timestamp);
  const rad = Math.PI / 180;

  const day = Math.floor(
    (date - new Date(date.getFullYear(), 0, 0)) / 86400000
  );

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

  const t = (tempF - 32) * 5 / 9;
  const d = (dewF - 32) * 5 / 9;

  const rh =
    100 *
    (Math.exp((17.625 * d) / (243.04 + d)) /
     Math.exp((17.625 * t) / (243.04 + t)));

  return Math.max(0, Math.min(100, rh));
}

// ------------------------------------------------------------
// COMFORT SCORE
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
    (drynessPenalty * 0.6) +
    windPenalty -
    solarBonus;

  return Math.round(
    Math.max(0, Math.min(100, 100 - score * 100))
  );
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
  if (tempF == null) return null;
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
// ⭐ COMFORT NOW — v3.0 (Unified, Human-Warm, No Bullets)
// ------------------------------------------------------------
export function computeComfort(intel) {
  const src = intel.tempest ?? intel.wu ?? {};
  const temp = src.temp ?? null;
  const dew = src.dewPoint ?? (temp != null ? temp - 20 : null);
  const wind = src.windSpeed ?? 0;
  const windDir = src.windDir ?? "";
  const timestamp = src.obsTimeLocal ?? Date.now();

  const elev = computeSolarElevation(timestamp, LOCATION.lat, LOCATION.lon);
  const feelsLike = computeWindChill(temp, wind);

  // Compute score
  const comfortScore =
    temp != null
      ? computeComfortScore(temp, dew, wind, elev, windDir)
      : null;

  // ------------------------------------------------------------
  // CATEGORY (Unified with Human-Action)
  // ------------------------------------------------------------
  let category = "Harsh";
  if (comfortScore >= 80) category = "Comfortable";
  else if (comfortScore >= 65) category = "Slightly Uncomfortable";
  else if (comfortScore >= 45) category = "Uncomfortable";

  // ------------------------------------------------------------
  // EMOJI (aligned with category)
  // ------------------------------------------------------------
  const emojiMap = {
    Comfortable: "🙂",
    "Slightly Uncomfortable": "😐",
    Uncomfortable: "😣",
    Harsh: "🤯"
  };
  const emoji = emojiMap[category] ?? "😐";

  // ------------------------------------------------------------
  // HEADLINE (Tone 2 — human-warm, concise)
  // ------------------------------------------------------------
  let headline = "";
  const rhFeel = humidityFeel(dew);

  if (category === "Comfortable") {
    headline = rhFeel
      ? `Comfortable with ${rhFeel.replace(".", "").toLowerCase()}.`
      : "Comfortable overall.";
  } else if (category === "Slightly Uncomfortable") {
    headline = rhFeel
      ? `Slightly uncomfortable with ${rhFeel.replace(".", "").toLowerCase()}.`
      : "Slightly uncomfortable overall.";
  } else if (category === "Uncomfortable") {
    headline = rhFeel
      ? `Uncomfortable due to ${rhFeel.replace(".", "").toLowerCase()}.`
      : "Uncomfortable overall.";
  } else {
    headline = rhFeel
      ? `Harsh conditions with ${rhFeel.replace(".", "").toLowerCase()}.`
      : "Harsh conditions overall.";
  }

  // ------------------------------------------------------------
  // LONG NARRATIVE (Tone 2 — warm, Asheville-aware, not verbose)
  // ------------------------------------------------------------
  const parts = [];

  // Wind
  if (wind >= 15) {
    parts.push("A noticeable breeze adds some edge.");
  } else if (wind >= 8) {
    parts.push("A light breeze moves through at times.");
  }

  // Sun angle
  if (isSolarHelpful(intel, elev)) {
    parts.push(sunAngleFeel(elev));
  }

  // Trend
  const trend = computeShortTermTrend(intel);
  if (trend) {
    parts.push(`Expect conditions to be ${trend} soon.`);
  }

  const narrative = parts.length > 0 ? parts.join(" ") : null;

  // ------------------------------------------------------------
  // FINAL SHAPE (clean, predictable, renderer-friendly)
  // ------------------------------------------------------------
  return {
    category,
    emoji,
    headline,
    narrative,
    comfortScore,
    feelsLike,
    temp,
    dewpoint: dew,
    humidity: dewToRH(temp, dew),
    wind,
    color: getComfortColor(comfortScore),
    scoreExplainer:
      "Comfort Score blends temperature, dew point, humidity, wind, and sun angle into a 0–100 scale (higher is better)."
  };
}
// ------------------------------------------------------------
// FUTURE COMFORT
// ------------------------------------------------------------
export function buildFutureComfort(
  hourlyNormalized,
  computeComfortFn = computeComfort
) {
  if (!Array.isArray(hourlyNormalized) || hourlyNormalized.length === 0) {
    return [];
  }

  const now = Date.now();
  let startIndex = hourlyNormalized.findIndex(h => h.timestamp > now);
  if (startIndex === -1) startIndex = 0;

  const items = [];

  for (let i = 0; i < 6; i++) {
    const idx = startIndex + i;
    if (idx >= hourlyNormalized.length) break;

    const h = hourlyNormalized[idx];

    const intelForHour = {
      wu: {
        temp: h.temperatureF ?? null,
        dewPoint: h.dewpointF ?? null,
        windSpeed: h.wind_speed ?? 0,
        windDir: h.wind_dir ?? "",
        obsTimeLocal: h.timestamp
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
      temp: h.temperatureF ?? null,
      dew: h.dewpointF ?? null,
      wind: h.wind_speed ?? null
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
