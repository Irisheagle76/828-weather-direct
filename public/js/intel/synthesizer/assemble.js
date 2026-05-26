// ============================================================
// NARRATIVE ASSEMBLER — v11 (FULL CLEAN, NO LOSS)
// ============================================================

import { categories } from "./categories.js?v=20260526-natural-narrative";
import { temporal } from "./temporal.js";
import { phrases } from "./phrases.js?v=20260526-natural-narrative";
import { buildBullets } from "./bullets.js?v=20260526-natural-narrative";

// ------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------
const random = arr =>
  Array.isArray(arr) && arr.length
    ? arr[Math.floor(Math.random() * arr.length)]
    : "";

const maybe = (p = 0.5) => Math.random() < p;

// ------------------------------------------------------------
// CATEGORY TEMPLATE
// ------------------------------------------------------------
function getCategoryTemplate(category, isGoldilocks) {
  if (isGoldilocks) return categories.goldilocks;
  return categories[category] || categories.comfortable;
}

// ------------------------------------------------------------
// SAFE SIGNAL RESOLUTION (KEY FIX)
// supports BOTH signals + flat structure
// ------------------------------------------------------------
function getTemp(intel) {
  return (
    intel?.signals?.temp ??
    intel?.temperature ??
    intel?.temp ??
    70
  );
}

function getDewpoint(intel) {
  return (
    intel?.signals?.dewPoint ??
    intel?.dewpoint ??
    intel?.dewpointF ??
    55
  );
}

function getWind(intel) {
  return (
    intel?.signals?.wind ??
    intel?.signals?.windSpeed ??
    intel?.windSpeed ??
    0
  );
}

function getGust(intel) {
  return intel?.signals?.windGust ?? intel?.windGust ?? 0;
}

function getCloud(intel) {
  return (
    intel?.signals?.cloudCover ??
    intel?.cloudCover ??
    intel?.clouds ??
    50
  );
}

function getPrecipProbability(intel) {
  const value =
    intel?.precipProbability ??
    intel?.signals?.precipProbability ??
    0;

  return Number.isFinite(value) ? value : 0;
}

function getPrecipAmount(intel) {
  const value =
    intel?.precipAmount ??
    intel?.signals?.precipAmount ??
    0;

  return Number.isFinite(value) ? value : 0;
}

function getPrecipSignal(intel) {
  const pop = getPrecipProbability(intel);
  const qpf = getPrecipAmount(intel);

  if (pop >= 0.7 || qpf >= 0.25) return "high";
  if (pop >= 0.4 || qpf >= 0.05) return "moderate";
  if (pop >= 0.25 || qpf >= 0.02) return "low";
  return "none";
}

function buildPrecipVoice(intel, dayType) {
  const signal = getPrecipSignal(intel);
  if (signal === "none" || signal === "low") return null;

  const timing = intel?.precipTiming ?? intel?.signals?.precipTiming ?? null;
  const isTonight = dayType === "tonight";
  const timingPhrase =
    dayType === "tomorrow"
      ? "tomorrow"
      : timing?.starts || (isTonight ? "tonight" : "later today");

  const headlineTiming =
    dayType === "tomorrow"
      ? "tomorrow"
      : timingPhrase;

  const sentenceTiming =
    dayType === "tomorrow"
      ? "tomorrow"
      : isTonight
        ? (timingPhrase === "tonight" ? "as the night goes on" : timingPhrase)
        : `starting ${timingPhrase}`;

  const prefix =
    dayType === "tomorrow"
      ? "Tomorrow"
      : isTonight
        ? "Tonight"
        : "Today";

  if (signal === "high") {
    return {
      headline: `Rain moves in ${headlineTiming}`,
      narrative: isTonight
        ? `${prefix}, rain is likely to shape the remaining hours ${sentenceTiming}, even if temperatures still feel mild.`
        : `${prefix}, rain is likely to become one of the defining parts of the day ${sentenceTiming}, even if temperatures still feel mild.`,
      bullets: [
        `Rain likely ${timingPhrase}`,
        "Outdoor plans may need adjusting",
        "Comfort score is mild, but rain drives the day"
      ]
    };
  }

  if (signal === "moderate") {
    return {
      headline: "Rain chances return",
      narrative: `${prefix}, it is not necessarily a washout, but showers are likely enough ${sentenceTiming} to shape how ${isTonight ? "tonight" : "the day"} feels.`,
      bullets: [
        `Showers possible ${timingPhrase}`,
        "Keep rain in the plan",
        "Mild air, but not a fully dry setup"
      ]
    };
  }

  return {
    headline: "A few showers possible",
    narrative: `${prefix}, most of ${isTonight ? "the remaining hours" : "the day"} may still behave, but a few passing showers are possible ${sentenceTiming}.`,
    bullets: [
      `A few passing showers possible ${timingPhrase}`,
      "Most hours may still be usable",
      "Check radar before longer outdoor plans"
    ]
  };
}

