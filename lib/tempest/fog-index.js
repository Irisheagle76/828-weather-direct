// Experimental radiation-fog setup index. Scores are not calibrated probabilities.
const HOUR = 3_600_000;
const finite = Number.isFinite;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
export const FOG_STATIONS = [
  { stationId: '127602', name: 'Haw Creek' },
  { stationId: '144737', name: 'North Downtown (JCC)' }
];
export function fogBand(score) {
  return score <= 30 ? 'Low' : score <= 60 ? 'Moderate' : score <= 80 ? 'Elevated' : 'High';
}

export function fogHistory(current, history = []) {
  const rows = [...new Map(history.filter(s => finite(s?.timestamp) && s.timestamp <= current.timestamp)
    .map(s => [s.timestamp, s])).values()].sort((a, b) => a.timestamp - b.timestamp);
  function change(hours, field, direction) {
    const target = current.timestamp - hours * HOUR;
    const candidates = rows.filter(s => Math.abs(s.timestamp - target) <= 10 * 60_000 && finite(s[field]));
    const previous = candidates.sort((a, b) => Math.abs(a.timestamp - target) - Math.abs(b.timestamp - target))[0];
    return previous && finite(current[field]) ? direction * (current[field] - previous[field]) : null;
  }
  // Rain is the preceding minute's amount, not a midnight-reset daily total.
  const rainEnd = rows.at(-1)?.timestamp;
  const start = rainEnd - 24 * HOUR;
  const rain = rows.filter(s => s.timestamp > start);
  const complete = current.timestamp - rainEnd <= 120_000 && rain.length === 1440 && rain.every((s, i) =>
    s.reportIntervalMinutes === 1 && finite(s.precipAccum) && s.precipAccum >= 0 &&
    Math.abs(s.timestamp - (i ? rain[i - 1].timestamp : start) - 60_000) <= 1000) &&
    rain.at(-1)?.timestamp === rainEnd;
  return {
    cooling3hF: change(3, 'air_temperature', -1) === null ? null : change(3, 'air_temperature', -1) * 1.8,
    pressureRise6hHpa: change(6, 'station_pressure', 1),
    rain24hIn: complete ? rain.reduce((sum, s) => sum + s.precipAccum, 0) / 25.4 : null
  };
}

export function buildFogIndex(current, { history = [], cloudCover = null, now = Date.now() } = {}) {
  const s = current || {};
  if (!finite(s.timestamp) || now - s.timestamp > 10 * 60_000 || s.timestamp > now + 60_000)
    return { available: false, reason: 'Fresh station observations unavailable' };
  if (![s.air_temperature, s.dew_point, s.relative_humidity, s.wind_avg].every(finite) ||
      s.air_temperature < -60 || s.air_temperature > 60 || s.dew_point > s.air_temperature + 0.3 ||
      s.relative_humidity <= 0 || s.relative_humidity > 100 || s.wind_avg < 0 || s.wind_avg > 100)
    return { available: false, reason: 'Temperature, dew point, humidity or wind unavailable or invalid' };
  const gap = Math.max(0, (s.air_temperature - s.dew_point) * 1.8);
  const wind = s.wind_avg * 2.236936;
  const trends = fogHistory(s, history);
  const parts = [
    { name: 'Dew-point spread', weight: 40, value: gap, unit: '°F', points: 40 * clamp((5 - gap) / 4, 0, 1) },
    { name: 'Wind', weight: 20, value: wind, unit: 'mph', points: wind <= 2 ? 20 : wind <= 5 ? 10 : 0 },
    { name: 'Cooling over 3 hours', weight: 15, value: trends.cooling3hF, unit: '°F', points: trends.cooling3hF === null ? null : trends.cooling3hF > 8 ? 15 : trends.cooling3hF > 5 ? 9 : 0 },
    { name: 'Rain over 24 hours', weight: 10, value: trends.rain24hIn, unit: 'in', points: trends.rain24hIn === null ? null : trends.rain24hIn > 0.1 ? 10 : 0 },
    { name: 'Pressure rise over 6 hours', weight: 10, value: trends.pressureRise6hHpa, unit: 'hPa', points: trends.pressureRise6hHpa === null ? null : trends.pressureRise6hHpa >= 2 ? 10 : trends.pressureRise6hHpa > 0 ? 5 : 0 },
    { name: 'Cloud cover', weight: 5, value: cloudCover, unit: '%', points: finite(cloudCover) && cloudCover >= 0 && cloudCover <= 100 ? (cloudCover <= 20 ? 5 : cloudCover <= 50 ? 2.5 : cloudCover <= 80 ? 1.25 : 0) : null }
  ];
  const missing = parts.filter(p => p.points === null);
  const earned = parts.reduce((sum, p) => sum + (p.points ?? 0), 0);
  // Dry air or mixing cannot be overwhelmed by secondary bonuses.
  const cap = gap > 5 ? 30 : gap > 3 || wind > 6 ? 60 : 100;
  const low = Math.round(Math.min(cap, earned));
  const high = Math.round(Math.min(cap, earned + missing.reduce((sum, p) => sum + p.weight, 0)));
  return { available: true, version: 'wnc-fog-v1', observedAt: s.timestamp,
    low, high, band: fogBand(low) === fogBand(high) ? fogBand(low) : `${fogBand(low)}–${fogBand(high)}`,
    coverage: 100 - missing.reduce((sum, p) => sum + p.weight, 0), parts,
    humidity: s.relative_humidity, missing: missing.map(p => p.name) };
}
