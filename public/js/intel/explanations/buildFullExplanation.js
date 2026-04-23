// ============================================================
// /js/intel/explanations/buildFullExplanation.js
// ============================================================

export function buildFullExplanation(
  c,
  narrative,
  trend = {}
) {
  const primary = [];
  const secondary = [];

  // --------------------------------------------------
  // 1. CORE FEEL
  // --------------------------------------------------

  if (c.dewPoint < 50) {
    primary.push("Dry air makes it feel crisp and light.");
  } else if (c.dewPoint > 65) {
    primary.push("Humidity adds weight to the air.");
  }

  if (c.temp < 55) {
    primary.push("Cool temperatures add a noticeable chill.");
  } else if (c.temp > 80) {
    primary.push("Warm temperatures are starting to impact comfort.");
  }

  // --------------------------------------------------
  // 2. TREND (PROMINENT)
  // --------------------------------------------------

  if (trend.strongWarmup) {
    primary.push("A rapid warm-up is expected over the next few hours.");
  } else if (trend.mildWarmup) {
    primary.push("Temperatures trend upward through late morning.");
  } else {
    primary.push(
      c.temp < 60
        ? "Temperatures gradually improve through the morning."
        : "Conditions remain fairly steady over the next few hours."
    );
  }

  // --------------------------------------------------
  // 3. SECONDARY DETAILS
  // --------------------------------------------------

  if (trend.afternoonPeak) {
    secondary.push("The warmest stretch arrives early this afternoon.");
  }

  if (trend.coolingAfterPeak) {
    secondary.push("Conditions ease slightly after the peak.");
  }

  if (trend.windIncreasing) {
    secondary.push("Winds increase as the day progresses.");
  }

  if (trend.drying) {
    secondary.push("Air continues drying out.");
  }

  if (c.windSpeed > 10) {
    secondary.push("A steady breeze is influencing how it feels.");
  }

  if (c.dewPoint < 45 && c.windSpeed > 8) {
    secondary.push("Dry air and wind may accelerate drying conditions.");
  }

  // --------------------------------------------------
  // 4. FALLBACK
  // --------------------------------------------------

  if (!primary.length && narrative?.notes) {
    primary.push(narrative.notes);
  }

  // --------------------------------------------------
  // FINAL
  // --------------------------------------------------

  return [...primary.slice(0, 2), ...secondary.slice(0, 2)].join(" ");
}