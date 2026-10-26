import { coldPeriod, HOUR_MS, localHour } from "./temperature-history.js";

const DAY = 24 * HOUR_MS;
const EARLY = new Set(["early change", "developing color", "near peak"]);
const MATURE = new Set(["near peak", "peak", "post-peak"]);
export const CONSEQUENCES = Object.freeze({
  "Color Enhancement": ["Color Development Accelerating", "Color Development Favored"],
  "Color Preservation": ["Peak Color Holding Strong", "Color Retention Favored"],
  "Color Acceleration": ["Rapid Color Progression Underway", "Color Progression Accelerating"],
  "Color Arrest": ["Color Progression Halted", "Color Progression At Risk"],
  "Color Degradation": ["Freeze Damage Diminishing Color Quality", "Color Quality At Risk"],
  "Premature Leaf Drop": ["Accelerated Leaf Fall Expected", "Leaf Drop Accelerating"],
  "Patchy Elevation Impacts": ["Elevation-Dependent Foliage Impacts", "Uneven Elevation Impacts"],
  "Foliage Reset Event": ["Regional Foliage Outlook Downgraded", "Foliage Outlook Downgraded"],
  "Season Shutdown": ["Foliage Season Ending", "Season Ending Risk"]
});

// Broad seasonal reference only. Never extrapolate the Boone peak regression to Asheville.
// NPS: above 4,000 ft early/mid October; lower elevations mid October/early November.
export function estimateFoliageStage(site, now) {
  if (!Number.isFinite(site.elevationFeet)) return { value: "unknown", confidence: "Low", basis: "Elevation unavailable; foliage stage unknown." };
  const year = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric" }).format(new Date(now)));
  const high = site.elevationFeet >= 4000;
  const start = Date.UTC(year, 9, high ? 1 : 15);
  const end = high ? Date.UTC(year, 9, 16) : Date.UTC(year, 10, 8);
  const value = now < start - 14 * DAY ? "early change" : now < start ? "developing color" : now < end ? "near peak" : "post-peak";
  return { value, confidence: "Low", basis: `Estimated seasonal stage: ${value}. Broad ${high ? "high-elevation" : "lower-elevation"} NPS timing reference, not an observed canopy assessment; species and this year's timing may differ.` };
}

