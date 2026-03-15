// ============================================================
// MULTI‑PHASE WEATHER ENGINE (NEW)
// ============================================================

// Analyze a day's hourly slice and detect phases, trends, and drivers
export function analyzeDay(hours) {
  const phases = detectPhases(hours);
  const trends = detectTrends(hours);
  const drivers = detectDominantDrivers(hours, phases, trends);
  const snow = detectSnowBehindFront(hours);

  const isEventDay =
    phases.length > 1 ||
    drivers.includes("front") ||
    drivers.includes("temp-drop");

  return {
    isEventDay,
    phases,
    trends,
    drivers,
    snow
  };
}

// ------------------------------------------------------------
// PHASE DETECTION
// ------------------------------------------------------------
function detectPhases(hours) {
  const phases = [];

  const hasRainEarly = hours.some((h, i) =>
    i >= 6 && i <= 12 &&
    h.precip > 0.02 &&
    h.snow === 0 &&
    h.temp > 34
  );

  const hasThunder = hours.some((h, i) =>
    h.precip > 0.10 &&
    h.temp >= 55 &&
    h.gust >= 25
  );

  const hasFrontalPassage = detectFrontalPassage(hours);
  const hasPostFrontalCold = detectPostFrontalCold(hours);
  const hasNwSnow = detectSnowBehindFront(hours).nwFlowSnow;

  if (hasRainEarly) phases.push("rain-early");
  if (hasThunder) phases.push("thunder-embedded");
  if (hasFrontalPassage) phases.push("frontal-passage");
  if (hasPostFrontalCold) phases.push("post-frontal-cold");
  if (hasNwSnow) phases.push("nw-snow");

  return phases;
}

// ------------------------------------------------------------
// FRONTAL PASSAGE DETECTION
// ------------------------------------------------------------
function detectFrontalPassage(hours) {
  for (let i = 1; i < hours.length; i++) {
    const prev = hours[i - 1];
    const curr = hours[i];

    const tempDrop = prev.temp - curr.temp >= 4;
    const gustSpike = curr.gust - prev.gust >= 6;
    const precipEnds = prev.precip > 0.02 && curr.precip === 0;

    if ((tempDrop && gustSpike) || (tempDrop && precipEnds)) {
      return true;
    }
  }
  return false;
}

// ------------------------------------------------------------
// POST‑FRONTAL COLD DETECTION
// ------------------------------------------------------------
function detectPostFrontalCold(hours) {
  const afternoon = hours.slice(12, 18);
  if (afternoon.length < 2) return false;

  const start = afternoon[0].temp;
  const end = afternoon[afternoon.length - 1].temp;

  return end <= start - 6;
}

// ------------------------------------------------------------
// TREND ENGINE
// ------------------------------------------------------------
function detectTrends(hours) {
  if (!hours.length) return { tempFalling: false, tempRising: false };

  const first = hours[0].temp;
  const last = hours[hours.length - 1].temp;

  return {
    tempFalling: last <= first - 8,
    tempRising: last >= first + 8
  };
}

// ------------------------------------------------------------
// DOMINANT DRIVER DETECTION
// ------------------------------------------------------------
function detectDominantDrivers(hours, phases, trends) {
  const drivers = [];

  const windy = hours.some(h => h.gust >= 25);
  const rainy = hours.some(h => h.precip > 0.05 && h.snow === 0);
  const snowy = hours.some(h => h.snow > 0);

  if (phases.includes("frontal-passage")) drivers.push("front");
  if (windy) drivers.push("wind");
  if (rainy) drivers.push("precip");
  if (snowy) drivers.push("snow");
  if (trends.tempFalling) drivers.push("temp-drop");
  if (trends.tempRising) drivers.push("warm-surge");

  return drivers;
}

// ------------------------------------------------------------
// NW‑FLOW SNOW DETECTION (inferred)
// ------------------------------------------------------------
function detectSnowBehindFront(hours) {
  const nwSnow = hours.some(h => {
    const coldEnough = h.temp <= 36;
    const precip = h.precip > 0.01;
    const snow = h.snow > 0;
    const gusty = h.gust >= 20;

    return coldEnough && (snow || precip) && gusty;
  });

  return { nwFlowSnow: nwSnow };
}

