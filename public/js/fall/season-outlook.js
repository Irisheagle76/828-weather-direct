import { visitorGuidance, visitorSummary } from "./visitor-guidance.js";
import { ELEVATION_BANDS } from "./config.js";
import { elevationBand, HOUR_MS, summarizeTemperatureHistory } from "./temperature-history.js";
import { analyzeFoliageConsequences, regionalConsequence } from "./foliage-consequences.js";

const dateLabel = (at) => new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "short", day: "numeric" }).format(new Date(at));

export function buildSeasonOutlook(payload, { now = Date.now() } = {}) {
  const history = payload.temperatureHistory || summarizeTemperatureHistory([], { now, anchors: payload.observations?.anchors || [] });
  const historyFresh = Date.parse(history.end) >= now - 2 * HOUR_MS && Date.parse(history.end) <= now + 5 * 60000;
  const year = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric" }).format(new Date(now)));
  const bands = payload.milestones?.season === year ? payload.milestones.bands || [] : [];
  const cards = (payload.destinations || []).map((site) => {
    const bandId = elevationBand(site);
    const observed = historyFresh ? history.bands?.find((band) => band.id === bandId) : null;
    const milestone = bands.find((band) => band.elevationBand === bandId);
    const first32 = validMilestone(milestone?.first32, now, year);
    const first28 = validMilestone(milestone?.first28, now, year);
    const exposed = Boolean(first32 || first28 || observed?.freezePeriods);
    const consequence = analyzeFoliageConsequences(site, { now, exposed, hardExposed: Boolean(first28 || observed?.hardFreezePeriods), observed, stale: payload.quality?.status === "stale" });
    const supportive = ["Color Enhancement", "Color Preservation", "Color Acceleration"].includes(consequence.primaryCategory);
    const observedText = observed?.samples ? `Available samples in the past 14 days: ${observed.freezePeriods} freezing periods, ${observed.hardFreezePeriods} reaching 28°F; lowest ${Math.round(observed.minimumF)}°F. ${observed.samples} samples from ${observed.stations.length} stations. Gaps may hide additional cold; these counts do not establish consecutive freezing nights or cold duration.` : "Retained temperature history unavailable; fresh station readings and seasonal milestones are used where available.";
    const event = first28 || first32;
    const milestoneText = event ? `First confirmed ${first28 ? "≤28°F" : "≤32°F"} since tracking began: ${dateLabel(event.firstObservedAt || `${event.date}T12:00:00Z`)}. A first crossing does not establish damage or freeze duration.` : "No confirmed seasonal freeze milestone in the available archive.";
    return {
      id: site.id, name: site.name, elevationFeet: site.elevationFeet,
      scope: ELEVATION_BANDS.find((band) => band.id === bandId)?.label || "Elevation unknown",
      label: consequence.label, pressure: !consequence.primaryCategory ? "neutral" : supportive ? "supportive" : "pressure",
      visitor: visitorGuidance(site, consequence, now),
      consequence, exposed, observedText, milestoneText,
      outlook: consequence.reasoning, guidance: consequence.visualResult
    };
  });
  const regional = regionalConsequence(cards);
  return {
    cards, regional,
    visitorSummary: visitorSummary(cards),
    headline: regional?.label || "Foliage Analysis Unavailable",
    summary: regional ? `Primary category: ${regional.primaryCategory}. Impact: ${regional.impactLevel}. Confidence: ${regional.confidence}. ${regional.reasoning}` : "Fresh forecast coverage is insufficient for a regional consequence assessment.",
    horizon: "Seven-day outlook uses available forecast hours only. Seasonal stage is estimated from a broad elevation calendar; drought stress is unknown. These are provisional foliage consequences, not confirmed canopy conditions."
  };
}

function validMilestone(event, now, year) {
  const at = Date.parse(event?.firstObservedAt || (event?.date ? `${event.date}T12:00:00Z` : ""));
  return Number.isFinite(at) && at <= now && new Date(at).getUTCFullYear() === year ? event : null;
}
