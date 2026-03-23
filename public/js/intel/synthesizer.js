// /js/intel/synthesizer.js
// Human‑Action Outlook Generator — Today, Tomorrow, Remainder of Today

// ------------------------------------------------------------
// MAIN OUTLOOK (Today / Tomorrow)
// ------------------------------------------------------------
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

  return {
    headline: generateHeadline(stats, events, trends, emoji),
    narrative: generateHumanNarrative(stats, events, trends),
    bullets: generateHumanBullets(stats, events),
    isEndOfDay: events?.isEndOfDay ?? false,
    isEarlyMorning: events?.isEarlyMorning ?? false
  };
}

// ------------------------------------------------------------
// HEADLINE
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

  if (trends.includes("bigWarmup")) base = "A day that warms up nicely";
  if (trends.includes("coolingOff")) base = "A cooler, more settled day";
  if (trends.includes("brightening")) base = "A day that tries to brighten";
  if (trends.includes("cloudy")) base = "A gray, moody kind of day";

  return `${emoji} ${base}`;
}

// ------------------------------------------------------------
// NARRATIVE
// ------------------------------------------------------------
function generateHumanNarrative(stats, events, trends) {
  const { tempMin, tempMax, windGustMax, rainTotal, snowTotal, cloudAvg } = stats;

  const parts = [
    buildTempPhrase(tempMin, tempMax),
    buildWindPhrase(windGustMax),
    buildPrecipPhrase(rainTotal, snowTotal),
    buildCloudPhrase(cloudAvg)
  ];

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
function generateHumanBullets(stats, events) {
  const bullets = [];

  if (stats.tempMax <= 40) bullets.push("Dress warm — layers help.");
  else if (stats.tempMax <= 55) bullets.push("A jacket is a smart move.");
  else if (stats.tempMax >= 80) bullets.push("Light clothing keeps things comfortable.");

  if (stats.windGustMax >= 35) bullets.push("Expect a few pushy gusts.");
  else if (stats.windGustMax >= 20) bullets.push("A breezy afternoon may nudge you around.");

  if (stats.rainTotal >= 0.25) bullets.push("Keep rain gear handy.");
  else if (stats.rainTotal > 0) bullets.push("A quick shower is possible.");

  if (stats.snowTotal >= 0.5) {
    bullets.push("Watch for slick spots early.");
  } else if (stats.snowTotal > 0) {
    const options = [
      "A touch of snow early in the day.",
      "A light dusting to start things off.",
      "Snowflakes could make a morning appearance."
    ];
    bullets.push(options[Math.floor(Math.random() * options.length)]);
  }

  if (stats.cloudAvg >= 80) bullets.push("Skies stay mostly gray.");
  else if (stats.cloudAvg <= 40) bullets.push("Some brighter breaks possible.");

  if (events?.pmCommuteImpact) bullets.push("PM commute: possible delays.");
  if (events?.amCommuteImpact) bullets.push("AM commute: allow a little extra time.");

  return bullets;
}

// ------------------------------------------------------------
// PHRASE HELPERS
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
// TRENDS
// ------------------------------------------------------------
function detectTrends(stats) {
  const trends = [];

  // ------------------------------------------------------------
  // TEMPERATURE TRENDS (fixed + more meteorologically honest)
  // ------------------------------------------------------------

  // True big diurnal warmup: unusually large rise (≥ 25°F)
  // This preserves your ability to call out "bigWarmup" days.
  if (stats.tempMax - stats.tempMin >= 25) {
    trends.push("bigWarmup");
  }

  // True cooling day: max temp at least 10°F below the morning low
  // (your original logic, preserved)
  else if (stats.tempMin - stats.tempMax >= 10) {
    trends.push("coolingOff");
  }

  // ------------------------------------------------------------
  // WIND TRENDS
  // ------------------------------------------------------------
  if (stats.windGustMax >= 35) {
    trends.push("gusty");
  } else if (stats.windGustMax <= 10) {
    trends.push("calming");
  }

  // ------------------------------------------------------------
  // PRECIPITATION TRENDS
  // ------------------------------------------------------------
  if (stats.rainTotal >= 0.25 || stats.snowTotal >= 0.25) {
    trends.push("wetPattern");
  } else if (stats.rainTotal === 0 && stats.snowTotal === 0) {
    trends.push("dryingOut");
  }

  // ------------------------------------------------------------
  // CLOUD TRENDS
  // ------------------------------------------------------------
  if (stats.cloudAvg >= 80) {
    trends.push("cloudy");
  } else if (stats.cloudAvg <= 40) {
    trends.push("brightening");
  }

  return trends;
}
// ------------------------------------------------------------
// EMOJI SELECTION
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
// REMAINDER-OF-TODAY OUTLOOK (earlier vs later)
// ------------------------------------------------------------
export function synthesizeRemainderTodayOutlook(statsEarlier, statsRemainder) {
  const narrativeParts = [];
  const bullets = [];

  // -----------------------------
  // Temperature comparison
  // -----------------------------
  const tempDrop = statsEarlier.tempMax - statsRemainder.tempMax;
  const tempRise = statsRemainder.tempMax - statsEarlier.tempMax;

  if (tempDrop >= 12) {
    narrativeParts.push("Temperatures fall sharply compared to earlier today.");
    bullets.push("Expect a noticeably cooler feel.");
  } else if (tempDrop >= 6) {
    narrativeParts.push("A cooler turn compared to earlier today.");
  }

  if (tempRise >= 10) {
    narrativeParts.push("Temperatures climb compared to earlier today.");
  }

  // -----------------------------
  // Dewpoint / humidity comparison
  // -----------------------------
  const dewDrop = statsEarlier.dewAvg - statsRemainder.dewAvg;
  const dewRise = statsRemainder.dewAvg - statsEarlier.dewAvg;

  if (dewDrop >= 10) {
    narrativeParts.push("Humidity drops off noticeably compared to earlier.");
    bullets.push("A less muggy feel later on.");
  } else if (dewDrop >= 6) {
    narrativeParts.push("Humidity eases back later in the day.");
  }

  if (dewRise >= 10) {
    narrativeParts.push("Humidity builds noticeably compared to earlier.");
    bullets.push("A more humid feel develops.");
  } else if (dewRise >= 6) {
    narrativeParts.push("Humidity increases again this evening.");
  }

  // -----------------------------
  // Wind speed comparison
  // -----------------------------
  const windDrop = statsEarlier.windGustMax - statsRemainder.windGustMax;
  const windRise = statsRemainder.windGustMax - statsEarlier.windGustMax;

  if (windDrop >= 10) {
    narrativeParts.push("Winds calm down after a breezy start.");
  }

  if (windRise >= 10) {
    narrativeParts.push("Winds pick up compared to earlier.");
  }

  // -----------------------------
  // Wind direction comparison
  // -----------------------------
  const earlierDir = statsEarlier.windDirDominant;
  const laterDir = statsRemainder.windDirDominant;

  if (earlierDir && laterDir && earlierDir !== laterDir) {
    if (earlierDir.startsWith("NW") && laterDir.startsWith("SW")) {
      narrativeParts.push("Winds shift southerly later — a warmer feel.");
    } else if (earlierDir.startsWith("SW") && laterDir.startsWith("NW")) {
      narrativeParts.push("A cooler northwest breeze moves in later.");
    } else if (laterDir.startsWith("S")) {
      narrativeParts.push("A more humid southerly flow develops.");
    } else if (laterDir.startsWith("N")) {
      narrativeParts.push("A drier north breeze settles in.");
    }
  }

  // -----------------------------
  // Cloud trend nuance
  // -----------------------------
  const cloudDrop = statsEarlier.cloudAvg - statsRemainder.cloudAvg;
  const cloudRise = statsRemainder.cloudAvg - statsEarlier.cloudAvg;

  if (cloudDrop >= 25) {
    narrativeParts.push("Skies brighten noticeably later on.");
  } else if (cloudDrop >= 15) {
    narrativeParts.push("Some clearing develops later.");
  }

  if (cloudRise >= 25) {
    narrativeParts.push("Clouds rebuild toward evening.");
  } else if (cloudRise >= 15) {
    narrativeParts.push("Skies turn cloudier later in the day.");
  }

  // -----------------------------
  // Precipitation nuance
  // -----------------------------
  const earlierPrecip = statsEarlier.rainTotal + statsEarlier.snowTotal;
  const laterPrecip = statsRemainder.rainTotal + statsRemainder.snowTotal;

  if (earlierPrecip === 0 && laterPrecip > 0) {
    narrativeParts.push("Showers develop later after a dry start.");
    bullets.push("Rain gear may be needed later.");
  }

  if (earlierPrecip > 0 && laterPrecip > 0) {
    narrativeParts.push("Another round of precipitation is possible later.");
  }

  if (earlierPrecip > laterPrecip && laterPrecip > 0) {
    narrativeParts.push("Precipitation tapers but does not fully end.");
  }

  if (laterPrecip > earlierPrecip) {
    narrativeParts.push("Precipitation becomes more likely later in the day.");
  }

  // -----------------------------
  // If nothing dramatic changes
  // -----------------------------
  if (narrativeParts.length === 0) {
    narrativeParts.push("A quiet, uncomplicated finish to the day.");
  }

  // -----------------------------
  // Remainder driver + emoji
  // -----------------------------
  let driver = "easy";
  if (statsRemainder.snowTotal > 0) driver = "snow";
  else if (statsRemainder.rainTotal > 0) driver = "rain";
  else if (statsRemainder.windGustMax >= 25) driver = "wind";
  else if (statsRemainder.tempMax >= 80) driver = "hot";
  else if (statsRemainder.tempMax <= 40) driver = "cold";

  const trends = detectTrends(statsRemainder);
  const emoji = pickEmoji({ driver }, trends);

  const headline = `${emoji} A steady finish to the day`;

  return {
    headline,
    narrative: narrativeParts.join(" "),
    bullets
  };
}

// ------------------------------------------------------------
// ANTI‑REDUNDANCY (Tomorrow vs Today)
// ------------------------------------------------------------
export function differentiateFromToday(todayOutlook, tomorrowOutlook) {
  if (!todayOutlook || !tomorrowOutlook) return tomorrowOutlook;

  const tdy = todayOutlook;
  const tmr = { ...tomorrowOutlook };

  if (tdy.headline === tmr.headline) {
    tmr.headline = transformHeadline(tmr.headline);
  }

  const overlap = wordOverlap(tdy.narrative, tmr.narrative);
  if (overlap > 0.45) {
    tmr.narrative = reframeNarrative(tmr.narrative);
  }

  tmr.bullets = tmr.bullets.filter(b => {
    return !tdy.bullets.some(tb => bulletSimilarity(tb, b) > 0.5);
  });

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