// ------------------------------------------------------------
// HOURLY NORMALIZER (NEW)
// Converts your raw hourly arrays into objects the engine can use
// ------------------------------------------------------------
export function normalizeHourly(hourly, indices) {
  return indices.map(i => ({
    temp: hourly.temperature_2m[i],
    dew: hourly.dewpoint_2m[i],
    gust: hourly.windgusts_10m[i],
    precip: hourly.precipitation[i],
    snow: hourly.snowfall[i],
    uv: hourly.uv_index ? hourly.uv_index[i] : 0,
    time: hourly.time[i]
  }));
}
// ------------------------------------------------------------
// TIME + WINDOW HELPERS
// ------------------------------------------------------------
function getHourlyWindowForDay(hourly, targetDate) {
  const times = hourly.time || [];
  const indices = [];

  const start = new Date(targetDate);
  start.setHours(0, 0, 0, 0);

  const end = new Date(targetDate);
  end.setHours(23, 59, 59, 999);

  for (let i = 0; i < times.length; i++) {
    const t = new Date(times[i]);
    if (t >= start && t <= end) indices.push(i);
  }

  return indices;
}

function getTodayRemainingWindow(hourly) {
  const times = hourly.time || [];
  const indices = [];

  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  for (let i = 0; i < times.length; i++) {
    const t = new Date(times[i]);
    if (t >= now && t <= end) indices.push(i);
  }

  if (indices.length < 3) return [];
  return indices;
}

function getTomorrowWindow(hourly) {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);

  const indices = getHourlyWindowForDay(hourly, tomorrow);
  if (indices.length < 6) return [];
  return indices;
}
// ------------------------------------------------------------
// DOMINANT FACTOR SCORING
// ------------------------------------------------------------
function getDominantFactor(tempHigh, gustMax, precipTotal, snowTotal) {
  const drivers = [];

  if (snowTotal >= 0.5) {
    drivers.push({ type: "snow", score: 80 + snowTotal * 10 });
  }

  if (snowTotal === 0 && precipTotal >= 0.10) {
    drivers.push({ type: "rain", score: 55 + precipTotal * 20 });
  }

  if (gustMax >= 40) {
    drivers.push({ type: "wind", score: 50 + gustMax });
  }

  if (tempHigh >= 88) {
    drivers.push({ type: "heat", score: 55 + (tempHigh - 88) * 2 });
  }

  if (tempHigh <= 35) {
    drivers.push({ type: "cold", score: 55 + (35 - tempHigh) * 2 });
  }

  if (
    precipTotal < 0.05 &&
    snowTotal === 0 &&
    gustMax < 26 &&
    tempHigh >= 60 &&
    tempHigh <= 75
  ) {
    drivers.push({ type: "goldilocks", score: 40 });
  }

  if (!drivers.length) return "easy";

  drivers.sort((a, b) => b.score - a.score);
  return drivers[0].type;
}
// ============================================================
// PART 2 — TODAY — Human‑Action Outlook (Upgraded)
// ============================================================

// Clothing helper — returns a short phrase or null
function getClothingAdviceToday(tempNow, tempHigh, dewNow, gustMax) {
  const advice = [];

  if (tempNow <= 32) advice.push("warm layers recommended");
  else if (tempNow <= 45) advice.push("a jacket helps early");
  else if (tempHigh >= 75) advice.push("short sleeves feel good");
  else if (tempHigh - tempNow >= 18) advice.push("layers helpful with the warm‑up");

  if (gustMax >= 30) advice.push("wind‑resistant layers useful");
  if (dewNow >= 65) advice.push("light, breathable clothing helps");

  if (!advice.length) return null;
  return advice[0];
}

