// ============================================================
// UNIFIED OUTLOOK SYNTHESIZER (Expressive Tone C)
// Now includes:
// - Morning commute awareness (5–9 AM)
// - Precip intensity tiers
// - Rain-to-snow transition language
// - Stronger headline logic
// ============================================================

export function synthesizeOutlook({ raw, comfort }) {
  const { phases, drivers, trends, dominant, commute, precipTotal, snowTotal } = raw.meta;
  const bullets = [];

  // ------------------------------------------------------------
  // PRECIP INTENSITY HELPER
  // ------------------------------------------------------------
  function describePrecipIntensity(total) {
    if (total >= 0.25) return "heavier rain at times";
    if (total >= 0.10) return "steadier rain at times";
    if (total >= 0.05) return "a few showers around";
    if (total > 0) return "a stray shower possible";
    return "";
  }

  const precipIntensity = describePrecipIntensity(precipTotal);

  // ------------------------------------------------------------
  // HEADLINE (dominant + commute + transitions)
  // ------------------------------------------------------------
  const headline = (() => {
    // Strongest case: rainy morning + temp crash
    if (commute?.commuteHeavy && dominant === "rain" && trends.tempFalling) {
      return "Rainy morning, then turning sharply colder.";
    }

    // Rainy morning but not heavy
    if (commute?.commutePrecip >= 0.05 && dominant === "rain") {
      return "Rain early, then cooling later.";
    }

    // Snow transition
    if (dominant === "snow" && phases.includes("post-frontal-cold")) {
      return "Colder air brings snow showers.";
    }

    // Wind-driven day
    if (dominant === "wind") return "Breezy with shifting winds.";

    // Heat / cold / goldilocks
    if (dominant === "heat") return "Warm and a bit intense at times.";
    if (dominant === "cold") return "A colder feel settling in.";
    if (dominant === "goldilocks") return "A pleasant, comfortable day overall.";

    // Rain but not commute-heavy
    if (dominant === "rain") return "Showers drifting through at times.";

    return "A quiet day overall.";
  })();

  // ------------------------------------------------------------
  // NARRATIVE (expressive, 1–2 clauses)
  // ------------------------------------------------------------
  const narrative = (() => {
    const parts = [];

    // Commute rain
    if (commute?.commuteHeavy) {
      parts.push("Steadier rain moves through early");
    } else if (commute?.commutePrecip >= 0.05) {
      parts.push("Rain likely around the morning commute");
    }

    // Precip intensity
    if (precipIntensity && !commute?.commuteHeavy) {
      parts.push(precipIntensity);
    }

    // Frontal passage
    if (phases.includes("frontal-passage")) {
      parts.push("a front ushers in a sharp temperature drop");
    }

    // Rain-to-snow transition
    if (snowTotal > 0 && phases.includes("post-frontal-cold")) {
      parts.push("rain may mix with wet snow later");
    }

    // Wind
    if (drivers.includes("wind")) {
      parts.push("winds pick up at times");
    }

    if (!parts.length) {
      return "A quiet day overall.";
    }

    return parts.join(", ") + ".";
  })();

  // ------------------------------------------------------------
  // BULLETS (clothing → action → supplemental)
  // ------------------------------------------------------------

  // COMMUTE IMPACTS
  if (commute?.commuteHeavy) {
    bullets.push("Steadier rain for the morning commute.");
  } else if (commute?.commutePrecip >= 0.05) {
    bullets.push("Rain likely early, especially around the commute.");
  }

  // PRECIP INTENSITY
  if (precipIntensity && !commute?.commuteHeavy) {
    bullets.push(precipIntensity.charAt(0).toUpperCase() + precipIntensity.slice(1) + ".");
  }

  // RAIN → SNOW TRANSITION
  if (snowTotal > 0 && phases.includes("post-frontal-cold")) {
    bullets.push("Rain may mix with wet snow later.");
  }

  // WIND
  if (drivers.includes("wind")) {
    bullets.push("Breezy at times.");
  }

  // SUPPLEMENTAL COMFORT
  const comfortText = comfort.summary.toLowerCase();
  if (comfortText.includes("humid")) bullets.push("Humidity may feel a bit sticky.");
  if (comfortText.includes("crisp")) bullets.push("Air stays crisp and comfortable.");
  if (dominant === "goldilocks") bullets.push("A great day for outdoor plans.");

  // Quiet fallback
  if (bullets.length === 0) {
    bullets.push("A quiet day overall.");
  }

  // ------------------------------------------------------------
  // POLISH (dedupe + trim)
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
    bullets: cleanBullets.slice(0, 4)
  };
}
