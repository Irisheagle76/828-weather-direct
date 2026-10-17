// Read-only replay of a captured API JSON payload. Does not publish forecasts.
// v1.6 mislabeled DWML knots as mph; opt in explicitly when replaying that data.
import { readFile } from 'node:fs/promises';
import { ENGINE_VERSION, scorePeriod } from '../lib/feelscore/summer-v1.6.js';

const input = process.argv[2];
if (!input || input.startsWith('--')) throw new Error('Usage: node scripts/replay-feelscore.mjs snapshot.json [--legacy-knots]');
const legacyKnots = process.argv.includes('--legacy-knots');
const data = JSON.parse(await readFile(input, 'utf8'));
if (legacyKnots && data.engine !== 'FEELSCORE Summer Comfort Engine v1.6') {
  throw new Error('Only original v1.6 DWML snapshots have the known mislabeled-knots defect');
}
const counts = (values) => Object.fromEntries([0, 1, 2, 3, 4, 5].map(c => [c, values.filter(v => v === c).length]));
const replay = (normalizeWind) => data.points.map(point => ({ ...point,
  ...scorePeriod(point.hours.map(hour => normalizeWind ? { ...hour,
    windMph: Number.isFinite(hour.windMph) ? hour.windMph * 1.150779448 : null,
    gustMph: Number.isFinite(hour.gustMph) ? hour.gustMph * 1.150779448 : null,
  } : hour)),
}));
const summarize = points => ({
  periodCategoryCounts: counts(points.map(p => p.finalCategory)),
  hourlyCategoryCounts: counts(points.flatMap(p => p.hours.map(h => h.category))),
  nashville: points.filter(p => p.lat === 36.25 && p.lon === -86.75).map(p => ({
    hourlyCategories: p.hours.map(h => h.category), finalCategory: p.finalCategory, aggregation: p.aggregation,
  }))[0],
});
const hiddenVetoHours = data.points.flatMap(p => p.hours).filter(h => h.category === 4
  && h.reasoning?.temperatureCeiling === 5 && h.reasoning?.dewPointCeiling === 5
  && h.reasoning?.windModifier === 0 && h.reasoning?.skyModifier === 0
  && h.reasoning?.precipCap === 5 && h.reasoning?.thunderCap === 5);
console.log(JSON.stringify({
  forecastDate: data.forecastDate, generatedAt: data.generatedAt, landPoints: data.points.length,
  originalEngine: data.engine, replayEngine: ENGINE_VERSION,
  originalCategory4HoursWithAllReportedCapsAllowing5: hiddenVetoHours.length,
  originalPrecipitationSourcesForThoseHours: [...new Set(hiddenVetoHours.map(h => h.precipProbabilitySource))],
  before: summarize(data.points),
  afterEligibilityFixOnly: summarize(replay(false)),
  ...(legacyKnots ? { afterIncludingWindUnitFix: summarize(replay(true)) } : {}),
  limitation: 'Reuses captured weather inputs; old payloads cannot distinguish missing weather from an observed empty weather record. Regeneration from DWML applies the new missing-weather guard.',
}, null, 2));
