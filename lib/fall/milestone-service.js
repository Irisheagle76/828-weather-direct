import { evaluateMilestones, fallSeasonYear, publicMilestoneArchive } from "./milestones.js";
import { loadFallMilestoneArchive, saveFallMilestoneArchive } from "./store.js";

export async function recordFallMilestones(observations, {
  now = Date.now(),
  loader = loadFallMilestoneArchive,
  saver = saveFallMilestoneArchive
} = {}) {
  const season = fallSeasonYear(now);
  if (!season) return { status: "skipped", reason: "outside-fall-season", season: null, newlyRecorded: [], archive: null };

  const existing = await loader(season);
  const result = evaluateMilestones(existing, observations, { now, season });
  const persisted = result.changed ? await saver(result.archive) : true;
  const response = {
    status: persisted ? "recorded" : "persistence-unavailable",
    season,
    eligibleObservations: result.eligibleObservations,
    newlyRecorded: result.newlyRecorded,
    archive: publicMilestoneArchive(result.archive)
  };
  console.info(JSON.stringify({
    event: "fall_milestone_evaluation",
    at: new Date(now).toISOString(),
    status: response.status,
    season,
    eligibleObservations: response.eligibleObservations,
    newlyRecorded: response.newlyRecorded.map((item) => ({ elevationBand: item.elevationBand, thresholdF: item.thresholdF, date: item.date }))
  }));
  return response;
}

export async function loadPublicFallMilestones(now = Date.now(), loader = loadFallMilestoneArchive) {
  const season = fallSeasonYear(now) || new Date(now).getFullYear();
  return publicMilestoneArchive(await loader(season));
}
