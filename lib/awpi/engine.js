export const VERSION = '1.1-experimental';
export const finite = value => typeof value === 'number' && Number.isFinite(value);
const clamp = value => Math.max(0, Math.min(1, value));
export const mean = values => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
export const label = value => !finite(value) ? 'Unavailable' : ['Very unfavorable', 'Unfavorable', 'Mixed', 'Favorable', 'Strongly favorable'][Math.min(4, Math.floor(value / 20))];
export const localDate = now => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);

// Fixed, auditable presentation heuristics. These are NOT calibrated probabilities.
export function scoreMember({ temperatureC, precipitationMm, snowOverlapCm }) {
  return {
    cold: finite(temperatureC) ? 100 * clamp((5 - temperatureC) / 10) : null,
    storm: finite(precipitationMm) ? 100 * clamp(precipitationMm / 10) : null,
    snow: finite(snowOverlapCm) ? 100 * clamp(snowOverlapCm / 2.54) : null,
  };
}

export function calculateDays(payload, now = new Date()) {
  const hourly = payload?.hourly;
  if (!hourly || payload.timezone !== 'America/New_York') throw new Error('Forecast time zone or hourly data missing');
  const units = payload.hourly_units || {};
  if (units.temperature_2m !== '°C' || units.precipitation !== 'mm' || units.snowfall !== 'cm') throw new Error('Unexpected forecast units');
  const times = hourly.time;
  if (!Array.isArray(times) || new Set(times).size !== times.length || times.some((t, i) => !/^\d{4}-\d{2}-\d{2}T\d{2}:00$/.test(t) || (i && t <= times[i - 1]))) throw new Error('Invalid forecast timestamps');
  const suffixes = Object.keys(hourly).filter(k => /^temperature_2m(?:_member\d+)?$/.test(k)).map(k => k.slice('temperature_2m'.length));
  const start = localDate(now);
  const groups = new Map();
  times.forEach((t, i) => { const day = t.slice(0, 10); if (day >= start) { if (!groups.has(day)) groups.set(day, []); groups.get(day).push(i); } });
  return Array.from({ length: 14 }, (_, index) => {
    const date = new Date(Date.parse(`${start}T12:00:00Z`) + index * 86400000).toISOString().slice(0, 10);
    const hours = groups.get(date) || [];
    const memberScores = [], temperatures = [], rain = [];
    for (const suffix of suffixes) {
      const t = hourly[`temperature_2m${suffix}`], p = hourly[`precipitation${suffix}`], s = hourly[`snowfall${suffix}`];
      // Full daily coverage is required; absent values never become zero.
      const valid = (a, lo, hi) => Array.isArray(a) && hours.length >= 23 && hours.length <= 25 && hours.every(i => finite(a[i]) && a[i] >= lo && a[i] <= hi);
      const temp = valid(t, -80, 60) ? mean(hours.map(i => t[i])) : null;
      const wet = valid(p, 0, 500) ? hours.reduce((sum, i) => sum + p[i], 0) : null;
      const snow = valid(s, 0, 100) && finite(temp) && finite(wet) ? hours.reduce((sum, i) => sum + (t[i] <= 2 && p[i] > 0 ? s[i] : 0), 0) : null;
      memberScores.push(scoreMember({ temperatureC: temp, precipitationMm: wet, snowOverlapCm: snow }));
      if (finite(temp)) temperatures.push(temp);
      if (finite(wet)) rain.push(wet);
    }
    const scores = {}, counts = {};
    for (const component of ['cold', 'storm', 'snow']) {
      const values = memberScores.map(s => s[component]).filter(finite);
      counts[component] = values.length;
      scores[component] = values.length >= Math.max(10, Math.ceil(suffixes.length * .8)) ? Math.round(mean(values)) : null;
    }
    const spreadC = temperatures.length ? Math.max(...temperatures) - Math.min(...temperatures) : null;
    return { date, leadDay: index + 1, ...scores, members: counts, meanTemperatureC: mean(temperatures), meanPrecipitationMm: mean(rain), spreadC,
      confidence: Object.values(scores).some(v => v === null) ? 'Unavailable' : index >= 5 || spreadC > 8 ? 'Low' : 'Moderate' };
  });
}

export function summarize(days) {
  return ['cold', 'storm', 'snow'].reduce((out, key) => {
    const valid = days.map(d => d[key]).filter(finite);
    out[key] = valid.length === days.length && valid.length ? Math.max(...valid) : null;
    return out;
  }, {});
}

export function narrative(days) {
  const valid = days.filter(d => finite(d.cold) && finite(d.storm) && finite(d.snow));
  if (!valid.length) return 'Current ensemble guidance is unavailable. No winter-pattern scores can be calculated.';
  const first = summarize(days.slice(0, 5)), last = summarize(days.slice(10));
  const cold = first.cold === null ? 'Near-term cold support is unavailable.' : `The first five days show ${label(first.cold).toLowerCase()} peak daily support for cold in the Asheville valley.`;
  const trend = first.cold !== null && last.cold !== null ? ` Cold support ${last.cold - first.cold > 10 ? 'increases' : last.cold - first.cold < -10 ? 'decreases' : 'changes little'} toward days 11–14, when confidence is low.` : '';
  const snow = Math.max(...valid.map(d => d.snow)) >= 20 ? ' Some ensemble members align cold air and modeled snowfall; timing and elevation remain uncertain.' : 'The ensemble currently offers little support for accumulating valley snow.';
  return `${cold}${trend} ${snow} Higher terrain can have different temperatures and precipitation types. These scores describe model support, not the probability of snow.`;
}

export function peakDetails(days) {
  const summary = summarize(days);
  return Object.fromEntries(['cold', 'storm', 'snow'].map(key => {
    const score = summary[key];
    const peaks = score > 0 ? days.filter(d => d[key] === score) : [];
    const runs = [];
    for (const day of days) {
      if (!finite(day[key]) || day[key] < 60) continue;
      const last = runs.at(-1);
      if (last && Date.parse(day.date) - Date.parse(last.end) === 86400000) { last.end = day.date; last.days++; }
      else runs.push({ start: day.date, end: day.date, days: 1 });
    }
    return [key, { score, dates: peaks.map(d => d.date), confidence: !peaks.length ? 'Unavailable' : peaks.every(d => d.confidence === 'Moderate') ? 'Moderate' : 'Low', favorableWindows: runs, favorableDays: runs.reduce((n, r) => n + r.days, 0) }];
  }));
}
export function peakWindows(days) {
  return [[0,5],[5,10],[10,14]].map(([a,b]) => ({ label: 'Days ' + (a+1) + '–' + b, ...summarize(days.slice(a,b)), peaks: peakDetails(days.slice(a,b)) }));
}