// ------------------------------------------------------------
// TODAY ACTION OUTLOOK (Upgraded)
// ------------------------------------------------------------
export function getTodayActionOutlook(hourly) {
  const indices = getTodayRemainingWindow(hourly);

  // END‑OF‑DAY OVERRIDE
  if (!indices.length) {
    return {
      badge: { text: "No Hazards", class: "badge-easy" },
      emoji: "🌙",
      headline: "The day is winding down.",
      text: "Fresh forecast updates arrive tomorrow morning.",
      bullets: [],
      suppressMicroAdvice: true,
      isEndOfDay: true
    };
  }

  const now = new Date();
  const currentHour = now.getHours();

  // Pull key stats (next 12 hours)
  const temps = hourly.temperature_2m;
  const dew = hourly.dewpoint_2m;
  const gusts = hourly.windgusts_10m;
  const precip = hourly.precipitation;
  const snow = hourly.snowfall || [];

  const tempNow = temps[currentHour];
  const tempSlice = temps.slice(currentHour, currentHour + 12);
  const tempHigh = Math.max(...tempSlice);
  const tempLow = Math.min(...tempSlice);

  const dewNow = dew[currentHour];
  const gustMax = Math.max(...gusts.slice(currentHour, currentHour + 12));
  const precipTotal = precip.slice(currentHour, currentHour + 12).reduce((a, b) => a + b, 0);
  const snowTotal = snow.slice(currentHour, currentHour + 12).reduce((a, b) => a + b, 0);

  // Multi‑phase analysis (NEW)
  const normalized = normalizeHourly(hourly, indices);
  const analysis = analyzeDay(normalized);
  const { isEventDay, phases, trends, drivers, snow: snowSig } = analysis;

  // Dominant factor (existing logic still used)
  const dominant = getDominantFactor(tempHigh, gustMax, precipTotal, snowTotal);

  // Base descriptors
  const tempDesc = describeTemp(tempNow, tempHigh);
  const precipDesc = describePrecip(precipTotal, snowTotal);
  const windDesc = describeWind(gustMax);

  // Clothing logic
  const clothing = getClothingAdviceToday(tempNow, tempHigh, dewNow, gustMax);

  // Main sentence — event‑day aware
  let mainSentence;

  if (isEventDay) {
    mainSentence = buildTodayEventMainSentence({
      tempDesc,
      precipDesc,
      windDesc,
      clothing,
      phases,
      trends,
      drivers,
      snowSig
    });
  } else {
    mainSentence = mergePhrases(tempDesc, precipDesc, windDesc);
    if (clothing && (dominant === "cold" || dominant === "heat" || dominant === "wind")) {
      mainSentence = mergePhrases(mainSentence, clothing);
    }
  }

  mainSentence = mainSentence.charAt(0).toUpperCase() + mainSentence.slice(1) + ".";

  // Emoji + headline — event‑day aware
  let emoji = "🙂";
  let headline = "A straightforward day.";

  if (isEventDay) {
    const eventHeadline = buildTodayEventHeadline({ drivers, phases, trends });
    emoji = eventHeadline.emoji;
    headline = eventHeadline.headline;
  } else {
    switch (dominant) {
      case "snow":
        emoji = "❄️";
        headline = "Allow extra travel time.";
        break;
      case "rain":
        emoji = "🌧️";
        headline = "Bring a rain jacket.";
        break;
      case "wind":
        emoji = "💨";
        headline = "Secure loose outdoor items.";
        break;
      case "heat":
        emoji = "🥵";
        headline = "Stay hydrated.";
        break;
      case "cold":
        emoji = "🥶";
        headline = "Dress in warm layers.";
        break;
      case "goldilocks":
        emoji = "🌟";
        headline = "Make outdoor plans.";
        break;
      default:
        emoji = "🙂";
        headline = "A calm, easygoing day.";
    }
  }

  // Bullets — upgraded, event‑day aware
  const bullets = buildTodayBulletsUpgraded({
    tempNow,
    tempHigh,
    tempLow,
    dewNow,
    gustMax,
    precipTotal,
    precipHours: precip.slice(currentHour, currentHour + 12),
    snowTotal,
    sunrise: hourly.sunrise,
    sunset: hourly.sunset,
    clothing,
    analysis
  });

  return {
    badge: { text: "Today", class: "badge-easy" },
    emoji,
    headline,
    text: mainSentence,
    bullets,
    suppressMicroAdvice: false,
    isEndOfDay: false
  };
}

