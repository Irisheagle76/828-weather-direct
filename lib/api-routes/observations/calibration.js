import { loadObservationShadowBatches } from "../../fall/store.js";
import { summarizeSamples } from "../../observations/shadow.js";

export default async function handler(req, res) {
  const requested = Math.max(1, Math.min(2016, Number(req.query?.limit) || 1008));
  const batches = await loadObservationShadowBatches(requested);
  const samples = batches.flatMap((batch) => Array.isArray(batch?.samples) ? batch.samples : []);
  const byStation = Object.values(samples.reduce((groups, sample) => {
    const group = groups[sample.stationId] ||= { stationId: sample.stationId, destinationId: sample.destinationId, terrainRole: sample.terrainRole, samples: [] };
    group.samples.push(sample);
    return groups;
  }, {})).map((group) => ({
    stationId: group.stationId,
    destinationId: group.destinationId,
    terrainRole: group.terrainRole,
    sampleCount: group.samples.length,
    nighttimeSamples: group.samples.filter((sample) => sample.localHour >= 20 || sample.localHour <= 8).length,
    regimes: countBy(group.samples, "weatherRegime"),
    summary: summarizeSamples(group.samples),
    recommendation: group.samples.length >= 100 && group.samples.filter((sample) => sample.localHour >= 20 || sample.localHour <= 8).length >= 25 ? "review-for-calibration" : "continue-collecting"
  }));
  res.setHeader("Cache-Control", "private, max-age=60");
  return res.status(200).json({
    status: batches.length ? "collecting" : "no-persistent-samples",
    persistence: process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN ? "kv" : "logs-only",
    batchCount: batches.length,
    sampleCount: samples.length,
    summary: summarizeSamples(samples),
    byStation
  });
}

function countBy(items, key) {
  return items.reduce((counts, item) => { const value = item[key] || "unknown"; counts[value] = (counts[value] || 0) + 1; return counts; }, {});
}
