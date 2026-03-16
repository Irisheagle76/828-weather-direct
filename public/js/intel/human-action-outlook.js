// /intel/human-action-outlook.js
// ============================================================
// HUMAN‑ACTION OUTLOOK ENGINE (HARDENED + SAFE)
// ============================================================

// ------------------------------------------------------------
// MAIN ENTRY — TODAY
// ------------------------------------------------------------
export function getTodayHumanActionOutlook(intel) {
  if (!intel || !intel.today || !intel.today.stats) {
    return fallbackOutlook("A quiet day today.");
  }

  return buildOutlook(intel.today, "today");
}

// ------------------------------------------------------------
// MAIN ENTRY — TOMORROW
// ------------------------------------------------------------
export function getTomorrowHumanActionOutlook(intel) {
  if (!intel || !intel.tomorrow || !intel.tomorrow.stats) {
    return fallbackOutlook("A quiet day tomorrow.");
  }

  return buildOutlook(intel.tomorrow, "tomorrow");
}

// ------------------------------------------------------------
// OUTLOOK BUILDER (shared for today + tomorrow)
// ------------------------------------------------------------
function buildOutlook(day, label) {
  const stats = day.stats || {};
  const precip = day.precipType || null;
  const wind = safeNum(day.windSpeed);
  const maxTemp = safeNum(stats.maxTemp);
  const uv = safeNum(stats.uv);
  const trend = safeNum(day.tempTrend);

  // ------------------------------------------------------------
  // HEADLINE LOGIC
  // ------------------------------------------------------------
  let headline = "A quiet day ahead.";

  if (precip === "rain") headline = "Rain impacts your plans.";
  if (precip === "snow") headline = "Snow may affect travel.";
  if (uv >= 7) headline = "High UV exposure expected.";
  if (wind >= 25) headline = "Gusty winds may affect outdoor plans.";
  if (maxTemp >= 88) headline = "Hot conditions may slow outdoor activity.";
  if (maxTemp <= 35) headline = "Cold conditions may require extra layers.";

  // ------------------------------------------------------------
  // CONTEXT SENTENCE
  // ------------------------------------------------------------
  let context = "";

  if (precip === "rain") {
    context = "Showers may interrupt outdoor plans at times.";
  } else if (precip === "snow") {
    context = "Light snow could create slick spots, especially early or late.";
  } else if (wind >= 25) {
    context = "Winds may be noticeable, especially on exposed ridges.";
  } else if (uv >= 7) {
    context = "Sun exposure will be strong during peak afternoon hours.";
  } else if (trend > 6) {
    context = "Temperatures rise through the day, feeling warmer by afternoon.";
  } else if (trend < -6) {
    context = "Temperatures fall through the day, feeling cooler later on.";
  } else {
    context = "Weather impacts remain minimal overall.";
  }

  // ------------------------------------------------------------
  // BULLETS (2–3 actionable items)
  // ------------------------------------------------------------
  const bullets = [];

  // Precip bullets
  if (precip === "rain") {
    bullets.push("Keep a light rain layer handy.");
    bullets.push("Plan outdoor tasks around passing showers.");
  }

  if (precip === "snow") {
    bullets.push("Allow extra time for travel.");
    bullets.push("Watch for slick spots on untreated surfaces.");
  }

  // Wind bullets
  if (wind >= 25) {
    bullets.push("Secure loose outdoor items.");
    bullets.push("Use caution on exposed ridges or bridges.");
  }

  // UV bullets
  if (uv >= 7) {
    bullets.push("Use sunscreen for any extended outdoor time.");
    bullets.push("Midday sun will be the strongest.");
  }

  // Temperature bullets
  if (maxTemp >= 88) {
    bullets.push("Hydrate and take breaks in shade.");
  }

  if (maxTemp <= 35) {
    bullets.push("Dress in warm layers for comfort.");
  }

  // If no bullets were added, provide a default
  if (bullets.length === 0) {
    bullets.push("No major weather impacts expected.");
  }

  return {
    headline,
    context,
    bullets
  };
}

// ------------------------------------------------------------
// FALLBACK OUTLOOK (safe default)
// ------------------------------------------------------------
function fallbackOutlook(message) {
  return {
    headline: message,
    context: "",
    bullets: ["A quiet day overall."]
  };
}

// ------------------------------------------------------------
// SAFE NUMBER HELPER
// ------------------------------------------------------------
function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