// ------------------------------------------------------------
// PHRASE PICKERS
// ------------------------------------------------------------
function pickTempPhrase(intel) {
  const t = getTemp(intel);

  if (t <= 35) return random(phrases.temperature.cold);
  if (t <= 50) return random(phrases.temperature.cool);
  if (t <= 75) return random(phrases.temperature.neutral);
  if (t <= 88) return random(phrases.temperature.warm);
  return random(phrases.temperature.hot);
}

function pickMoisturePhrase(intel) {
  const dp = getDewpoint(intel);

  if (dp < 50) return random(phrases.moisture.dry);
  if (dp < 60) return random(phrases.moisture.neutral);
  if (dp < 67) return random(phrases.moisture.humid);
  return random(phrases.moisture.muggy);
}

function pickWindPhrase(intel) {
  const gust = getGust(intel);
  const wind = getWind(intel);

  if (gust >= 30) return random(phrases.wind.gusty);
  if (wind >= 15) return random(phrases.wind.windy);
  if (wind >= 7) return random(phrases.wind.breezy);
  return random(phrases.wind.calm);
}

function pickLightPhrase(intel) {
  const cloud = getCloud(intel);

  if (cloud > 80) return random(phrases.light.overcast);
  if (cloud < 30) return random(phrases.light.sunny);
  return random(phrases.light.filtered);
}

function describeComfortSetup(category, isGoldilocks, dayType) {
  const subject =
    dayType === "tomorrow"
      ? "Tomorrow"
      : dayType === "tonight"
        ? "Tonight"
        : "Today";

  if (isGoldilocks || category === "veryComfortable") {
    return `${subject} should be easy to enjoy outside`;
  }

  if (category === "comfortable") {
    return `${subject} should work well for most plans`;
  }

  if (category === "slightlyUncomfortable") {
    return `${subject} is still workable, but a few rough edges show up`;
  }

  if (category === "uncomfortable") {
    return `${subject} looks less comfortable for longer stretches outside`;
  }

  if (category === "harsh") {
    return `${subject} brings a tougher setup, so outdoor plans may need more care`;
  }

  return `${subject} looks manageable overall`;
}

function describeTemperature(intel) {
  const t = getTemp(intel);

  if (t <= 35) return "cold air hangs on";
  if (t <= 50) return "it starts cool";
  if (t <= 75) return "temperatures stay mild";
  if (t <= 88) return "it turns warmer by afternoon";
  return "heat builds through the afternoon";
}

function describeMoisture(intel) {
  const dp = getDewpoint(intel);

  if (dp < 50) return "the air stays dry";
  if (dp < 60) return "humidity stays manageable";
  if (dp < 67) return "humidity is a little more noticeable";
  return "the air feels muggy";
}

