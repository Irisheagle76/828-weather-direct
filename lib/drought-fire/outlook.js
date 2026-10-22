import { normalizeInputs } from './normalize.js';
import { labelFRI } from './labels.js';

const HOUR = 3600000;

// This is a weather outlook over the latest measured drought background,
// not an hourly soil-moisture forecast. Do not invent a daily drought cycle.
export function buildFireOutlook({ hourly = [], current, background, now = Date.now() }) {
  const initial = normalizeInputs({ ...background, ...current, timestamp: now });
  const points = [{ timestamp: now, DSS: initial.DSS, FRI: initial.FRI,
    rh: current.rh, windGust: current.windGust, tempF: current.tempF, observed: true }];
  const hours = [...new Map(hourly.filter(h => Number.isFinite(h?.timestamp) &&
    h.timestamp > now && h.timestamp <= now + 24 * HOUR).map(h => [h.timestamp, h])).values()]
    .sort((a, b) => a.timestamp - b.timestamp);
  let rain = Number.isFinite(current.rainTodayIn) ? current.rainTodayIn : 0;
  let lastTimestamp = now;
  // Stop at gaps: a missing hour must not silently become fair/dry weather.
  for (const hour of hours) {
    const { timestamp, temperatureF: tempF, relativeHumidity: rh, windGust } = hour;
    const amount = hour.precipAmount ?? hour.precipitation;
    if (timestamp - lastTimestamp > 90 * 60000 ||
      ![tempF, rh, windGust, amount].every(Number.isFinite) ||
      rh < 0 || rh > 100 || windGust < 0 || amount < 0) break;
    rain += amount;
    const score = normalizeInputs({ ...background, ...current, timestamp, tempF, rh, windGust,
      rainTodayIn: rain, rainRateInHr: amount });
    points.push({ timestamp, DSS: initial.DSS, FRI: score.FRI, rh, windGust, tempF, observed: false });
    lastTimestamp = timestamp;
  }
  const complete = lastTimestamp >= now + 23 * HOUR;
  const peak = points.reduce((best, point) => point.FRI > best.FRI ? point : best, points[0]);
  return {
    hours: 24, complete, points,
    autumnWeight: initial.components.autumnWeight,
    season: initial.components.season,
    peak: complete ? { ...peak, label: labelFRI(peak.FRI) } : null,
    minimumHumidity: points.length > 1 ? Math.min(...points.slice(1).map(p => p.rh)) : null,
    droughtBasis: 'Latest observed drought background held steady; fire responds to hourly weather.'
  };
}