export function analyzeFoliageConsequences(site, { now = Date.now(), exposed = false, hardExposed = false, observed = null, stale = false } = {}) {
  const unique = new Map();
  if (!stale && site.dataQuality?.freshness !== "stale") for (const h of site.hourly || []) {
    if (Number.isFinite(h.timestamp) && h.timestamp >= now && h.timestamp < now + 7 * DAY) unique.set(h.timestamp, h);
  }
  const hours = [...unique.values()].sort((a, b) => a.timestamp - b.timestamp);
  const temps = hours.filter((h) => Number.isFinite(h.temperatureF));
  let stage = estimateFoliageStage(site, now);
  const drought = null; // No connected drought/soil-moisture measurements in the Fall payload.
  const periods = new Map();
  for (const h of temps.filter((h) => localHour(h.timestamp) >= 20 || localHour(h.timestamp) < 8)) {
    const key = coldPeriod(h.timestamp);
    periods.set(key, [...(periods.get(key) || []), h]);
  }
  const nights = [...periods].map(([key, values]) => ({ key, minimum: Math.min(...values.map((h) => h.temperatureF)), samples: values.length }));
  const freezeNights = consecutiveNights(nights.filter((night) => night.minimum <= 32));
  const coolNights = consecutiveNights(nights.filter((night) => night.samples >= 8 && night.minimum > 32 && night.minimum <= 45));
  const hardRun = longestRun(temps.filter((h) => h.temperatureF <= 28));
  const severeRun = longestRun(temps.filter((h) => h.temperatureF <= 20));
  if (hardRun >= 4) {
    const eventAt = temps.find((h) => h.temperatureF <= 28).timestamp;
    stage = estimateFoliageStage(site, eventAt);
    stage = { ...stage, basis: `Stage at the forecast cold event: ${stage.basis}` };
  }
  const minimumF = temps.length ? Math.min(...temps.map((h) => h.temperatureF)) : null;
  const hardStart = temps.find((h) => h.temperatureF <= 32)?.timestamp;
  const gusts = hours.filter((h) => Number.isFinite(h.windGust));
  const peakGust = gusts.length ? Math.max(...gusts.map((h) => h.windGust)) : null;
  const afterColdGusts = gusts.filter((h) => Number.isFinite(hardStart) && h.timestamp >= hardStart && h.timestamp < hardStart + 48 * HOUR_MS);
  const afterColdGust = afterColdGusts.length ? Math.max(...afterColdGusts.map((h) => h.windGust)) : null;
  const beforeColdGusts = gusts.filter((h) => Number.isFinite(hardStart) && h.timestamp < hardStart && h.timestamp >= hardStart - 24 * HOUR_MS);
  const beforeColdGust = beforeColdGusts.length ? Math.max(...beforeColdGusts.map((h) => h.windGust)) : null;
  const rainHours = hours.filter((h) => Number.isFinite(h.precipitation ?? h.precipAmount));
  const rainIn = rainHours.reduce((sum, h) => sum + Math.max(0, h.precipitation ?? h.precipAmount), 0);
  const wetRun = longestRun(rainHours.filter((h) => (h.precipitation ?? h.precipAmount) >= 0.01));
  const daylight = hours.filter((h) => localHour(h.timestamp) >= 9 && localHour(h.timestamp) <= 17 && Number.isFinite(h.cloudCover));
  const sunshine = daylight.length >= 12 ? daylight.filter((h) => h.cloudCover <= 0.4).length / daylight.length : null;
  const preSun = daylight.filter((h) => Number.isFinite(hardStart) && h.timestamp < hardStart);
  const postSun = daylight.filter((h) => Number.isFinite(hardStart) && h.timestamp >= hardStart);
  const skyMean = (values) => values.length ? Math.round(100 * values.reduce((sum, h) => sum + h.cloudCover, 0) / values.length) : null;
  const firstDay = temps.filter((h) => h.timestamp < now + DAY);
  const secondDay = temps.filter((h) => h.timestamp >= now + DAY && h.timestamp < now + 2 * DAY);
  const mean = (values) => values.reduce((sum, h) => sum + h.temperatureF, 0) / values.length;
  const coolingF = firstDay.length >= 18 && secondDay.length >= 18 ? mean(firstDay) - mean(secondDay) : null;
  const early = EARLY.has(stage.value), mature = MATURE.has(stage.value);
  const retentionThreat = (peakGust >= 30 && (mature || hardExposed)) ||
    (rainIn >= 0.75 && wetRun >= 4 && (mature || peakGust >= 25)) || (afterColdGust >= 25 && hardRun >= 3);
  const majorEvent = severeRun >= 8 && peakGust >= 40;
  let category = null, impactLevel = "Minimal", reasoning, visualResult, beneficiaries;
  if (temps.length < 48) {
    reasoning = "Insufficient fresh forecast coverage for a foliage consequence assessment.";
    visualResult = "No landscape change can be inferred reliably from the available data.";
  } else if (majorEvent && stage.value === "post-peak" && severeRun >= 12 && freezeNights >= 3) {
    category = "Season Shutdown"; impactLevel = "Extreme";
    reasoning = "A prolonged severe freeze, repeated freezing nights and strong winds overlap the estimated post-peak stage. The combined event threatens the remaining display; shutdown is a forecast risk, not an observed end to all regional color.";
    visualResult = "Rapid canopy thinning and little further color development are possible, with sheltered pockets potentially retaining leaves.";
  } else if (majorEvent) {
    category = "Foliage Reset Event"; impactLevel = "Major";
    reasoning = "Prolonged severe cold coincides with damaging wind potential, threatening both leaf tissue and retention.";
    visualResult = "A substantial reduction in color quality and canopy fullness is possible; the extent is unconfirmed.";
  } else if (retentionThreat) {
    category = "Premature Leaf Drop"; impactLevel = hardRun >= 3 && afterColdGust >= 30 ? "Major" : "Moderate";
    reasoning = "Wind or persistent rain acts on seasonally mature or cold-stressed foliage; weather sequence favors leaf loss over further color development.";
    visualResult = "Thinner canopies and a shorter viewing window are favored, especially on exposed slopes.";
  } else if (hardRun >= 4 && early) {
    category = "Color Arrest"; impactLevel = "Moderate";
    reasoning = "Several consecutive forecast hours of colder freezing overlap an estimated active-coloring stage, putting remaining green leaves at risk before full coloration.";
    visualResult = "Some foliage may stop developing rich color, leaving a less complete display.";
  } else if (hardRun >= 4 || freezeNights >= 3 && minimumF <= 28) {
    category = "Color Degradation"; impactLevel = "Moderate";
    reasoning = "Sustained or repeated colder freezing raises tissue-damage concerns beyond a brief light freeze.";
    visualResult = "Duller color, browning margins and uneven patches are possible; damage is forecast, not verified.";
  } else if (early && hardRun === 0 && (coolingF >= 10 && coolNights >= 2 || freezeNights >= 2 && minimumF > 28)) {
    category = "Color Acceleration"; impactLevel = "Moderate";
    reasoning = "A sharper cool-down or repeated light freezing overlaps an estimated developing stage without a sustained colder freeze or a stronger retention threat.";
    visualResult = "Faster progression toward fuller color is favored, potentially compressing the viewing window.";
  } else if (mature && hardRun === 0) {
    category = "Color Preservation"; impactLevel = "Minor";
    reasoning = "Relatively gentle weather overlaps an estimated established or later-season display; retention is favored over abrupt deterioration.";
    visualResult = "Remaining colorful leaves are more likely to persist; this does not establish that peak color is present.";
  } else if (coolNights >= 2 && sunshine >= 0.5 && !hardExposed && hardRun === 0) {
    category = "Color Enhancement"; impactLevel = "Minor";
    reasoning = "Cool nonfreezing nights and available sunshine favor pigment development during the estimated developing stage; moisture health remains unknown.";
    visualResult = "Stronger color development is favored where leaves remain healthy; brighter colors are not guaranteed.";
  } else {
    // A provisional least-change hypothesis, explicitly low confidence, avoids a forced damage claim.
    category = early ? "Color Enhancement" : "Color Preservation";
    reasoning = "No combined signal strongly favors abrupt color damage or leaf loss. Gradual development or retention is the provisional expectation.";
    visualResult = early ? "Gradual seasonal coloring remains possible; a stronger brightness signal is absent." : "Remaining color may persist, with local differences unresolved.";
  }
  beneficiaries = ["Color Enhancement", "Color Acceleration"].includes(category) ? "Leaf peepers, photographers and scenic drivers may benefit from developing color; hikers should compare elevations." :
    category === "Color Preservation" ? "Hikers, scenic drivers, photographers and leaf peepers may benefit from a steadier viewing window." :
    category ? "Leaf peepers and canopy photographers face a shorter or less vivid display; hikers and scenic drivers should favor sheltered alternatives." : "All visitors should await a fuller forecast before relying on this assessment.";
  const through = temps.at(-1)?.timestamp || null;
  const outlook7Days = through ? `Available forecast through ${new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "short", day: "numeric" }).format(new Date(through))}: ${visualResult} ${through < now + 6 * DAY ? "Days beyond that horizon are unavailable; the seven-day outlook is incomplete." : "This remains a weather-based outlook, not a canopy observation."}` : "Seven-day outlook unavailable.";
  const unit = (value, suffix) => value == null ? "unavailable" : `${Math.round(value)}${suffix}`;
  const sunText = sunshine == null ? "Sunlight coverage unavailable." : `${Math.round(sunshine * 100)}% of sampled daylight hours have cloud cover at or below 40%.`;
  const sequenceText = hardStart == null ? "No forecast freezing sequence." : `Gusts before/after freezing: ${unit(beforeColdGust, " mph")} / ${unit(afterColdGust, " mph")}; cloud cover ${unit(skyMean(preSun), "%")} / ${unit(skyMean(postSun), "%")}.`;
  return {
    primaryCategory: category, impactLevel, confidence: "Low", // seasonal stage and drought are inferred/missing
    headline: category === "Color Preservation" && stage.value !== "peak" ? "Remaining Color Retention Favored" :
      category === "Color Arrest" ? "Color Progression May Stall" : category === "Color Degradation" ? "Color Quality At Risk" :
      category === "Season Shutdown" ? "Foliage Season Ending Risk" : category ? CONSEQUENCES[category][0] : "Foliage Analysis Unavailable",
    label: category ? CONSEQUENCES[category][1] : "Foliage Analysis Unavailable",
    reasoning, visualResult, beneficiaries, outlook7Days, stage,
    missingInputs: ["Current canopy stage is estimated, not observed.", "Drought and soil-moisture stress are unavailable.", ...(gusts.length < temps.length * 0.75 ? ["Wind coverage is incomplete."] : []), ...(rainHours.length < temps.length * 0.75 ? ["Rainfall coverage is incomplete."] : []), ...(sunshine == null ? ["Sunlight context is unavailable."] : []), ...(through && through < now + 6 * DAY ? ["Full seven-day forecast unavailable."] : [])],
    diagnostics: { minimumF, freezeNights, hardRun, severeRun, coolingF, coolNights, peakGust, beforeColdGust, afterColdGust, rainIn, wetRun, sunshine, cloudBeforePct: skyMean(preSun), cloudAfterPct: skyMean(postSun), drought, hours: temps.length, through, exposed, hardExposed, sampledFreezePeriods: observed?.freezePeriods ?? null },
    weatherSummary: `${minimumF == null ? "Minimum unavailable" : `Forecast minimum ${Math.round(minimumF)}°F`}; ${freezeNights} consecutive sampled freezing nights; longest colder-freeze run ${hardRun} consecutive forecast hours. Gusts ${peakGust == null ? "unavailable" : `up to ${Math.round(peakGust)} mph`}; rain ${rainHours.length ? `${rainIn.toFixed(2)} in; longest wet spell ${wetRun} hours` : "unavailable"}. ${sunText} ${sequenceText}`
  };
}

