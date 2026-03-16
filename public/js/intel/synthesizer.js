// /intel/synthesizer.js
// Human‑Action Outlook Generator — Warm + Direct Hybrid Tone
// Includes: Trend Awareness, Emoji Variation, Anti‑Redundancy

export function synthesizeOutlook(stats, events, hours) {
  if (!stats || hours.length === 0) {
    return {
      headline: "No data available",
      narrative: "",
      bullets: [],
      isEndOfDay: false,
      isEarlyMorning: false
    };
  }

  const trends = detectTrends(stats);
  const emoji = pickEmoji(events, trends);

  const headline = generateHeadline(stats, events, trends, emoji);
  const narrative = generateHumanNarrative(stats, events, trends);
  const bullets = generateHumanBullets(stats, events);

  return {
    headline,
    narrative,
    bullets,
    isEndOfDay: events?.isEndOfDay ?? false,
    isEarlyMorning: events?.isEarlyMorning ?? false
  };
}

// ------------------------------------------------------------
// HEADLINE — expressive, warm + direct, trend‑aware, emoji‑aware
// ------------------------------------------------------------
function generateHeadline(stats, events, trends, emoji) {
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

  // Trend overrides
  if (trends.includes("bigWarmup")) base = "A day that warms up nicely";
  if (trends.includes("coolingOff")) base = "A cooler, more settled day";
  if (trends.includes("brightening")) base = "A day that tries to brighten";
  if (trends.includes("cloudy")) base = "A gray, moody kind of day";

  return `${emoji} ${base}`;
}

// ------------------------------------------------------------
// NARRATIVE — warm + direct, trend‑aware, no stat dumps
// ------------------------------------------------------------
function generateHumanNarrative(stats, events, trends) {
  const { tempMin, tempMax, windGustMax, rainTotal, snowTotal, cloudAvg } = stats;

  const tempPhrase = buildTempPhrase(tempMin, tempMax);
  const windPhrase = buildWindPhrase(windGustMax);
  const precipPhrase = buildPrecipPhrase(rainTotal, snowTotal);
  const cloudPhrase = buildCloudPhrase(cloudAvg);

  const trendPhrases = [];

  if (trends.includes("bigWarmup")) trendPhrases.push("The day warms noticeably as it goes.");
  if (trends.includes("coolingOff")) trendPhrases.push("Temperatures ease downward into a cooler feel.");
  if (trends.includes("gusty")) trendPhrases.push("Winds get lively at times.");
  if (trends.includes("calming")) trendPhrases.push("Winds ease back later on.");
  if (trends.includes("brightening")) trendPhrases.push("Skies may try to brighten.");
  if (trends.includes("cloudy")) trendPhrases.push("Clouds hold firm for much of the day.");

  const support = [
    tempPhrase,
    windPhrase,
    precipPhrase,
    cloudPhrase,
    ...trendPhrases
  ].filter(Boolean).join(" ");

  return support.trim();
}

// ------------------------------------------------------------
// BULLETS — human, actionable, no stat dumps
// ------------------------------------------------------------
function generateHumanBullets(stats, events) {
  const bullets = [];

  // Clothing
  if (stats.tempMax <= 40) bullets.push("Dress warm — layers help.");
  else if (stats.tempMax <= 55) bullets.push("A jacket is a smart move.");
  else if (stats.tempMax >= 80) bullets.push("Light clothing keeps things comfortable.");

  // Wind
  if (stats.windGustMax >= 35) bullets.push("Expect a few pushy gusts.");
  else if (stats.windGustMax >= 20) bullets.push("A breezy afternoon may nudge you around.");

  // Precip
  if (stats.rainTotal >= 0.25) bullets.push("Keep rain gear handy.");
  else if (stats.rainTotal > 0) bullets.push("A quick shower is possible.");

  if (stats.snowTotal >= 0.5) bullets.push("Watch for slick spots early.");
  else if (stats.snowTotal > 0) bullets.push("A light coating may linger.");

  // Clouds
  if (stats.cloudAvg >= 80) bullets.push("Skies stay mostly gray.");
  else if (stats.cloudAvg <= 40) bullets.push("Some brighter breaks possible.");

  // Commute cues
  if (events?.pmCommuteImpact) bullets.push("PM commute: possible delays.");
  if (events?.amCommuteImpact) bullets.push("AM commute: allow a little extra time.");

  return bullets;
}

