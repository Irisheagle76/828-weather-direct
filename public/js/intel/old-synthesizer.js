// /intel/synthesizer.js
// Human-Action 2.x Premium Narrative Generator — Synthesizer 3.0
// Divergence-aware, HA2.2 compatible, temporal framing enabled.

// ------------------------------------------------------------
// UTILS — GLOBAL SAFETY
// ------------------------------------------------------------
function safeString(v) {
  return typeof v === "string" ? v : "";
}

function safeArray(arr) {
  return Array.isArray(arr) ? arr : [];
}

function cleanArray(arr) {
  return safeArray(arr).filter(v => typeof v === "string" && v.trim().length);
}

function safeNumber(n) {
  return typeof n === "number" && !isNaN(n) ? n : null;
}

// ------------------------------------------------------------
// MAIN ENTRY — NOW TEMPORALLY AWARE
// ------------------------------------------------------------
export function generateNarrative(intel) {
  if (!intel) {
    return {
      emoji: "🌤️",
      title: "A steady, uncomplicated day",
      main: "Conditions stay manageable with no strong weather drivers.",
      bullets: []
    };
  }

  const isTomorrow =
    intel.isTomorrow === true ||
    intel.dayLabel === "tomorrow";

  return isTomorrow
    ? generateTomorrowNarrative(intel)
    : generateTodayNarrative(intel);
}

// ------------------------------------------------------------
// TODAY
// ------------------------------------------------------------
function generateTodayNarrative(intel) {
  const factor = safeString(intel?.dominantFactor);
  const secondary = cleanArray(intel?.secondaryFactors);
  const confidence = safeNumber(intel?.confidence) ?? 1;
  const notes = safeString(intel?.notes);
  const snap = intel?.snapshot ?? {};
  const dayLabel = intel.dayLabel ?? "today";

  return {
    emoji: pickEmoji(factor, secondary, snap),
    title: pickTitle(factor, snap, dayLabel),
    main: buildMainNarrative(factor, secondary, notes, snap, confidence, dayLabel),
    bullets: buildBullets(factor, secondary, snap, confidence)
  };
}

// ------------------------------------------------------------
// TOMORROW
// ------------------------------------------------------------
function generateTomorrowNarrative(intel) {
  const factor = safeString(intel?.dominantFactor);
  const morning = intel?.morning ?? {};
  const afternoon = intel?.afternoon ?? {};
  const stats = intel?.stats ?? {};
  const secondary = cleanArray(intel?.secondaryFactors);
  const notes = safeString(intel?.notes);
  const confidence = safeNumber(intel?.confidence) ?? 1;

  return {
    emoji: pickEmoji(factor, secondary, morning),
    title: pickTomorrowTitle(factor, morning, afternoon, stats),
    main: buildTomorrowMain(morning, afternoon, stats, notes, factor),
    bullets: buildTomorrowBullets(morning, afternoon, stats, factor, secondary, confidence)
  };
}

// ------------------------------------------------------------
// TODAY TITLE — TEMPORALLY AWARE
// ------------------------------------------------------------
function pickTitle(factor, snap, dayLabel = "today") {
  const map = {
    cold: "Cold takes the lead",
    heat: "Heat sets the tone",
    rain: "Rain drives the day",
    snow: "Snow is the headline",
    fog: "Fog trims visibility",
    default: "A steady, uncomplicated day"
  };

  const base = map[factor] ?? map.default;

  if (dayLabel === "today") return base;
  return `Today: ${base}`;
}

// ------------------------------------------------------------
// TOMORROW TITLE — ALWAYS FUTURE-FRAMED
// ------------------------------------------------------------
function pickTomorrowTitle(factor, morning, afternoon, stats) {
  const mT = safeNumber(morning?.temp) ?? 0;
  const aT = safeNumber(afternoon?.temp) ?? 0;

  const warmup = aT - mT;
  const cloudShift =
    (safeNumber(afternoon?.cloudCover) ?? 0) -
    (safeNumber(morning?.cloudCover) ?? 0);

  let title;

  if (warmup >= 10) title = "A day that warms up nicely";
  else if (warmup <= -8) title = "A cooler, more settled day";
  else if (cloudShift <= -30) title = "A day that brightens as it goes";
  else if (cloudShift >= 30) title = "Clouds build through the afternoon";
  else {
    const map = {
      cold: "A chilly start, steady later",
      heat: "Warmth builds through the day",
      rain: "Rain shapes much of the day",
      snow: "Snowy at times",
      fog: "Fog early, clearer later",
      default: "A steady, uncomplicated day"
    };
    title = map[factor] ?? map.default;
  }

  return `Tomorrow: ${title}`;
}