// ------------------------------------------------------------
// TODAY EVENT‑DAY MAIN SENTENCE (NEW)
// ------------------------------------------------------------
function buildTodayEventMainSentence({
  tempDesc,
  precipDesc,
  windDesc,
  clothing,
  phases,
  trends,
  drivers,
  snowSig
}) {
  // Prioritize sequence + impact over simple blending
  const parts = [];

  if (phases.includes("rain-early")) {
    parts.push("rain moves through early");
  }
  if (phases.includes("thunder-embedded")) {
    parts.push("a few rumbles are possible with the morning rain");
  }
  if (phases.includes("frontal-passage")) {
    parts.push("a strong front brings a sharp change");
  }
  if (phases.includes("post-frontal-cold") || trends.tempFalling) {
    parts.push("it turns noticeably colder later");
  }
  if (phases.includes("nw-snow") || snowSig.nwFlowSnow) {
    parts.push("scattered snow showers may follow behind the front");
  }

  // If somehow no phase text, fall back to descriptors
  let sentence;
  if (parts.length) {
    sentence = parts.join(", ");
  } else {
    sentence = mergePhrases(tempDesc, precipDesc, windDesc);
  }

  if (clothing && (drivers.includes("wind") || drivers.includes("temp-drop"))) {
    sentence = mergePhrases(sentence, clothing);
  }

  return sentence;
}

// ------------------------------------------------------------
// TODAY EVENT‑DAY HEADLINE (NEW)
// ------------------------------------------------------------
function buildTodayEventHeadline({ drivers, phases, trends }) {
  let emoji = "🌪️";
  let headline = "A very active day.";

  if (drivers.includes("front") && drivers.includes("temp-drop")) {
    emoji = "🌬️";
    headline = "Rain early, then sharply colder and windy.";
  } else if (drivers.includes("front")) {
    emoji = "🌬️";
    headline = "Front‑driven changes — stay weather‑aware.";
  } else if (drivers.includes("wind")) {
    emoji = "💨";
    headline = "Gusty at times — factor in the wind.";
  } else if (drivers.includes("snow")) {
    emoji = "❄️";
    headline = "Changeable day with snow in the mix.";
  }

  if (phases.includes("nw-snow")) {
    emoji = "❄️";
    headline = "Rain to snow — classic mountain setup.";
  }

  if (trends.tempFalling && !drivers.includes("front")) {
    emoji = "🌡️";
    headline = "Turning colder as the day goes on.";
  }

  return { emoji, headline };
}

