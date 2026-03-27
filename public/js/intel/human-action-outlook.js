// /intel/human-action-outlook.js
// ============================================================
// HUMAN‑ACTION OUTLOOK ENGINE (HARDENED + EMOJI + VARIATION)
// ============================================================

// ------------------------------------------------------------
// PUBLIC API
// ------------------------------------------------------------
export function getTodayHumanActionOutlook(intel) {
  if (!intel?.today?.stats) return fallbackOutlook("A quiet day today.");
  return buildOutlook(intel.today, "today");
}

export function getTomorrowHumanActionOutlook(intel) {
  if (!intel?.tomorrow?.stats) return fallbackOutlook("A quiet day tomorrow.");
  return buildOutlook(intel.tomorrow, "tomorrow");
}

// ------------------------------------------------------------
// OUTLOOK BUILDER
// ------------------------------------------------------------
function buildOutlook(day, label) {
  const stats = day.stats || {};
  const precip = day.precipType || null;
  const wind = safeNum(day.windSpeed);
  const maxTemp = safeNum(stats.maxTemp);
  const uv = safeNum(stats.uv);
  const trend = safeNum(day.tempTrend);

  // ------------------------------------------------------------
  // EMOJI SELECTION
  // ------------------------------------------------------------
  const emoji = pickEmoji({ precip, wind, maxTemp, uv });

  // ------------------------------------------------------------
  // HEADLINE (with micro‑variation)
  // ------------------------------------------------------------
  const headline = pickHeadline({ precip, wind, maxTemp, uv, emoji });

  // ------------------------------------------------------------
  // CONTEXT (with micro‑variation + time‑aware precip)
  // ------------------------------------------------------------
  const context = pickContext({ precip, wind, uv, trend, label });

  // ------------------------------------------------------------
  // BULLETS (2–3 actionable items)
  // ------------------------------------------------------------
  const bullets = pickBullets({ precip, wind, maxTemp, uv, label });

  return { headline, context, bullets };
}

// ------------------------------------------------------------
// EMOJI LOGIC
// ------------------------------------------------------------
function pickEmoji({ precip, wind, maxTemp, uv }) {
  if (precip === "rain") return "🌧️";
  if (precip === "snow") return "❄️";
  if (wind >= 25) return "💨";
  if (uv >= 7) return "🌞";
  if (maxTemp >= 88) return "🔥";
  if (maxTemp <= 35) return "🥶";
  return "🌤️";
}

// ------------------------------------------------------------
// HEADLINE VARIATION
// ------------------------------------------------------------
function pickHeadline({ precip, wind, maxTemp, uv, emoji }) {
  const choose = arr => arr[Math.floor(Math.random() * arr.length)];

  if (precip === "rain") {
    return choose([
      `${emoji} Rain may shape your plans.`,
      `${emoji} Expect wet‑weather interruptions.`,
      `${emoji} Showers influence outdoor timing.`
    ]);
  }

  if (precip === "snow") {
    return choose([
      `${emoji} Snow could affect travel.`,
      `${emoji} Wintry impacts possible.`,
      `${emoji} Light snow may slow things down.`
    ]);
  }

  if (wind >= 25) {
    return choose([
      `${emoji} Gusty winds stand out today.`,
      `${emoji} Wind may affect outdoor comfort.`,
      `${emoji} Noticeably breezy conditions.`
    ]);
  }

  if (uv >= 7) {
    return choose([
      `${emoji} Strong sun this afternoon.`,
      `${emoji} High UV exposure expected.`,
      `${emoji} Sun protection recommended.`
    ]);
  }

  if (maxTemp >= 88) {
    return choose([
      `${emoji} Heat may slow outdoor activity.`,
      `${emoji} Warm and muggy at times.`,
      `${emoji} Hot conditions dominate.`
    ]);
  }

  if (maxTemp <= 35) {
    return choose([
      `${emoji} Cold conditions require layers.`,
      `${emoji} Chilly air dominates the day.`,
      `${emoji} Bundle up for comfort.`
    ]);
  }

  return choose([
    `${emoji} A quiet, low‑impact day.`,
    `${emoji} Minimal weather impacts.`,
    `${emoji} Easygoing conditions overall.`
  ]);
}

