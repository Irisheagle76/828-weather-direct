// /intel/synthesizer.js
// Human‑Action 2.x Premium Narrative Generator — Tomorrow‑Aware Edition

// ------------------------------------------------------------
// MAIN ENTRY
// ------------------------------------------------------------
export function generateNarrative(intel, isTomorrow = false) {
  if (!intel) {
    return {
      emoji: "🌤️",
      title: "A steady, uncomplicated day",
      main: "Conditions stay manageable with no strong weather drivers.",
      bullets: []
    };
  }

  // TODAY: single snapshot
  if (!isTomorrow) {
    return generateTodayNarrative(intel);
  }

  // TOMORROW: morning + afternoon + stats
  return generateTomorrowNarrative(intel);
}

// ------------------------------------------------------------
// TODAY NARRATIVE
// ------------------------------------------------------------
function generateTodayNarrative(intel) {
  const { dominantFactor, secondaryFactors, confidence, notes, snapshot } = intel;

  const emoji = pickEmoji(dominantFactor, secondaryFactors, snapshot);
  const title = pickTitle(dominantFactor, snapshot);
  const main = buildMainNarrative(dominantFactor, secondaryFactors, notes, snapshot, confidence);
  const bullets = buildBullets(dominantFactor, secondaryFactors, snapshot, confidence);

  return { emoji, title, main, bullets };
}

// ------------------------------------------------------------
// TOMORROW NARRATIVE — Morning + Afternoon + Stats
// ------------------------------------------------------------
function generateTomorrowNarrative(intel) {
  const { morning, afternoon, stats } = intel;

  const dominant = intel.dominantFactor;
  const secondary = intel.secondaryFactors;
  const confidence = intel.confidence;
  const notes = intel.notes;

  const emoji = pickEmoji(dominant, secondary, morning);
  const title = pickTomorrowTitle(dominant, morning, afternoon, stats);

  const main = buildTomorrowMain(morning, afternoon, stats, notes, dominant);
  const bullets = buildTomorrowBullets(morning, afternoon, stats, dominant);

  return { emoji, title, main, bullets };
}

// ------------------------------------------------------------
// TOMORROW TITLE — Based on morning → afternoon evolution
// ------------------------------------------------------------
function pickTomorrowTitle(factor, morning, afternoon, stats) {
  const warmup = afternoon.temp - morning.temp;
  const cloudShift = afternoon.cloudCover - morning.cloudCover;

  if (warmup >= 10) return "A day that warms up nicely";
  if (warmup <= -8) return "A cooler, more settled day";

  if (cloudShift <= -30) return "A day that brightens as it goes";
  if (cloudShift >= 30) return "Clouds build through the afternoon";

  const map = {
    cold: "A chilly start, steady later",
    heat: "Warmth builds through the day",
    rain: "Rain shapes much of the day",
    snow: "Snowy at times",
    fog: "Fog early, clearer later",
    valleyFog: "Valley fog to start",
    ridgeFog: "Ridge‑top fog early",
    default: "A steady, uncomplicated day"
  };

  return map[factor] ?? map.default;
}

// ------------------------------------------------------------
// TOMORROW MAIN NARRATIVE
// ------------------------------------------------------------
function buildTomorrowMain(morning, afternoon, stats, notes, factor) {
  const parts = [];

  // Engine notes
  if (notes) parts.push(notes);

  // Morning feel
  const mT = morning.feelsLike ?? morning.temp;
  if (mT <= 32) parts.push("The morning starts cold, especially in shaded spots.");
  else if (mT <= 45) parts.push("A cool morning feel settles in.");
  else if (mT >= 80) parts.push("The morning starts warm and energetic.");

  // Afternoon feel
  const aT = afternoon.feelsLike ?? afternoon.temp;
  if (aT >= mT + 10) parts.push("A noticeable warmup develops into the afternoon.");
  else if (aT <= mT - 8) parts.push("Temperatures ease downward later in the day.");

  // Cloud evolution
  if (afternoon.cloudCover - morning.cloudCover >= 30) {
    parts.push("Clouds thicken as the day goes on.");
  } else if (afternoon.cloudCover - morning.cloudCover <= -30) {
    parts.push("Skies brighten compared to the morning.");
  }

  // Precip
  if (stats.rainTotal > 0.25) parts.push("Rain is a recurring theme.");
  else if (stats.rainTotal > 0) parts.push("A few showers may pass through.");

  if (stats.snowTotal > 0) parts.push("Snow is possible at times.");

  // Fog
  if (factor.includes("fog")) parts.push("Fog may linger early before lifting.");

  return parts.join(" ").trim();
}

// ------------------------------------------------------------
// TOMORROW BULLETS
// ------------------------------------------------------------
function buildTomorrowBullets(morning, afternoon, stats, factor) {
  const bullets = [];

  const mT = morning.feelsLike ?? morning.temp;
  const aT = afternoon.feelsLike ?? afternoon.temp;

  // Clothing
  if (mT <= 40) bullets.push("A warm layer helps early.");
  if (aT >= 80) bullets.push("Light clothing works best for the afternoon.");

  // Wind
  if (stats.windGustMax >= 35) bullets.push("Expect pushy gusts on ridge lines.");
  else if (stats.windGustMax >= 20) bullets.push("A breezy feel develops at times.");

  // Precip
  if (stats.rainTotal >= 0.25) bullets.push("Rain gear is worth having nearby.");
  else if (stats.rainTotal > 0) bullets.push("A quick shower is possible.");

  if (stats.snowTotal > 0) bullets.push("Watch for slick spots early.");

  // Fog
  if (factor.includes("fog")) bullets.push("Visibility may be limited early.");

  return bullets;
}