// ------------------------------------------------------------
// TODAY BULLET ENGINE (Upgraded)
// ------------------------------------------------------------
function buildTodayBulletsUpgraded({
  tempNow,
  tempHigh,
  tempLow,
  dewNow,
  gustMax,
  precipTotal,
  precipHours,
  snowTotal,
  sunrise,
  sunset,
  clothing,
  analysis
}) {
  const bullets = [];
  const { phases, trends, snow: snowSig } = analysis;

  // 🌡️ Temperature bullets
  if (tempNow <= 32) bullets.push("Cold start — layers feel good this morning.");
  else if (tempNow <= 45) bullets.push("Chilly morning air — a jacket helps.");
  else if (tempNow <= 55) bullets.push("Cool but comfortable — layers work well.");
  else if (tempHigh >= 75) bullets.push("Warm afternoon ahead — short sleeves weather.");
  else if (tempHigh - tempLow >= 18) bullets.push("Big warm‑up from morning to afternoon.");

  if (trends.tempFalling) {
    bullets.push("Temperatures fall noticeably later — it won’t stay as mild.");
  }

  // 💨 Wind bullets
  if (gustMax >= 35) bullets.push("Gusty at times — you’ll notice it.");
  else if (gustMax >= 22) bullets.push("A bit breezy this afternoon.");

  // 🌧️ Rain bullets — event‑day aware
  if (precipTotal > 0.05) {
    const firstWet = precipHours.findIndex(v => v > 0.02);
    if (firstWet !== -1) {
      const hour = new Date().getHours() + firstWet;
      if (phases.includes("rain-early")) {
        bullets.push(`Rain moves through in the morning, mainly around ${to12Hour(hour)}.`);
      } else {
        bullets.push(`Rain may drift in around ${to12Hour(hour)}.`);
      }
    } else {
      bullets.push("Spotty showers possible later today.");
    }
  }

  // ❄️ Snow bullets
  if (snowTotal > 0.05 || snowSig.nwFlowSnow) {
    if (snowTotal < 0.5) bullets.push("Light snow or flurries possible — nothing major.");
    else if (snowTotal < 2) bullets.push("Snow showers may coat colder spots and slick up roads.");
    else bullets.push("Accumulating snow possible — travel may slow down.");
  }

  // 💧 Humidity bullets
  if (dewNow >= 65) bullets.push("Humidity may feel noticeable at times.");
  else if (dewNow <= 25) bullets.push("Dry air — very comfortable outside.");

  // 🌄 Sunrise / sunset bullets
  if (sunrise && sunrise.length > 0) {
    const sunriseHour = new Date(sunrise[0]).getHours();
    if (new Date().getHours() < sunriseHour) {
      bullets.push(`Sunrise around ${to12Hour(sunriseHour)}.`);
    }
  }

  if (sunset && sunset.length > 0) {
    const sunsetHour = new Date(sunset[0]).getHours();
    if (new Date().getHours() < sunsetHour) {
      bullets.push(`Sunset near ${to12Hour(sunsetHour)} — cooling after.`);
    }
  }

  // 🏔️ Mountain microclimate bullets
  if (gustMax >= 20 && tempHigh <= 55) {
    bullets.push("Cooler on the ridges — breezy in higher spots.");
  }

  if (precipTotal > 0.05 && tempNow <= 40) {
    bullets.push("Colder hollows may see a brief mix early.");
  }

  if (tempHigh >= 70 && dewNow >= 60) {
    bullets.push("Warm valley feel — a touch muggy in sheltered spots.");
  }

  // 👕 Clothing bullet
  if (clothing) bullets.push(clothing.charAt(0).toUpperCase() + clothing.slice(1) + ".");

  // De‑duplicate + cap at 3
  const unique = [...new Set(bullets)];
  return unique.slice(0, 3);
}
// ============================================================
// PART 3 — TOMORROW — Human‑Action Outlook (Upgraded)
// ============================================================

// Clothing helper — returns a short phrase or null
function getClothingAdviceTomorrow(tempStats, dewStats, windStats) {
  const advice = [];

  const maxT = tempStats.max;
  const minT = tempStats.min;
  const avgDew = dewStats.avg ?? null;
  const maxGust = windStats.max ?? 0;

  if (maxT <= 40) advice.push("warm layers recommended");
  else if (maxT <= 55) advice.push("a jacket helps");
  else if (maxT >= 75) advice.push("short sleeves feel good");

  if (maxGust >= 30) advice.push("wind‑resistant layers useful");
  if (avgDew >= 65) advice.push("light, breathable clothing helps");

  if (!advice.length) return null;
  return advice[0];
}