// ------------------------------------------------------------
// TODAY MAIN — TEMPORALLY AWARE
// ------------------------------------------------------------
function buildMainNarrative(factor, secondary, notes, snap, confidence, dayLabel = "today") {
  const parts = [];

  if (dayLabel === "today") {
    parts.push("For the rest of today:");
  }

  if (notes) parts.push(notes);

  const f = safeNumber(snap?.feelsLike);

  if (f != null) {
    if (f <= 25) parts.push("It feels sharply cold.");
    else if (f <= 40) parts.push("A chilly feel lingers.");
    else if (f >= 85) parts.push("Warmth builds noticeably.");
  }

  if ((snap?.dewpoint ?? 0) >= 65) parts.push("Humidity adds a heavier feel.");
  else if ((snap?.dewpoint ?? 0) <= 40) parts.push("Dry air keeps things comfortable.");

  if ((snap?.windGust ?? 0) >= 30) parts.push("Gusts may feel pushy.");
  else if ((snap?.windGust ?? 0) >= 15) parts.push("A steady breeze develops.");

  if (confidence <= 0.4) {
    parts.push("Forecast confidence is lower than usual.");
  }

  return parts.join(" ").trim();
}

// ------------------------------------------------------------
// TOMORROW MAIN — ALWAYS FUTURE-FRAMED
// ------------------------------------------------------------
function buildTomorrowMain(morning, afternoon, stats, notes, factor) {
  const parts = ["Looking ahead to tomorrow:"];

  if (notes) parts.push(notes);

  const mT = safeNumber(morning?.feelsLike ?? morning?.temp);
  const aT = safeNumber(afternoon?.feelsLike ?? afternoon?.temp);

  if (mT != null) {
    if (mT <= 32) parts.push("The morning starts cold.");
    else if (mT <= 45) parts.push("A cool morning feel settles in.");
  }

  if (aT != null && mT != null) {
    if (aT >= mT + 10) parts.push("A noticeable warmup develops.");
    else if (aT <= mT - 8) parts.push("Temperatures ease downward later.");
  }

  if ((stats?.rainTotal ?? 0) > 0.25) parts.push("Rain is a recurring theme.");
  else if ((stats?.rainTotal ?? 0) > 0) parts.push("A few showers may pass through.");

  if ((stats?.snowTotal ?? 0) > 0) parts.push("Snow is possible at times.");

  if (factor.includes("fog")) parts.push("Fog may linger early.");

  return parts.join(" ").trim();
}

// ------------------------------------------------------------
// TODAY BULLETS
// ------------------------------------------------------------
function buildBullets(factor, secondary, snap, confidence) {
  const bullets = [];

  const f = safeNumber(snap?.feelsLike);

  if (f != null) {
    if (f <= 40) bullets.push("Layers help, especially early.");
    else if (f <= 55) bullets.push("A light jacket is a smart move.");
    else if (f >= 80) bullets.push("Light clothing keeps things comfortable.");
  }

  if ((snap?.windGust ?? 0) >= 35) bullets.push("Expect pushy gusts.");
  else if ((snap?.windGust ?? 0) >= 20) bullets.push("A breezy feel develops.");

  if (factor.includes("rain")) bullets.push("Rain gear is worth having.");
  if (factor === "snow") bullets.push("Watch for slick spots.");
  if (factor === "blackIce") bullets.push("Be cautious on roads.");

  if (factor.includes("fog")) bullets.push("Visibility may be limited.");

  if (factor === "uv") bullets.push("Sun protection is recommended.");

  if (factor === "smoke" || factor === "haze") {
    bullets.push("Air quality may be reduced.");
  }

  if (secondary.length) {
    bullets.push(`Secondary influences: ${secondary.join(", ")}.`);
  }

  if (confidence <= 0.4) {
    bullets.push("Expect some variability.");
  }

  return cleanArray(bullets);
}

// ------------------------------------------------------------
// TOMORROW BULLETS
// ------------------------------------------------------------
function buildTomorrowBullets(morning, afternoon, stats, factor, secondary, confidence) {
  const bullets = [];

  const mT = safeNumber(morning?.feelsLike ?? morning?.temp);
  const aT = safeNumber(afternoon?.feelsLike ?? afternoon?.temp);

  if (mT != null && mT <= 40) bullets.push("A warm layer helps early.");
  if (aT != null && aT >= 80) bullets.push("Light clothing works best later.");

  if ((stats?.windGustMax ?? 0) >= 35) bullets.push("Expect pushy gusts.");
  else if ((stats?.windGustMax ?? 0) >= 20) bullets.push("A breezy feel develops.");

  if ((stats?.rainTotal ?? 0) >= 0.25) bullets.push("Rain gear is worth having.");
  else if ((stats?.rainTotal ?? 0) > 0) bullets.push("A quick shower is possible.");

  if ((stats?.snowTotal ?? 0) > 0) bullets.push("Watch for slick spots.");

  if (factor.includes("fog")) bullets.push("Visibility may be limited early.");

  if (secondary.length) {
    bullets.push(`Secondary influences: ${secondary.join(", ")}.`);
  }

  if (confidence <= 0.4) {
    bullets.push("Expect some variability.");
  }

  return cleanArray(bullets);
}

// ------------------------------------------------------------
// EMOJI + TITLE (unchanged logic but safe)
// ------------------------------------------------------------
function pickEmoji(factor, secondary, snap) {
  const map = {
    cold: ["🥶"],
    heat: ["🥵"],
    wind: ["💨"],
    rain: ["🌧️"],
    snow: ["❄️"],
    fog: ["🌫️"],
    default: ["🌤️"]
  };

  const list = map[factor] ?? map.default;
  return list[Math.floor(Math.random() * list.length)];
}
