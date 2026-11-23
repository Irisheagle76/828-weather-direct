import { hikingReportState } from "../mobile/hiking-data.js";
export function cleanHikingText(value = "") { return String(value || "").replace(/degF/g, "°F").replace(/\s+/g, " ").trim(); }
export function homeHikingScore(g = {}) { return Number.isFinite(g.hikerScore) ? g.hikerScore : null; }
export function homeHikingHeadline(g = {}) { return cleanHikingText(g.overall || "Current trail assessment unavailable"); }
export function homeHikingSummary(g = {}) { return cleanHikingText(g.hikerNarrative || "Current trail observations are unavailable."); }
export function homeHikingBestBet(g = {}) { return cleanHikingText(g.bestWindow || "Check current observations and mountain views before choosing a route."); }
export function homeHikingUseCare(g = {}) { return cleanHikingText(g.routeWarnings?.join(" ") || "Check conditions along your route; station observations do not measure trail footing."); }
export function homeHikingPresentation(payload = {}, now = Date.now()) {
  const report = hikingReportState(payload, now);
  const g = report.stale ? {} : payload.guidance || {};
  const drop = g.mitchellDrop;
  return {
    score: report.score,
    headline: homeHikingHeadline(g),
    summary: report.stale ? "Trail observations are missing or out of date. Check current conditions before heading out." : homeHikingSummary(g),
    bestBet: homeHikingBestBet(g), useCare: homeHikingUseCare(g),
    mitchellDrop: Number.isFinite(drop) ? Math.abs(Math.round(drop)) + "° " + (drop < 0 ? "warmer" : "cooler") : "--"
  };
}