// ------------------------------------------------------------
// TOMORROW ACTION OUTLOOK (Upgraded)
// ------------------------------------------------------------
export function getHumanActionOutlook(hourly) {
  const indices = getTomorrowWindow(hourly);

  if (!indices.length) {
    return {
      badge: { text: "No data", class: "badge-neutral" },
      emoji: "❓",
      headline: "Check back later.",
      text: "We couldn’t find a usable forecast window for tomorrow.",
      bullets: []
    };
  }

  const win = sliceHourly(hourly, indices);

  const tempStats = getTempStats(win);
  const dewStats = getDewStats(win);
  const windStats = getWindStats(win);
  const precipTotal = getPrecipTotal(win);
  const snowTotal = getSnowTotal(win);

  const avgTemp = tempStats.avg ?? tempStats.max ?? tempStats.min ?? null;
  const gustMax = windStats.max ?? 0;

  // Multi‑phase analysis (NEW)
  const normalized = normalizeHourly(hourly, indices);
  const analysis = analyzeDay(normalized);
  const { isEventDay, phases, trends, drivers, snow: snowSig } = analysis;

  // Base descriptors
  const precipDesc = describePrecip(precipTotal, snowTotal);
  const windDesc = describeWind(gustMax);
  const tempDesc = describeTempRange(tempStats);

  const tempHighF = tempStats.max ?? tempStats.avg ?? null;

  const isGoldilocks =
    precipTotal < 0.05 &&
    snowTotal === 0 &&
    gustMax < 26 &&
    avgTemp != null &&
    avgTemp >= 60 &&
    avgTemp <= 75;

  const dominant = getDominantFactor(tempHighF, gustMax, precipTotal, snowTotal);

  // Clothing logic
  const clothing = getClothingAdviceTomorrow(tempStats, dewStats, windStats);

  // Main sentence — event‑day aware
  let mainSentence;

  if (isEventDay) {
    mainSentence = buildTomorrowEventMainSentence({
      tempDesc,
      precipDesc,
      windDesc,
      clothing,
      phases,
      trends,
      drivers,
      snowSig
    });
  } else {
    mainSentence = mergePhrases(tempDesc, precipDesc, windDesc);
    if (clothing && (dominant === "cold" || dominant === "heat" || dominant === "wind")) {
      mainSentence = mergePhrases(mainSentence, clothing);
    }
  }

  mainSentence = mainSentence.charAt(0).toUpperCase() + mainSentence.slice(1) + ".";

  // Emoji + headline — event‑day aware
  let emoji = "🙂";
  let headline = "A straightforward day.";

  if (isEventDay) {
    const eventHeadline = buildTomorrowEventHeadline({ drivers, phases, trends });
    emoji = eventHeadline.emoji;
    headline = eventHeadline.headline;
  } else {
    switch (dominant) {
      case "snow":
        emoji = "❄️";
        headline = "Allow extra travel time.";
        break;
      case "rain":
        emoji = "🌧️";
        headline = "Bring a rain jacket.";
        break;
      case "wind":
        emoji = "💨";
        headline = "Factor in the wind.";
        break;
      case "heat":
        emoji = "🥵";
        headline = "Stay hydrated.";
        break;
      case "cold":
        emoji = "🥶";
        headline = "Dress in warm layers.";
        break;
      case "goldilocks":
        emoji = "🌟";
        headline = "Make outdoor plans.";
        break;
      default:
        emoji = "🙂";
        headline = "A calm, easygoing day.";
    }
  }

  // Bullets — upgraded, event‑day aware
  const bullets = buildTomorrowBulletsUpgraded({
    win,
    tempStats,
    dewStats,
    windStats,
    precipTotal,
    snowTotal,
    clothing,
    analysis
  });

  return {
    badge: { text: isGoldilocks ? "Goldilocks Day" : "Tomorrow", class: isGoldilocks ? "badge-goldilocks" : "badge-easy" },
    emoji,
    headline,
    text: mainSentence,
    bullets
  };
}

// ------------------------------------------------------------
// TOMORROW EVENT‑DAY MAIN SENTENCE (NEW)
// ------------------------------------------------------------
function buildTomorrowEventMainSentence({
  tempDesc,
  precipDesc,
  windDesc,
  clothing,
  phases,
  trends,
  drivers,
  snowSig
}) {
  const parts = [];

  if (phases.includes("rain-early")) {
    parts.push("rain moves through early");
  }
  if (phases.includes("thunder-embedded")) {
    parts.push("a few rumbles are possible with the morning rain");
  }
  if (phases.includes("frontal-passage")) {
    parts.push("a strong front brings a sharp change");
  }
  if (phases.includes("post-frontal-cold") || trends.tempFalling) {
    parts.push("temperatures fall sharply later");
  }
  if (phases.includes("nw-snow") || snowSig.nwFlowSnow) {
    parts.push("scattered snow showers may follow behind the front");
  }

  let sentence;
  if (parts.length) {
    sentence = parts.join(", ");
  } else {
    sentence = mergePhrases(tempDesc, precipDesc, windDesc);
  }

  if (clothing && (drivers.includes("wind") || drivers.includes("temp-drop"))) {
    sentence = mergePhrases(sentence, clothing);
  }

  return sentence;
}