function longestRun(hours) {
  let longest = 0, run = 0, previous = null;
  for (const h of hours) { run = previous != null && h.timestamp - previous === HOUR_MS ? run + 1 : 1; longest = Math.max(longest, run); previous = h.timestamp; }
  return longest;
}
function consecutiveNights(nights) {
  let longest = 0, run = 0, previous = null;
  for (const night of nights.sort((a, b) => a.key.localeCompare(b.key))) {
    const date = Date.parse(`${night.key}T12:00:00Z`);
    run = previous != null && date - previous === DAY ? run + 1 : 1;
    longest = Math.max(longest, run); previous = date;
  }
  return longest;
}

export function regionalConsequence(cards) {
  const usable = cards.filter((card) => card.consequence.primaryCategory);
  if (!usable.length) return null;
  const reset = usable.filter((card) => ["Foliage Reset Event", "Season Shutdown"].includes(card.consequence.primaryCategory));
  if (usable.length >= 3 && reset.length >= Math.ceil(usable.length * 0.75) && new Set(reset.map((card) => card.scope)).size >= 2)
    return { primaryCategory: reset.every((card) => card.consequence.primaryCategory === "Season Shutdown") ? "Season Shutdown" : "Foliage Reset Event", label: reset.every((card) => card.consequence.primaryCategory === "Season Shutdown") ? "Season Ending Risk" : "Foliage Outlook Downgraded", confidence: "Low", impactLevel: "Major", reasoning: "A compound severe-weather signal affects most available destinations across multiple elevation bands. This is a forecast risk, not verified widespread canopy loss." };
  const contrasting = usable.some((a) => usable.some((b) => a.consequence.primaryCategory !== b.consequence.primaryCategory &&
    a.scope !== b.scope && Math.abs(a.elevationFeet - b.elevationFeet) >= 1000 &&
    (a.exposed !== b.exposed || Math.abs(a.consequence.diagnostics.minimumF - b.consequence.diagnostics.minimumF) >= 5)));
  if (contrasting) return { primaryCategory: "Patchy Elevation Impacts", label: "Uneven Elevation Impacts", confidence: "Low", impactLevel: "Moderate", reasoning: "Different elevation bands show different likely foliage consequences alongside a measured or forecast weather contrast." };
  const priority = ["Season Shutdown", "Foliage Reset Event", "Premature Leaf Drop", "Color Arrest", "Color Degradation", "Color Acceleration", "Color Preservation", "Color Enhancement"];
  const selected = usable.slice().sort((a, b) => priority.indexOf(a.consequence.primaryCategory) - priority.indexOf(b.consequence.primaryCategory))[0].consequence;
  return { ...selected, label: ["Foliage Reset Event", "Season Shutdown"].includes(selected.primaryCategory) ? "Localized Foliage Damage Risk" : selected.label, reasoning: `${selected.reasoning} This is the leading concern among available destinations, not proof of a uniform regional effect.` };
}