// ------------------------------------------------------------
// TODAY HELPERS (unchanged from premium version)
// ------------------------------------------------------------
function pickEmoji(factor, secondary, snap) {
  const t = snap?.feelsLike ?? snap?.temp ?? null;

  const map = {
    cold: ["🥶", "🧊", "❄️"],
    heat: ["🥵", "🔥", "🌞"],
    wind: ["💨", "🌬️", "🍃"],
    mountainWind: ["🌬️", "🌪️"],
    rain: ["🌧️", "🌦️", "☔"],
    coldRain: ["🌧️", "🥶"],
    warmRain: ["🌦️", "🌧️"],
    snow: ["❄️", "🌨️", "☃️"],
    fog: ["🌫️"],
    valleyFog: ["🌫️"],
    ridgeFog: ["🌫️"],
    freezingFog: ["🌫️", "🧊"],
    frost: ["❄️"],
    freeze: ["🧊"],
    blackIce: ["🧊", "⚠️"],
    smoke: ["🌫️", "🔥"],
    haze: ["🌫️"],
    uv: ["🌞"],
    sun: ["🌤️"],
    clouds: ["☁️"],
    inversion: ["↕️"],
    default: ["🌤️"]
  };

  const list = map[factor] ?? map.default;

  if (t != null) {
    if (t <= 25) list.push("🥶");
    if (t >= 90) list.push("🥵");
  }

  return list[Math.floor(Math.random() * list.length)];
}

function pickTitle(factor, snap) {
  const t = snap?.temp ?? null;

  const map = {
    cold: "Cold takes the lead",
    heat: "Heat sets the tone",
    wind: "Wind shapes the feel",
    mountainWind: "Mountain winds stand out",
    rain: "Rain drives the day",
    coldRain: "Cold rain dominates",
    warmRain: "Warm rain moves through",
    snow: "Snow is the headline",
    fog: "Fog trims visibility",
    valleyFog: "Valley fog settles in",
    ridgeFog: "Ridge‑top fog develops",
    freezingFog: "Freezing fog concerns",
    frost: "Frost risk early",
    freeze: "Freeze conditions",
    blackIce: "Black ice concerns",
    smoke: "Smoke reduces clarity",
    haze: "Hazy conditions",
    uv: "Stronger sun and UV",
    sun: "Bright and clear",
    clouds: "Clouds dominate",
    inversion: "Inversion shapes the feel",
    default: "A steady, uncomplicated day"
  };

  let base = map[factor] ?? map.default;

  if (t != null) {
    if (t <= 32 && factor === "cold") base = "A winter‑sharp chill";
    if (t >= 85 && factor === "heat") base = "A summer‑heavy warmth";
  }

  return base;
}

function buildMainNarrative(factor, secondary, notes, snap, confidence) {
  const parts = [];

  if (notes) parts.push(notes);

  const f = snap?.feelsLike ?? null;
  if (f != null) {
    if (f <= 25) parts.push("It feels sharply cold, especially in shaded spots.");
    else if (f <= 40) parts.push("A chilly feel lingers, especially in the valleys.");
    else if (f >= 85) parts.push("Warmth builds with a noticeable edge.");
  }

  if (snap?.dewpoint >= 65) parts.push("Humidity adds a heavier, Southern‑summer feel.");
  else if (snap?.dewpoint <= 40) parts.push("Dry air keeps things crisp and comfortable.");

  if (snap?.visibility != null && snap.visibility < 2) {
    parts.push("Visibility is reduced at times, especially near river valleys.");
  }

  if (snap?.windGust >= 30) parts.push("Gusts may feel pushy on exposed ridges.");
  else if (snap?.windGust >= 15) parts.push("A steady breeze adds some movement to the air.");

  if (confidence <= 0.4) {
    parts.push("Forecast confidence is lower than usual due to shifting patterns.");
  }

  return parts.join(" ").trim();
}

function buildBullets(factor, secondary, snap, confidence) {
  const bullets = [];

  const f = snap?.feelsLike ?? null;

  if (f != null) {
    if (f <= 40) bullets.push("Layers help, especially early.");
    else if (f <= 55) bullets.push("A light jacket is a smart move.");
    else if (f >= 80) bullets.push("Light clothing keeps things comfortable.");
  }

  if (snap?.windGust >= 35) bullets.push("Expect pushy gusts on ridge lines.");
  else if (snap?.windGust >= 20) bullets.push("A breezy feel develops at times.");

  if (factor.includes("rain")) bullets.push("Rain gear is worth having nearby.");
  if (factor === "snow") bullets.push("Watch for slick spots early.");
  if (factor === "blackIce") bullets.push("Be cautious on bridges and shaded roads.");

  if (factor.includes("fog")) bullets.push("Visibility may be limited in valleys and hollows.");

  if (factor === "uv") bullets.push("Midday sun runs stronger — consider protection.");

  if (factor === "smoke" || factor === "haze") {
    bullets.push("Air quality may feel reduced at times.");
  }

  if (secondary?.length) {
    bullets.push(`Secondary influences: ${secondary.join(", ")}.`);
  }

  if (confidence <= 0.4) {
    bullets.push("Expect some variability as patterns shift.");
  }

  return bullets;
}