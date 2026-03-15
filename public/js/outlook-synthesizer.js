// ============================================================
// UNIFIED OUTLOOK SYNTHESIZER (Expressive Tone C)
// Headline + Bullets only
// Includes:
// - Morning commute awareness (5–9 AM)
// - Precip intensity tiers
// - Rain-to-snow transition language
// - Clothing guidance as final bullet
// ============================================================

import { getClothingGuidance } from './forecast-intel.js'; 
// NOTE: If clothing guidance lives elsewhere, adjust this import accordingly.

export function synthesizeOutlook({ raw, comfort }) {
  const { phases, drivers, trends, dominant, commute, precipTotal, snowTotal } = raw.meta;
  const bullets = [];

  // ------------------------------------------------------------
  // PRECIP INTENSITY HELPER
  // ------------------------------------------------------------
  function describePrecipIntensity(total) {
    if (total >= 0.25) return "Heavier rain at times.";
    if (total >= 0.10) return "Steadier rain at times.";
    if (total >= 0.05) return "A few showers around.";
    if (total > 0) return "A stray shower possible.";
    return "";
  }

  const precipIntensity = describePrecipIntensity(precipTotal);

  // ------------------------------------------------------------
  // HEADLINE
  // ------------------------------------------------------------
  const headline = (() => {
    if (commute?.commuteHeavy && dominant === "rain" && trends.tempFalling) {
      return "Rainy morning, then turning sharply colder.";
    }

    if (commute?.commutePrecip >= 0.05 && dominant === "rain") {
      return "Rain early, then cooling later.";
    }

    if (dominant === "snow" && phases.includes("post-frontal-cold")) {
      return "Colder air brings snow showers.";
    }

    if (dominant === "wind") return "Breezy with shifting winds.";
    if (dominant === "heat") return "Warm and a bit intense at times.";
    if (dominant === "cold") return "A colder feel settling in.";
    if (dominant === "goldilocks") return "A pleasant, comfortable day overall.";
    if (dominant === "rain") return "Showers drifting through at times.";

    return "A quiet day overall.";
  })();

  // ------------------------------------------------------------
  // BULLETS
  // ------------------------------------------------------------

  // COMMUTE IMPACTS
  if (commute?.commuteHeavy) {
    bullets.push("Steadier rain for the morning commute.");
  } else if (commute?.commutePrecip >= 0.05) {
    bullets.push("Rain likely early, especially around the commute.");
  }

  // PRECIP INTENSITY
  if (precipIntensity && !commute?.commuteHeavy) {
    bullets.push(precipIntensity);
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

  // ------------------------------------------------------------
  // CLOTHING GUIDANCE (always last bullet)
  // ------------------------------------------------------------
  if (raw.clothing) {
    bullets.push(`Clothing: ${raw.clothing}`);
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
    text: "",            // narrative removed
    bullets: cleanBullets.slice(0, 5)
  };
}
