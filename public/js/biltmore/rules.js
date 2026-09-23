// Analysis thresholds are NOT local inundation thresholds or official warnings.
export const CONFIG = Object.freeze({ refreshMs: 300000, staleMs: 3600000, trendToleranceFt: 0.02, maxMatchMs: 1200000,
  // Display ranges only, NOT calibrated flood-risk thresholds.
  meters: { rainRateMaxInHr: 2, trendMaxFtHr: 1 },
  futureStation: { id: '828-biltmore', name: '828 Biltmore Tempest', provider: 'tempest', stationId: null } });
export function change(points, hours) {
  const end = points.at(-1); if (!end) return null;
  const target = end.t - hours * 3600000;
  const start = points.reduce((a,b) => Math.abs(b.t-target)<Math.abs(a.t-target)?b:a);
  if (Math.abs(start.t-target)>CONFIG.maxMatchMs || start.t===end.t) return null;
  return { value: end.v-start.v, rate: (end.v-start.v)/((end.t-start.t)/3600000) };
}
export function concern({stage, categories, stale, delta, officialWarning=false}) {
  if (officialWarning) return {level:'HIGH', text:'An official flood warning covers this point. Read the warning separately below.'};
  if (stale || !Number.isFinite(stage) || !Number.isFinite(categories?.minor)) return {level:'MONITOR', text:'Some readings are missing or out of date. We cannot reliably judge flood concern. Keep watching and check official updates.'};
  if (stage>=categories.minor) return {level:'FLOODING',text:'The river has reached NOAA’s flood-stage mark. This does not mean every nearby street is flooded.'};
  if (Number.isFinite(categories.action) && stage>=categories.action) return {level:'ELEVATED',text:'The river has reached NOAA’s mark for closer attention. Watch official updates and nearby conditions.'};
  if (!Number.isFinite(delta)) return {level:'MONITOR',text:'Recent river change is unavailable. Flood concern cannot be fully assessed.'};
  if (delta>CONFIG.trendToleranceFt) return {level:'MONITOR',text:'The river is rising. Keep watching. This early version cannot yet judge how rain or a faster rise may change flood concern.'};
  return {level:'LOW',text:'The river is below NOAA’s attention and flood-stage marks, with no significant rise measured in the past hour. Heavy rain can still flood nearby streets; local rainfall information is incomplete.'};
}
