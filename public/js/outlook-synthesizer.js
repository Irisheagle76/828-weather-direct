// ============================================================
// UNIFIED OUTLOOK SYNTHESIZER (Expressive Tone C)
// Headline + Bullets only
// Includes:
// - Morning commute awareness (5–9 AM)
// - Precip intensity tiers
// - Rain-to-snow transition language
// - Clothing guidance as final bullet
// - Today fade-out (after 7 PM)
// - Tomorrow fade-in (before 5 AM)
// - Bullet polishing + wind dedupe + clothing compression
// ============================================================

import { getClothingGuidance } from './forecast-intel.js';

// ------------------------------------------------------------
// MAIN SYNTHESIZER
// ------------------------------------------------------------
console.log("SYNTHESIZER v3.1 ACTIVE");

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
// FORECAST STORY BUILDER
// ------------------------------------------------------------
function buildStory() {

  const parts = [];

  if (commute?.commutePrecip >= 0.05) {
    parts.push("Rain arrives early");
  }

  if (precipTotal >= 0.25) {
    parts.push("becoming heavier through the day");
  }

  if (trends?.tempFalling && drivers?.includes("front")) {
    parts.push("before colder air moves in");
  }

  if (snowTotal > 0) {
    parts.push("with rain possibly mixing with wet snow later");
  }

  if (parts.length === 0) return "";

  if (parts.length === 1) return parts[0] + ".";

  if (parts.length === 2) return `${parts[0]}, then ${parts[1]}.`;

  return `${parts[0]}, ${parts[1]} before ${parts[2]}.`;
}
  const story = buildStory();
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

  // WIND (dedupe headline + bullets)
if (drivers?.includes("wind")) {

  const headlineMentionsWind =
    headline.toLowerCase().includes("breezy") ||
    headline.toLowerCase().includes("wind");

  const hasWindBullet = bullets.some(b =>
    b.toLowerCase().includes("breezy") ||
    b.toLowerCase().includes("wind")
  );

  if (!hasWindBullet && !headlineMentionsWind) {
    bullets.push("Breezy at times.");
  }
}

  // ------------------------------------------------------------
  // SUPPRESS COMFORT BULLETS ON ACTIVE WEATHER DAYS
  // ------------------------------------------------------------
  const activeWeather =
    dominant !== "easy" &&
    dominant !== "goldilocks" &&
    (
      precipTotal > 0.05 ||
      commute?.commutePrecip > 0.05 ||
      trends.tempFalling ||
      drivers.includes("front") ||
     drivers?.includes("wind") ||
      drivers.includes("snow") ||
      phases.includes("frontal-passage") ||
      phases?.includes("post-frontal-cold")
    );

  if (!activeWeather) {
    const comfortText = comfort.summary.toLowerCase();
    if (comfortText.includes("humid")) bullets.push("Humidity may feel a bit sticky.");
    if (comfortText.includes("crisp")) bullets.push("Air stays crisp and comfortable.");
    if (dominant === "goldilocks") bullets.push("A great day for outdoor plans.");
  }

  // ------------------------------------------------------------
// CLOTHING GUIDANCE (compressed)
// ------------------------------------------------------------
if (raw.clothing) {

  const base = raw.clothing
    .split(".")[0] // keep only first sentence
    .replace(/\s+/g, " ")
    .trim();

  const needsSnowGear =
    snowTotal > 0 ||
    phases?.includes("post-frontal-cold") ||
    drivers?.includes("snow");

  if (needsSnowGear) {
    bullets.push(`Clothing: ${base}, with snow gear kept at the ready.`);
  } else {
    bullets.push(`Clothing: ${base}.`);
  }
}
  // ------------------------------------------------------------
  // BULLET POLISHING PASS
  // ------------------------------------------------------------
  const seenKeys = new Set();
  const polished = [];

  for (const b of bullets) {
    const key = b.toLowerCase()
      .replace(/[^a-z0-9 ]/g, "")
      .replace(/\s+/g, " ")
      .trim();

    // Skip duplicates
    if (seenKeys.has(key)) continue;

    // Skip bullets that repeat headline
    const headlineKey = headline.toLowerCase().replace(/[^a-z0-9 ]/g, "");
    if (headlineKey.includes(key) || key.includes(headlineKey)) continue;

    seenKeys.add(key);
    polished.push(b);
  }

  // ------------------------------------------------------------
  // FADE LOGIC (Option B — centralized in synthesizer)
  // ------------------------------------------------------------
  const now = new Date();
  const hour = now.getHours();

  // TODAY fade-out (after 7 PM)
  if (raw?.meta?.dayType === "today") {
    if (hour >= 19) {
      return {
        headline: "The day is winding down.",
        text: "Fresh forecast updates arrive tomorrow morning.",
        bullets: [],
        emoji: "",
        isEndOfDay: true,
        isEarlyMorning: false
      };
    }
  }

  // TOMORROW fade-in (before 5 AM)
  if (raw?.meta?.dayType === "tomorrow") {
    if (hour < 5) {
      return {
        headline: "Forecast updates arriving shortly.",
        text: "Tomorrow’s details will appear as the morning begins.",
        bullets: [],
        emoji: "",
        isEndOfDay: false,
        isEarlyMorning: true
      };
    }
  }

  // ------------------------------------------------------------
  // NORMAL RETURN (no fade)
  // ------------------------------------------------------------
  return {
  headline,
  text: story,
  bullets: polished.slice(0, 4),
  isEndOfDay: false,
  isEarlyMorning: false
};
}