function describeWind(intel) {
  const gust = getGust(intel);
  const wind = getWind(intel);

  if (gust >= 30) return "gusts show up at times";
  if (wind >= 15) return "winds become noticeable";
  if (wind >= 7) return "a light breeze develops";
  return "winds stay light";
}

function describeSky(intel) {
  const cloud = getCloud(intel);

  if (cloud > 80) return "clouds dominate the sky";
  if (cloud < 30) return "sunshine does most of the work";
  return "sun mixes with passing clouds";
}

function joinClauses(clauses = []) {
  if (clauses.length === 1) return clauses[0];
  if (clauses.length === 2) return `${clauses[0]}, and ${clauses[1]}`;
  return `${clauses.slice(0, -1).join(", ")}, and ${clauses.at(-1)}`;
}

function sentenceCase(text = "") {
  const trimmed = text.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() + trimmed.slice(1) : "";
}

function softenTemporalIntro(frame, baseNarrative) {
  const base = (baseNarrative || "").trim();
  const lower = base.charAt(0).toLowerCase() + base.slice(1);
  const completeLead = /^(everything|things|most of|not much|comfort|weather|hard to|about as|one of)\b/i.test(base);
  const articleLead = /^[Aa]n?\s/.test(base);
  const conditionsLead = /conditions$/i.test(base);
  const direct = (prefix) => `${prefix}, ${lower}`;
  const looks = conditionsLead
    ? `has ${lower}`
    : completeLead
      ? lower
    : articleLead
      ? `looks like ${lower}`
      : `looks ${lower}`;
  const stays = conditionsLead
    ? `keeps ${lower}`
    : articleLead
      ? `holds as ${lower}`
      : `stays ${lower}`;
  const shaping = conditionsLead
    ? `is shaping up with ${lower}`
    : articleLead
      ? `is shaping up like ${lower}`
      : `is shaping up to be ${lower}`;

  if (/^For today/i.test(frame)) return completeLead ? direct("Today") : `Today ${looks}`;
  if (/^Today/i.test(frame)) return completeLead ? direct("Today") : `Today ${looks}`;
  if (/^Through today/i.test(frame)) return `Today ${stays}`;
  if (/^Later today/i.test(frame)) {
    if (conditionsLead) return `Later today, ${lower} continue`;
    return articleLead ? `Later today, it looks like ${lower}` : `Later today, it turns ${lower}`;
  }

  if (/^Tonight/i.test(frame)) return `Tonight ${looks}`;
  if (/^Through tonight/i.test(frame)) return `Tonight ${stays}`;
  if (/^For the rest of tonight/i.test(frame)) return `For the rest of tonight, ${lower}`;
  if (/^This evening/i.test(frame)) {
    if (conditionsLead) return `This evening, ${lower} continue`;
    return articleLead ? `This evening, it looks like ${lower}` : `This evening, it turns ${lower}`;
  }

  if (/^For tomorrow/i.test(frame)) return completeLead ? direct("Tomorrow") : `Tomorrow ${looks}`;
  if (/^Tomorrow/i.test(frame)) return completeLead ? direct("Tomorrow") : `Tomorrow ${looks}`;
  if (/^Heading into tomorrow/i.test(frame)) return `Tomorrow ${shaping}`;
  if (/^Looking ahead to tomorrow/i.test(frame)) return `Tomorrow ${shaping}`;

  return `${frame} ${lower}`;
}

