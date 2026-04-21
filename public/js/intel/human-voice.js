// /js/intel/human-voice.js

// ============================================================
// CORE VOICE (LOW LEVEL)
// ============================================================

export function buildHumanVoice(intel = {}) {
  const signals = intel?.signals || {};
  const dominantFactor = intel?.dominantFactor;

  const temp = typeof signals.temp === "number" ? signals.temp : null;
  const dewPoint = typeof signals.dewPoint === "number" ? signals.dewPoint : null;
 const wind =
  typeof signals.wind === "number"
    ? signals.wind
    : typeof signals.windSpeed === "number"
    ? signals.windSpeed
    : 0;

  // ------------------------------------------------------------
  // HARD GUARD
  // ------------------------------------------------------------
  if (temp === null) {
    return {
      summary: "Conditions are steady",
      detail: "",
      feelsLike: ""
    };
  }

  // ------------------------------------------------------------
  // CLASSIFY
  // ------------------------------------------------------------
  const tempLevel =
    temp >= 86 ? "hot" :
    temp >= 75 ? "warm" :
    temp >= 60 ? "mild" :
    temp >= 45 ? "cool" :
    "cold";

  const humidityLevel =
    dewPoint >= 70 ? "oppressive" :
    dewPoint >= 65 ? "humid" :
    dewPoint >= 55 ? "comfortable" :
    "dry";

  const windLevel =
    wind < 1 ? "calm" :
    wind < 5 ? "light" :
    wind < 12 ? "breezy" :
    "windy";

  // ------------------------------------------------------------
  // SUMMARY
  // ------------------------------------------------------------
  let summary;

  if (tempLevel === "hot" && humidityLevel !== "dry")
    summary = "Hot and uncomfortable";
  else if (tempLevel === "hot")
    summary = "Hot";
  else if (tempLevel === "warm" && humidityLevel !== "dry")
    summary = "Warm and slightly sticky";
  else if (tempLevel === "warm")
    summary = "Warm";
else if (tempLevel === "mild") {
  const options = [
    "Comfortable",
    "Easy to be outside",
    "Pleasant conditions",
    "Mild and manageable"
  ];
  summary = options[Math.floor(Math.random() * options.length)];
}
  else if (tempLevel === "cool" && windLevel !== "calm")
    summary = "Cool with a breeze";
  else if (tempLevel === "cool")
    summary = "Cool";
  else
    summary = "Chilly";

  // ------------------------------------------------------------
  // DETAIL
  // ------------------------------------------------------------
  let detail = "";

  switch (dominantFactor) {
    case "heat":
      detail = "Feels warmer in direct sun";
      break;
    case "cold":
      detail = "Cool air is noticeable";
      break;
    case "muggy":
      detail = "Humidity makes it feel heavier";
      break;
    case "wind":
      detail =
        windLevel === "calm"
          ? "Calm conditions"
          : `Breeze around ${Math.round(wind)} mph`;
      break;
  }

  // ------------------------------------------------------------
  // FEELS LIKE
  // ------------------------------------------------------------
  const feelsLike =
    temp >= 95 ? "Oppressive heat" :
    temp >= 85 ? "Very warm" :
    temp >= 75 ? "T-shirt weather" :
    temp >= 65 ? "Comfortable" :
    temp >= 55 ? "Light jacket weather" :
    temp >= 45 ? "Jacket recommended" :
    "Cold";

  return { summary, detail, feelsLike };
}

// ============================================================
// 🧠 UNIFIED NARRATIVE (NEW)
// ============================================================

export function buildNarrative(intel = {}, mode = "current") {
  const voice = buildHumanVoice(intel);

  const trend = intel?.pattern?.trend ?? 0;
  const dp = intel?.signals?.dewPoint;

  let headline = "";
  let bullets = [];

  // ------------------------------------------------------------
  // CURRENT (Feelscore)
  // ------------------------------------------------------------
  if (mode === "current") {
    headline = voice.summary;

    if (voice.detail) bullets.push(voice.detail);
    if (voice.feelsLike) bullets.push(voice.feelsLike);
  }

  // ------------------------------------------------------------
  // TODAY / TOMORROW
  // ------------------------------------------------------------
  else {
    headline = refineHeadline(voice.summary, trend, mode === "tomorrow");

    bullets = buildTrendBullets(trend, dp);
  }

  return {
    headline,
    bullets: bullets.slice(0, 3)
  };
}

// ============================================================
// REFINERS (NEW)
// ============================================================

function refineHeadline(summary, trend, isFuture = false) {
  if (!summary) return "";

  if (trend > 5) {
    return isFuture
      ? "Improving comfort through the day"
      : "Conditions improve later";
  }

  if (trend < -5) {
    return isFuture
      ? "Less comfortable as the day goes on"
      : "Conditions decline slightly";
  }

  return summary;
}

function buildTrendBullets(trend, dewPoint) {
  const bullets = [];

  if (trend > 5) bullets.push("Improves as the day goes on");
  if (trend < -5) bullets.push("Slight drop in comfort later");

  if (dewPoint != null && dewPoint < 55) {
    bullets.push("Dry air keeps things comfortable");
  }

  return bullets;
}