// /intel/synthesizer.js
// Human‑Action Outlook Generator — Sky‑Aware Edition

// ------------------------------------------------------------
// MAIN OUTLOOK (Today / Tonight / Tomorrow)
// ------------------------------------------------------------
export function synthesizePeriod(periodName, { morning, afternoon, evening, stats, events, sky }) {
  if (!stats) {
    return {
      headline: "No data available",
      narrative: "",
      bullets: []
    };
  }

  const trends = detectTrends(stats, events, sky);
  const emoji = pickEmoji(events, trends, sky);

  return {
    headline: generateHeadline(stats, events, trends, sky, emoji),
    narrative: generateNarrative(stats, events, trends, sky),
    bullets: generateBullets(stats, events, sky)
  };
}

// ------------------------------------------------------------
// HEADLINE
// ------------------------------------------------------------
function generateHeadline(stats, events, trends, sky, emoji) {
  const d = events?.driver;

  const baseMap = {
    rain: "A damp, drizzly kind of day",
    snow: "Snowy vibes ahead",
    wind: "A breezy, lively day",
    hot: "Warm and energetic",
    cold: "A chilly, layered kind of day",
    goldilocks: "A genuinely pleasant day",
    easy: "A calm, manageable day"
  };

  let base = baseMap[d] ?? "A steady, uncomplicated day";

  // Sky‑aware overrides
  if (sky?.cloudState === "overcast") base = "A gray, muted kind of day";
  if (sky?.cloudState === "mostly clear") base = "A brighter, more open-feeling day";
  if (events?.fogRisk) base = "A fog‑prone start";
  if (events?.hazyMorning) base = "A hazy, filtered morning";

  // Trend overrides
  if (trends.includes("bigWarmup")) base = "A day that warms up nicely";
  if (trends.includes("coolingOff")) base = "A cooler, more settled day";
  if (trends.includes("brightening")) base = "A day that tries to brighten";
  if (trends.includes("cloudy")) base = "A gray, moody kind of day";

  return `${emoji} ${base}`;
}

// ------------------------------------------------------------
// NARRATIVE
// ------------------------------------------------------------
function generateNarrative(stats, events, trends, sky) {
  const parts = [];

  // Temperature
  parts.push(buildTempPhrase(stats.tempMin, stats.tempMax));

  // Wind
  parts.push(buildWindPhrase(stats.windGustMax));

  // Precipitation
  parts.push(buildPrecipPhrase(stats.rainTotal, stats.snowTotal));

  // Sky‑aware cloud phrasing
  parts.push(buildSkyPhrase(stats, sky, events));

  // Trend‑based nuance
  if (trends.includes("bigWarmup")) parts.push("The day warms noticeably as it goes.");
  if (trends.includes("coolingOff")) parts.push("Temperatures ease downward into a cooler feel.");
  if (trends.includes("gusty")) parts.push("Winds get lively at times.");
  if (trends.includes("calming")) parts.push("Winds ease back later on.");
  if (trends.includes("brightening")) parts.push("Skies may try to brighten.");
  if (trends.includes("cloudy")) parts.push("Clouds hold firm for much of the day.");

  return parts.filter(Boolean).join(" ").trim();
}

// ------------------------------------------------------------
// BULLETS
// ------------------------------------------------------------
function generateBullets(stats, events, sky) {
  const bullets = [];

  // Temperature guidance
  if (stats.tempMax <= 40) bullets.push("Dress warm — layers help.");
  else if (stats.tempMax <= 55) bullets.push("A jacket is a smart move.");
  else if (stats.tempMax >= 80) bullets.push("Light clothing keeps things comfortable.");

  // Wind
  if (stats.windGustMax >= 35) bullets.push("Expect a few pushy gusts.");
  else if (stats.windGustMax >= 20) bullets.push("A breezy afternoon may nudge you around.");

  // Precip
  if (stats.rainTotal >= 0.25) bullets.push("Keep rain gear handy.");
  else if (stats.rainTotal > 0) bullets.push("A quick shower is possible.");

  // Snow
  if (stats.snowTotal >= 0.5) bullets.push("Watch for slick spots early.");
  else if (stats.snowTotal > 0) {
    const options = [
      "A touch of snow early in the day.",
      "A light dusting to start things off.",
      "Snowflakes could make a morning appearance."
    ];
    bullets.push(options[Math.floor(Math.random() * options.length)]);
  }

  // Sky‑aware bullets
  if (sky?.cloudState === "overcast") bullets.push("Skies stay mostly gray.");
  if (sky?.cloudState === "mostly clear") bullets.push("Some brighter breaks possible.");
  if (events?.sunnyBreak) bullets.push("A few sunny breaks help lift the mood.");
  if (events?.filteredSun) bullets.push("Filtered sun peeks through at times.");
  if (events?.fogRisk) bullets.push("Fog may linger in sheltered valleys.");
  if (events?.hazyMorning) bullets.push("Haze may soften the morning light.");
  if (events?.uvRisk) bullets.push("Midday UV runs on the higher side.");

  return bullets;
}