// ------------------------------------------------------------
// CONTEXT VARIATION + TIME‑AWARE PRECIP
// ------------------------------------------------------------
function pickContext({ precip, wind, uv, trend, label }) {
  const choose = arr => arr[Math.floor(Math.random() * arr.length)];

  // Time‑aware precip
  if (precip === "rain") {
    const am = choose([
      "Showers most likely in the morning.",
      "Early rain may affect the first half of the day.",
      "Morning wetness could shift outdoor plans."
    ]);

    const pm = choose([
      "Showers favor the afternoon.",
      "Rain chances rise later in the day.",
      "Afternoon wet periods may interrupt plans."
    ]);

    return label === "today" ? am : pm;
  }

  if (precip === "snow") {
    return choose([
      "Light snow may create slick spots early.",
      "Wintry mix possible during colder hours.",
      "Snow impacts remain light but noticeable."
    ]);
  }

  if (wind >= 25) {
    return choose([
      "Winds strongest on exposed ridges.",
      "Breezy conditions noticeable through the day.",
      "Gusts may affect comfort outdoors."
    ]);
  }

  if (uv >= 7) {
    return choose([
      "Peak UV arrives mid‑afternoon.",
      "Sun exposure strongest during early afternoon.",
      "High UV may catch you off‑guard."
    ]);
  }

  if (trend > 6) {
    return choose([
      "Temperatures rise steadily through the day.",
      "A warming trend becomes noticeable by afternoon.",
      "Feels warmer later than early on."
    ]);
  }

  if (trend < -6) {
    return choose([
      "Cooling trend sets in later.",
      "Temperatures fall through the afternoon.",
      "Feels cooler as the day progresses."
    ]);
  }

  return choose([
    "Weather impacts remain minimal.",
    "A straightforward weather day.",
    "Conditions stay steady overall."
  ]);
}

// ------------------------------------------------------------
// BULLET VARIATION
// ------------------------------------------------------------
function pickBullets({ precip, wind, maxTemp, uv }) {
  const bullets = [];

  const choose = arr => arr[Math.floor(Math.random() * arr.length)];

  // Rain
  if (precip === "rain") {
    bullets.push(choose([
      "Keep a light rain layer handy.",
      "Plan around passing showers.",
      "Expect brief wet interruptions."
    ]));
    bullets.push(choose([
      "Watch for slick spots on leaves.",
      "Outdoor tasks may need flexibility.",
      "Road spray possible at times."
    ]));
  }

  // Snow
  if (precip === "snow") {
    bullets.push(choose([
      "Allow extra time for travel.",
      "Watch for slick untreated surfaces.",
      "Light accumulation possible."
    ]));
    bullets.push(choose([
      "Colder pockets may see icy patches.",
      "Drive cautiously on shaded roads.",
      "Expect slower travel early."
    ]));
  }

  // Wind
  if (wind >= 25) {
    bullets.push(choose([
      "Secure loose outdoor items.",
      "Use caution on exposed ridges.",
      "Breezy enough to affect comfort."
    ]));
  }

  // UV
  if (uv >= 7) {
    bullets.push(choose([
      "Use sunscreen for extended outdoor time.",
      "Midday sun will be strongest.",
      "UV protection recommended."
    ]));
  }

  // Heat
  if (maxTemp >= 88) {
    bullets.push(choose([
      "Hydrate and take breaks in shade.",
      "Limit strenuous activity in peak heat.",
      "Light clothing recommended."
    ]));
  }

  // Cold
  if (maxTemp <= 35) {
    bullets.push(choose([
      "Dress in warm layers.",
      "Gloves and hat improve comfort.",
      "Limit long periods outdoors."
    ]));
  }

  if (bullets.length === 0) {
    bullets.push("No major weather impacts expected.");
  }

  return bullets;
}

// ------------------------------------------------------------
// FALLBACK
// ------------------------------------------------------------
function fallbackOutlook(message) {
  return {
    headline: message,
    context: "",
    bullets: ["A quiet day overall."]
  };
}

// ------------------------------------------------------------
// SAFE NUMBER
// ------------------------------------------------------------
function safeNum(val) {
  return val !== null && val !== undefined && !isNaN(val);
}