// ------------------------------------------------------------
// TOMORROW EVENT‑DAY HEADLINE (NEW)
// ------------------------------------------------------------
function buildTomorrowEventHeadline({ drivers, phases, trends }) {
  let emoji = "🌪️";
  let headline = "A very active day.";

  if (drivers.includes("front") && drivers.includes("temp-drop")) {
    emoji = "🌬️";
    headline = "Rain early, then sharply colder and windy.";
  } else if (drivers.includes("front")) {
    emoji = "🌬️";
    headline = "Front‑driven changes — stay weather‑aware.";
  } else if (drivers.includes("wind")) {
    emoji = "💨";
    headline = "Gusty at times — factor in the wind.";
  } else if (drivers.includes("snow")) {
    emoji = "❄️";
    headline = "Changeable day with snow in the mix.";
  }

  if (phases.includes("nw-snow")) {
    emoji = "❄️";
    headline = "Rain to snow — classic mountain setup.";
  }

  if (trends.tempFalling && !drivers.includes("front")) {
    emoji = "🌡️";
    headline = "Turning colder as the day goes on.";
  }

  return { emoji, headline };
}

// ------------------------------------------------------------
// TOMORROW BULLET ENGINE (Upgraded)
// ------------------------------------------------------------
function buildTomorrowBulletsUpgraded({
  win,
  tempStats,
  dewStats,
  windStats,
  precipTotal,
  snowTotal,
  clothing,
  analysis
}) {
  const bullets = [];
  const { phases, trends, snow: snowSig } = analysis;

  const maxT = tempStats.max;
  const minT = tempStats.min;
  const avgT = tempStats.avg;
  const maxGust = windStats.max ?? 0;
  const avgDew = dewStats.avg ?? null;

  const precipArr = win.precipitation || [];
  const snowArr = win.snowfall || [];

  // 🌡️ Temperature bullets
  if (maxT != null && minT != null) {
    if (maxT <= 40) bullets.push("Plan for a cold day overall.");
    else if (maxT <= 55) bullets.push("Plan for a cool day overall.");
    else if (maxT <= 72) bullets.push("Expect a mild afternoon.");
    else if (maxT <= 82) bullets.push("Expect a warm afternoon.");
    else bullets.push("Plan for a hot afternoon.");
  }

  if (trends.tempFalling) {
    bullets.push("Temperatures fall sharply later — a colder feel develops.");
  }

  // 💧 Humidity bullets
  if (avgDew != null) {
    if (avgDew >= 65) bullets.push("Humidity may feel noticeable at times.");
    else if (avgDew <= 25) bullets.push("Air stays dry and comfortable.");
  }

  // 💨 Wind bullets
  if (maxGust >= 35) bullets.push("Gusty at times — factor in wind for outdoor plans.");
  else if (maxGust >= 22) bullets.push("A bit breezy, especially in the afternoon.");

  // 🌧️ Rain timing — event‑day aware
  const rainTiming = findEventTiming(win, 0, (win.time || []).length - 1, (i, w) => (w.precipitation[i] ?? 0) > 0.02);

  if (precipTotal > 0.05 && rainTiming.firstHour !== null) {
    const phrase = timingPhrase(rainTiming, true);

    if (phases.includes("rain-early")) {
      bullets.push(`Rain moves through${phrase}.`);
    } else {
      bullets.push(`Rain most likely${phrase}.`);
    }
  } else if (precipTotal > 0.05) {
    bullets.push("Scattered showers possible at times.");
  }

  // ❄️ Snow bullets
  const snowTotalTomorrow = snowArr.length
    ? snowArr.reduce((a, b) => a + b, 0)
    : snowTotal;

  if (snowTotalTomorrow > 0.05 || snowSig.nwFlowSnow) {
    if (snowTotalTomorrow < 0.5) bullets.push("Light snow or flurries possible.");
    else if (snowTotalTomorrow < 2) bullets.push("Snow showers may create slick spots.");
    else bullets.push("Accumulating snow could slow travel at times.");
  }

  // 🏔️ Mountain microclimate
  if (maxGust >= 20 && maxT <= 55) {
    bullets.push("Cooler and breezier on higher ridges.");
  }

  // 👕 Clothing bullet
  if (clothing) bullets.push(clothing.charAt(0).toUpperCase() + clothing.slice(1) + ".");

  // De‑duplicate + cap at 3
  const unique = [...new Set(bullets)];
  return unique.slice(0, 3);
}
// ============================================================
// PART 4 — Comfort Module + Seasonal Context + Final Exports
// ============================================================