// ------------------------------------------------------------
// PHRASE HELPERS — warm + direct
// ------------------------------------------------------------
function buildTempPhrase(min, max) {
  if (max <= 32) return "Cold from start to finish.";
  if (max <= 45) return "Chilly overall.";
  if (max <= 60) return "Cool but manageable.";
  if (max <= 75) return "Comfortable for most of the day.";
  if (max <= 85) return "Warm but not overbearing.";
  return "On the hotter side.";
}

function buildWindPhrase(gust) {
  if (gust >= 45) return "Winds get feisty at times.";
  if (gust >= 30) return "A few lively gusts in the mix.";
  if (gust >= 20) return "A gentle, steady breeze.";
  return "";
}

function buildPrecipPhrase(rain, snow) {
  if (snow >= 1) return "Snow makes a noticeable appearance.";
  if (snow > 0) return "A touch of snow early.";
  if (rain >= 0.5) return "Rain is a steady companion.";
  if (rain > 0) return "A few showers drift through.";
  return "";
}

function buildCloudPhrase(cloud) {
  if (cloud >= 80) return "Skies lean gray and moody.";
  if (cloud <= 40) return "Some brighter breaks possible.";
  return "";
}

// ------------------------------------------------------------
// TREND AWARENESS
// ------------------------------------------------------------
function detectTrends(stats) {
  const trends = [];

  // Temperature trend
  if (stats.tempMax - stats.tempMin >= 20) trends.push("bigWarmup");
  else if (stats.tempMin - stats.tempMax >= 10) trends.push("coolingOff");

  // Wind trend
  if (stats.windGustMax >= 35) trends.push("gusty");
  else if (stats.windGustMax <= 10) trends.push("calming");

  // Moisture trend
  if (stats.rainTotal >= 0.25 || stats.snowTotal >= 0.25) trends.push("wetPattern");
  else if (stats.rainTotal === 0 && stats.snowTotal === 0) trends.push("dryingOut");

  // Cloud trend
  if (stats.cloudAvg >= 80) trends.push("cloudy");
  else if (stats.cloudAvg <= 40) trends.push("brightening");

  return trends;
}

// ------------------------------------------------------------
// EMOJI VARIATION
// ------------------------------------------------------------
function pickEmoji(events, trends) {
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

  const base = map[d] ?? ["🌤️"];
  const trendEmojis = trends.flatMap(t => trendMap[t] ?? []);

  const combined = [...base, ...trendEmojis];
  return combined[Math.floor(Math.random() * combined.length)];
}

// ------------------------------------------------------------
// ANTI‑REDUNDANCY — ensures Tomorrow doesn't echo Today
// ------------------------------------------------------------
export function differentiateFromToday(todayOutlook, tomorrowOutlook) {
  if (!todayOutlook || !tomorrowOutlook) return tomorrowOutlook;

  const tdy = todayOutlook;
  const tmr = { ...tomorrowOutlook };

  // 1. If headlines are too similar → soften Tomorrow's tone
  if (tdy.headline === tmr.headline) {
    tmr.headline = transformHeadline(tmr.headline);
  }

  // 2. If narratives share too many words → reframe Tomorrow
  const overlap = wordOverlap(tdy.narrative, tmr.narrative);
  if (overlap > 0.45) {
    tmr.narrative = reframeNarrative(tmr.narrative);
  }

  // 3. Remove bullets that duplicate Today’s themes
  tmr.bullets = tmr.bullets.filter(b => {
    return !tdy.bullets.some(tb => bulletSimilarity(tb, b) > 0.5);
  });

  // If bullets become empty, add a fresh forward-looking cue
  if (tmr.bullets.length === 0) {
    tmr.bullets.push("A different feel from today.");
  }

  return tmr;
}

// ------------------------------------------------------------
// ANTI‑REDUNDANCY HELPERS
// ------------------------------------------------------------
function wordOverlap(a, b) {
  const A = new Set(a.toLowerCase().split(/\W+/));
  const B = new Set(b.toLowerCase().split(/\W+/));
  const inter = [...A].filter(x => B.has(x));
  return inter.length / Math.min(A.size, B.size);
}

function bulletSimilarity(a, b) {
  const A = a.toLowerCase().split(/\W+/);
  const B = b.toLowerCase().split(/\W+/);
  const inter = A.filter(x => B.includes(x));
  return inter.length / Math.min(A.length, B.length);
}

function transformHeadline(h) {
  const variants = [
    "A different feel tomorrow",
    "A shift in the pattern",
    "A new tone to the day",
    "A change of pace ahead"
  ];
  return variants[Math.floor(Math.random() * variants.length)];
}

function reframeNarrative(n) {
  return (
    "Tomorrow brings a slightly different rhythm. " +
    n.replace(/^[A-Z][^.]+\./, "").trim()
  );
}