function polishNarrative(text) {
  return text
    .replace(/\bToday looks everything\b/gi, "Today, everything")
    .replace(/\bTomorrow looks everything\b/gi, "Tomorrow, everything")
    .replace(/\blooks things\b/gi, "things")
    .replace(/\bnear-perfect days\b/gi, "really nice days")
    .replace(/\bone of those near-perfect days\b/gi, "one of those really nice days")
    .replace(/\bfeaturing temperatures\b/gi, "with temperatures")
    .replace(/\bfeaturing a\b/gi, "with a")
    .replace(/\bfeaturing humidity\b/gi, "with humidity")
    .replace(/\bfeaturing\b/gi, "with")
    .replace(/\bcomfortable temperature range\b/gi, "pleasant temperature range")
    .replace(/\btemperatures staying in a nice range\b/gi, "temperatures staying in a pleasant range")
    .replace(/\btemperatures holding in a nice range\b/gi, "temperatures holding in a pleasant range")
    .replace(/\bcomfortable and humidity\b/gi, "comfortable, with humidity")
    .replace(/\btemperatures staying easy to work with\b/gi, "temperatures staying easy")
    .replace(/\blow humidity keeping things light\b/gi, "low humidity helping out")
    .replace(/\bwind staying out of the story\b/gi, "wind staying pretty quiet")
    .replace(/\bwith a few small changes, with\b/gi, "with a few small changes and")
    .replace(/\bwith a little movement, with\b/gi, "with a little movement and")
    .replace(/\s+,/g, ",")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// ------------------------------------------------------------
// EMOJI (UNCHANGED — STILL VALID)
// ------------------------------------------------------------
function buildEmoji(intel) {
  switch (intel?.dominantFactor) {
    case "rain": return "🌧️";
    case "snow": return "❄️";
    case "wind": return "💨";
    case "heat": return "🥵";
    case "cold": return "🥶";
    case "muggy": return "😓";
    case "fog": return "🌫️";
    case "sun": return "😎";
    default: return "😐";
  }
}

// ------------------------------------------------------------
// CLEAN NARRATIVE BUILDER
// ------------------------------------------------------------
function buildNarrative(intel, dayType, category, isGoldilocks) {
  const safeIntel = intel ?? {};
  const precipVoice = buildPrecipVoice(safeIntel, dayType);

  if (precipVoice) {
    return {
      narrative: precipVoice.narrative,
      temporal: dayType === "tomorrow" ? "Tomorrow," : "Today,",
      precipVoice
    };
  }

  const temporalFrame = temporal.choose(dayType, isGoldilocks);
  const setup = describeComfortSetup(category, isGoldilocks, dayType);
  const details = [
    describeTemperature(safeIntel),
    describeWind(safeIntel),
    describeMoisture(safeIntel),
    describeSky(safeIntel)
  ].filter(Boolean);

  return {
    narrative: polishNarrative(`${setup}. ${sentenceCase(joinClauses(details))}.`),
    temporal: temporalFrame
  };

  const base = getCategoryTemplate(category, isGoldilocks);

  const score = safeIntel?.score ?? 75;

  // ------------------------------------------------------------
  // CATEGORY FIRST (PRIMARY VOICE)
  // ------------------------------------------------------------
  const categoryBase = random(base.headlines)

  // ------------------------------------------------------------
  // SCORE (LIGHT INFLUENCE — NOT OVERRIDING)
  // ------------------------------------------------------------
  const scoreTone = random(getScoreTone(score));

const baseNarrative =
  score >= 90 && maybe(0.3) && !categoryBase.includes("good")
    ? scoreTone
    : categoryBase;

  const periodNarrative = dayType === "tonight"
    ? baseNarrative
        .replace(/\bday\b/gi, "night")
        .replace(/\bbe outside\b/gi, "be out")
    : baseNarrative;

  const intro = softenTemporalIntro(temporalFrame, periodNarrative);

// ------------------------------------------------------------
// CORE SIGNALS
// ------------------------------------------------------------
let temp = pickTempPhrase(safeIntel);

// Reduce repetition (comfortable → mild)
if (/comfortable/i.test(temp) && /comfortable/i.test(categoryBase)) {
  temp = temp.replace(/comfortable/i, "mild");
}

const moisture = pickMoisturePhrase(safeIntel);
const wind = pickWindPhrase(safeIntel);
const light = pickLightPhrase(safeIntel);

// Prioritize top 2 core signals
const core = [temp, moisture, wind].filter(Boolean).slice(0, 2);

let narrative = intro;

// ------------------------------------------------------------
// CORE PHRASE JOINER
// ------------------------------------------------------------
const joinPhrases = (arr) => {
  if (arr.length === 1) return arr[0];
  if (arr.length === 2) return `${arr[0]} and ${arr[1]}`;
  return `${arr.slice(0, -1).join(", ")}, and ${arr[arr.length - 1]}`;
};

// ------------------------------------------------------------
// CONNECTOR VARIATION
// ------------------------------------------------------------
if (core.length) {
  const connectors = ["with"];
  const connector = random(connectors);

  // Fix awkward phrasing like "bringing temperatures holding..."
const cleanedCore = core.map(p =>
  p.replace(/^temperatures\s+holding/i, "temperatures staying")
);

  narrative += `, ${connector} ${joinPhrases(cleanedCore)}`;
}
// ------------------------------------------------------------
// LIGHT / SKY ADDITION
// ------------------------------------------------------------
if (light && maybe(0.5)) {
 const lightJoiners = ["plus", "along with"];
  const joiner = random(lightJoiners);

  narrative += core.length
    ? `, ${joiner} ${light}`
    : `, ${light}`;
}
// ------------------------------------------------------------
// FINAL CLEANUP (ANTI-REPETITION)
// ------------------------------------------------------------
if (/comfortable/i.test(narrative)) {
  narrative = narrative.replace(
    /comfortable feel to the air/i,
    "a clean feel to the air"
  );
}

narrative = polishNarrative(narrative);
// ------------------------------------------------------------
// FINALIZE
// ------------------------------------------------------------
narrative += ".";

return {
  narrative: narrative.trim(),
  temporal: temporalFrame
};
}

// ------------------------------------------------------------
// MASTER
// ------------------------------------------------------------
export const assemble = {

  assemble(intel, dayType, category, isGoldilocks) {

    const narrativeObj = buildNarrative(
      intel,
      dayType,
      category,
      isGoldilocks
    );

    const lowPrecipBullets =
      dayType === "tomorrow" && getPrecipSignal(intel) === "low"
        ? ["A few passing showers possible"]
        : [];

    const lowPrecipNarrative =
      lowPrecipBullets.length && !narrativeObj.precipVoice
        ? `${narrativeObj.narrative.replace(/\.$/, "")}. A few passing showers are possible.`
        : narrativeObj.narrative;

    const comfortBullets = buildBullets(intel).filter(b =>
      !lowPrecipBullets.length || !/plenty of sunshine/i.test(b)
    );

    return {
      emoji: buildEmoji(intel),
      headline: narrativeObj.precipVoice?.headline ?? null,

      narrative: lowPrecipNarrative,
      longNarrative: lowPrecipNarrative,

      bullets:
        narrativeObj.precipVoice?.bullets ??
        [...lowPrecipBullets, ...comfortBullets].slice(0, 3),

      category,
      goldilocks: isGoldilocks,
      version: "11.0",

      temporal: narrativeObj.temporal
    };
  }
};

// ------------------------------------------------------------
// SCORE TONE (KEPT — BUT USED LIGHTLY)
// ------------------------------------------------------------
function getScoreTone(score = 75) {
  if (score >= 92) {
    return ["about as good as it gets", "a near-perfect day", "hard to beat"];
  }
  if (score >= 85) {
    return ["a really nice day", "easy to be outside"];
  }
  if (score >= 75) {
    return ["a pretty comfortable day", "generally comfortable"];
  }
  if (score >= 65) {
    return ["a few small quirks show up", "some ups and downs"];
  }
  if (score >= 55) {
    return ["a bit uneven at times", "comfort dips here and there"];
  }
  if (score >= 40) {
    return ["a tougher setup overall", "noticeable discomfort"];
  }
  return ["a rough day overall", "conditions are hard to ignore"];
}
