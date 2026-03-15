// ============================================================
// UNIFIED OUTLOOK SYNTHESIZER (Expressive Tone C)
// ============================================================

export function synthesizeOutlook({ raw, comfort }) {
  const { phases, drivers, trends, dominant } = raw.meta;
  const bullets = [];

  // ------------------------------------------------------------
  // 1. HEADLINE (expressive, dominant-driven)
  // ------------------------------------------------------------
  const headline = (() => {
    switch (dominant) {
      case "rain": return "Showers drifting through at times.";
      case "wind": return "Breezy with shifting winds.";
      case "snow": return "Snow showers in the mix.";
      case "heat": return "Warm and a bit intense at times.";
      case "cold": return "A colder feel settling in.";
      case "goldilocks": return "A pleasant, comfortable day overall.";
      default: return "A quiet day overall.";
    }
  })();

  // ------------------------------------------------------------
  // 2. NARRATIVE (1 expressive sentence)
  // ------------------------------------------------------------
  const narrative = (() => {
    const parts = [];

    if (phases.includes("rain-early")) {
      parts.push("A passing disturbance brings early showers");
    }

    if (phases.includes("frontal-passage")) {
      parts.push("a front ushers in a noticeable change");
    }

    if (trends.tempFalling) {
      parts.push("with cooler air settling in later");
    }

    if (parts.length === 0) {
      if (drivers.includes("wind")) parts.push("A breezy feel develops at times");
      if (drivers.includes("precip")) parts.push("A few showers drift through");
      if (drivers.includes("temp-rise")) parts.push("Warming gradually through the day");
      if (drivers.includes("temp-drop")) parts.push("Cooling gradually later on");
    }

    return parts.join(", ") + ".";
  })();

  // ------------------------------------------------------------
  // 3. BULLETS (clothing → action → supplemental)
  // ------------------------------------------------------------

  // CLOTHING (only if relevant)
  if (dominant === "cold") bullets.push("Bundle up — a colder feel develops.");
  if (dominant === "heat") bullets.push("Hydrate and dress light.");
  if (dominant === "rain") bullets.push("Rain gear may help at times.");
  if (dominant === "wind") bullets.push("A light windbreaker could help.");

  // ACTION / PLANNING
  if (trends.tempFalling) bullets.push("Temperatures fall later in the day.");
  if (drivers.includes("precip")) bullets.push("A few showers around.");
  if (drivers.includes("wind")) bullets.push("Breezy at times.");

  // SUPPLEMENTAL SENSIBLE WEATHER
  const comfortText = comfort.summary.toLowerCase();
  if (comfortText.includes("humid")) bullets.push("Humidity may feel a bit sticky.");
  if (comfortText.includes("crisp")) bullets.push("Air stays crisp and comfortable.");
  if (dominant === "goldilocks") bullets.push("A great day for outdoor plans.");

  // If nothing else, add a quiet-day bullet
  if (bullets.length === 0) bullets.push("A quiet day overall.");

  // ------------------------------------------------------------
  // 4. POLISH LAYER (remove duplicates, normalize)
  // ------------------------------------------------------------
  const seen = new Set();
  const cleanBullets = [];

  for (const b of bullets) {
    const key = b.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
    if (!seen.has(key)) {
      seen.add(key);
      cleanBullets.push(b);
    }
  }

  return {
    headline,
    text: narrative,
    bullets: cleanBullets.slice(0, 3)
  };
}