// ------------------------------------------------------------
// Comfort Category
// ------------------------------------------------------------
export function getComfortCategory(temp, dew) {
  if (temp == null) return "mild";

  if (temp <= 40) return "cold";
  if (temp <= 55) return "cool";
  if (temp <= 72) return "mild";
  if (temp <= 82) return "warm";
  return "hot";
}

// ------------------------------------------------------------
// Comfort Summary
// ------------------------------------------------------------
export function getComfortSummary(temp, dew) {
  const cat = getComfortCategory(temp, dew);

  switch (cat) {
    case "cold":
      return "Cold feel overall — bundle up.";
    case "cool":
      return "Cool and crisp — light layers feel good.";
    case "mild":
      return "Comfortably mild — easy to be outside.";
    case "warm":
      return "Warm feel — hydration helps.";
    case "hot":
      return "Hot and potentially muggy — take it easy.";
    default:
      return "Comfort details unavailable.";
  }
}

// ------------------------------------------------------------
// Seasonal Normals
// ------------------------------------------------------------
const NORMAL_HIGHS = {
  0: 47, 1: 51, 2: 59, 3: 68, 4: 75, 5: 82,
  6: 85, 7: 84, 8: 78, 9: 69, 10: 59, 11: 50
};

const NORMAL_LOWS = {
  0: 28, 1: 31, 2: 36, 3: 43, 4: 52, 5: 60,
  6: 64, 7: 63, 8: 57, 9: 46, 10: 37, 11: 31
};

// ------------------------------------------------------------
// Seasonal Context
// ------------------------------------------------------------
export function getSeasonalContext(tempHigh, tempLow) {
  const m = new Date().getMonth();
  const normalHigh = NORMAL_HIGHS[m];
  const normalLow = NORMAL_LOWS[m];

  let phrases = [];

  if (tempHigh != null) {
    if (tempHigh >= normalHigh + 10) phrases.push("warmer than normal");
    else if (tempHigh <= normalHigh - 10) phrases.push("colder than normal");
  }

  if (tempLow != null) {
    if (tempLow >= normalLow + 10) phrases.push("mild nights for the season");
    else if (tempLow <= normalLow - 10) phrases.push("chilly nights for the season");
  }

  if (!phrases.length) return "Typical for this time of year.";
  return phrases.join(", ") + ".";
}

// ------------------------------------------------------------
// Goldilocks Check (shared)
// ------------------------------------------------------------
function isGoldilocks(tempNow, tempHigh) {
  if (tempNow == null || tempHigh == null) return false;
  return (
    tempHigh >= 60 &&
    tempHigh <= 75 &&
    tempNow >= 55 &&
    tempNow <= 78
  );
}

// ------------------------------------------------------------
// Final Exports (already exported inline where needed)
// ------------------------------------------------------------
// getTodayActionOutlook
// getHumanActionOutlook
// getComfortCategory
// getComfortSummary
// getSeasonalContext

// Everything else is intentionally internal.
// ============================================================
