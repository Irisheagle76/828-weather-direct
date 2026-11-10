import { VERSION, peakDetails, peakWindows, calculateDays, summarize, narrative, localDate, finite } from './engine.js';
import { collectSources } from './sources.js';
import { storage } from './store.js';
const MAX_AGE = 26 * 3600000;
const REFRESH_AGE = 3 * 3600000;
let pending;

export function present(snapshot, now = new Date(), refreshError = null) {
  if (!snapshot) return { version: VERSION, status: 'unavailable', generatedAt: null, days: [], summary: { cold: null, storm: null, snow: null }, narrative: 'Current forecast data are unavailable. Please check back later.', refreshError };
  const stale = now - new Date(snapshot.generatedAt) > MAX_AGE || localDate(now) !== snapshot.days?.[0]?.date;
  return { ...snapshot, ...(snapshot.days?.length === 14 ? { version: VERSION, summary: summarize(snapshot.days), peaks: peakDetails(snapshot.days), windows: peakWindows(snapshot.days), narrative: narrative(snapshot.days) } : {}), status: stale ? 'stale' : snapshot.status, stale, refreshError, checkedAt: now.toISOString() };
}

export async function buildAssessment({ now = new Date(), fetcher = fetch, store = storage } = {}) {
  let previous = null;
  try { previous = await store.get('latest'); } catch { /* Read failures must not prevent a new calculation. */ }
  const sources = await collectSources({ now, fetcher, cached: previous?.sources });
  let days;
  try {
    if (sources.ensemble.status !== 'ok') throw new Error(sources.ensemble.error || 'Forecast unavailable');
    days = calculateDays(sources.ensemble.data, now);
    if (!days.some(d => finite(d.cold) && finite(d.storm) && finite(d.snow))) throw new Error('No complete daily ensemble guidance');
  } catch (error) {
    return { ...present(previous, now, error.message), status: previous ? 'stale' : 'unavailable', stale: Boolean(previous), refreshAttemptAt: now.toISOString() };
  }
  // The public/storage payload contains daily aggregates, never the large hourly ensemble.
  sources.ensemble = { status: 'ok', url: sources.ensemble.url, retrievedAt: sources.ensemble.retrievedAt, model: 'NOAA GEFS via Open-Meteo', issueTime: null, issueTimeNote: 'Provider response does not expose model initialization time.', latitude: sources.ensemble.data.latitude, longitude: sources.ensemble.data.longitude, elevation: sources.ensemble.data.elevation };
  const trends = [];
  for (const lag of [1, 3, 7]) {
    const date = new Date(Date.parse(`${localDate(now)}T12:00:00Z`) - lag * 86400000).toISOString().slice(0, 10);
    let old;
    try { old = await store.get(`day:${date}`); } catch { old = null; }
    const matched = days.map(d => ({ current: d, old: old?.days?.find(p => p.date === d.date) })).filter(pair => pair.old);
    const delta = {};
    for (const key of ['cold', 'storm', 'snow']) {
      const pairs = matched.filter(p => finite(p.current[key]) && finite(p.old[key]));
      delta[key] = pairs.length >= 5 ? Math.round(pairs.reduce((sum, p) => sum + p.current[key] - p.old[key], 0) / pairs.length) : null;
    }
    trends.push({ lagDays: lag, overlapDays: matched.length, delta });
  }
  const summary = summarize(days);
  const result = {
    version: VERSION, generatedAt: now.toISOString(), status: days.every(d => finite(d.snow) && finite(d.cold) && finite(d.storm)) ? 'ready' : 'partial',
    experimental: true, days, summary, peaks: peakDetails(days), narrative: narrative(days), trends, sources,
    windows: peakWindows(days),
    ensoExpression: { score: null, status: 'Not assessed', reason: 'Jet-stream, circulation anomalies and atmospheric coupling have not been verified.' },
    stratosphere: { score: null, status: 'Not assessed', reason: 'Verified 10-hPa winds and downward-coupling diagnostics are not connected.' },
    limitations: ['Experimental forecast-guidance proxies, not calibrated probabilities or validated AWPI skill.', 'Cold uses absolute temperature; storm uses local precipitation, not diagnosed storm tracks.', 'One ensemble system; no independent model-agreement claim.', 'Forecast days are local calendar days, beginning today; today includes elapsed hours.', 'No measured stratospheric or ENSO-expression score is inferred from missing data.'],
    persistence: store.durable?.() ? 'durable' : 'memory-only',
  };
  try { await store.set('latest', result); await store.set(`day:${localDate(now)}`, result); } catch { result.persistence = 'failed'; }
  return present(result, now);
}

export async function getAssessment({ refresh = false, now = new Date(), fetcher = fetch, store = storage } = {}) {
  let cached;
  try { cached = await store.get('latest'); } catch { cached = null; }
  if (!refresh && cached && now - new Date(cached.generatedAt) < REFRESH_AGE && cached.days?.[0]?.date === localDate(now)) return present(cached, now);
  if (!pending) pending = buildAssessment({ now, fetcher, store }).finally(() => { pending = null; });
  return pending;
}