// ------------------------------------------------------------
// SKY‑AWARE PHRASE HELPERS
// ------------------------------------------------------------
function buildSkyPhrase(stats, sky, events) {
  if (!sky) return "";

  if (events?.fogRisk) return "Fog may linger early before slowly lifting.";
  if (events?.hazyMorning) return "Haze softens the morning light.";
  if (events?.sunnyBreak) return "A few sunny breaks help brighten things.";
  if (events?.filteredSun) return "Filtered sun peeks through thicker clouds.";

  if (sky.cloudState === "overcast") return "Skies lean gray and muted.";
  if (sky.cloudState === "mostly cloudy") return "Clouds dominate much of the day.";
  if (sky.cloudState === "partly cloudy") return "Skies mix between clouds and brighter moments.";
  if (sky.cloudState === "mostly clear") return "Skies stay fairly bright overall.";

  return "";
}

// ------------------------------------------------------------
// TRENDS (Sky‑Aware)
// ------------------------------------------------------------
function detectTrends(stats, events, sky) {
  const trends = [];

  // Temperature
  if (stats.tempMax - stats.tempMin >= 25) trends.push("bigWarmup");
  else if (stats.tempMin - stats.tempMax >= 10) trends.push("coolingOff");

  // Wind
  if (stats.windGustMax >= 35) trends.push("gusty");
  else if (stats.windGustMax <= 10) trends.push("calming");

  // Precip
  if (stats.rainTotal >= 0.25 || stats.snowTotal >= 0.25) trends.push("wetPattern");
  else if (stats.rainTotal === 0 && stats.snowTotal === 0) trends.push("dryingOut");

  // Sky
  if (sky?.cloudState === "overcast") trends.push("cloudy");
  if (sky?.cloudState === "mostly clear") trends.push("brightening");

  return trends;
}

// ------------------------------------------------------------
// EMOJI SELECTION (Sky‑Aware)
// ------------------------------------------------------------
function pickEmoji(events, trends, sky) {
  const d = events?.driver;

  const map = {
    rain: ["🌧️", "🌦️", "☔"],
    snow: ["❄️", "🌨️", "☃️"],
    wind: ["🌬️", "🍃", "💨"],
    hot: ["🔥", "🌞", "🥵"],
    cold: ["🥶", "❄️", "🧊"],
    goldilocks: ["🌤️", "🌿", "😊"],
    easy: ["🌤️", "🙂", "🍃"]
  };

  const trendMap = {
    bigWarmup: ["📈", "🌡️"],
    coolingOff: ["📉", "🧥"],
    gusty: ["💨"],
    calming: ["🍃"],
    wetPattern: ["☔"],
    dryingOut: ["🌤️"],
    cloudy: ["☁️"],
    brightening: ["🌤️"]
  };

  const skyMap = {
    overcast: ["☁️"],
    "mostly clear": ["🌤️"],
    "partly cloudy": ["⛅"],
    fog: ["🌫️"],
    haze: ["🌫️"]
  };

  const base = map[d] ?? ["🌤️"];
  const trendEmojis = trends.flatMap(t => trendMap[t] ?? []);
  const skyEmojis = sky?.cloudState ? skyMap[sky.cloudState] ?? [] : [];

  const combined = [...base, ...trendEmojis, ...skyEmojis];
  return combined[Math.floor(Math.random() * combined.length)];
}