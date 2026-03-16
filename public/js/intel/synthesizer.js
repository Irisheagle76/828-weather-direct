// /intel/synthesizer.js
// Human‑Action Outlook Generator — Warm + Direct Hybrid Tone

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

  const headline = generateHeadline(stats, events);
  const narrative = generateHumanNarrative(stats, events);
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
// HEADLINE — short, expressive, warm + direct
// ------------------------------------------------------------
function generateHeadline(stats, events) {
  const d = events?.driver;

  const map = {
    rain: "A damp, drizzly kind of day",
    snow: "Snowy vibes ahead",
    wind: "A breezy, lively day",
    hot: "Warm and energetic",
    cold: "A chilly, layered kind of day",
    goldilocks: "A genuinely pleasant day",
    easy: "A calm, manageable day"
  };

  return map[d] ?? "A steady, uncomplicated day";
}

// ------------------------------------------------------------
// NARRATIVE — 1–2 sentences, warm + direct, no stat dumps
// ------------------------------------------------------------
function generateHumanNarrative(stats, events) {
  const { tempMin, tempMax, windGustMax, rainTotal, snowTotal, cloudAvg } = stats;
  const d = events?.driver;

  const tempPhrase = buildTempPhrase(tempMin, tempMax);
  const windPhrase = buildWindPhrase(windGustMax);
  const precipPhrase = buildPrecipPhrase(rainTotal, snowTotal);
  const cloudPhrase = buildCloudPhrase(cloudAvg);

  // Build a warm + direct narrative
  let parts = [];

  // Driver sets the emotional tone
  switch (d) {
    case "rain":
      parts.push("A gray, drizzly stretch — nothing dramatic, but you’ll feel it.");
      break;
    case "snow":
      parts.push("A wintry, unsettled day with a few attitude swings.");
      break;
    case "wind":
      parts.push("A breezy, jacket‑friendly day — lively but manageable.");
      break;
    case "hot":
      parts.push("A warm, energetic day that may feel a bit heavy at times.");
      break;
    case "cold":
      parts.push("A chilly day that rewards layers and a little patience.");
      break;
    case "goldilocks":
      parts.push("A genuinely pleasant day — easy to dress for and easy to enjoy.");
      break;
    default:
      parts.push("A steady, uncomplicated day overall.");
  }

  // Add supporting phrases (but only if meaningful)
  const support = [tempPhrase, windPhrase, precipPhrase, cloudPhrase]
    .filter(Boolean)
    .join(" ");

  return `${parts.join(" ")} ${support}`.trim();
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
// PHRASE HELPERS — warm + direct, no raw numbers unless needed
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
  // ------------------------------------------------------------
// ANTI-REDUNDANCY — ensures Tomorrow doesn't echo Today
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
// HELPERS
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
}
