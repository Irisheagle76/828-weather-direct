import { calculateComfort } from "./comfort.js";
import { comfortDateKey } from "./forecast-comfort-context.js";
export const COMFORT_WINDOWS = [
  { name: "Morning", label: "5–9 AM", start: 5, end: 9 },
  { name: "Early afternoon", label: "12–3 PM", start: 12, end: 15 },
  { name: "Evening", label: "5–8 PM", start: 17, end: 20 },
  { name: "Late night", label: "9 PM–midnight", start: 21, end: 24 }
];
const hourOfDay = t => Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", hourCycle: "h23" }).format(new Date(t)));
export function comfortTimeBuckets(hourly, date, now = Date.now()) {
  return COMFORT_WINDOWS.map(window => {
    const passed = date < comfortDateKey(now) || date === comfortDateKey(now) && hourOfDay(now) >= window.end;
    const points = hourly.filter(h => h.timestamp != null && Number.isFinite(Number(h.timestamp)) && comfortDateKey(Number(h.timestamp)) === date && hourOfDay(Number(h.timestamp)) >= window.start && hourOfDay(Number(h.timestamp)) < window.end && Number(h.timestamp) >= now).map(h => ({ hour: h, score: calculateComfort(h)?.score })).filter(p=>Number.isFinite(p.score)).sort((a,b)=>a.hour.timestamp-b.hour.timestamp);
    const scores = points.map(p=>Math.round(p.score*10));
    const temperatures = points.map(p=>p.hour.temperatureF).filter(Number.isFinite);
    const hot = temperatures.length && Math.max(...temperatures) >= 85;
    const takeaway = hot ? "Heat limits comfort during this window." : scores.length && Math.min(...scores) >= 70 ? "An easier stretch for outdoor plans." : scores.length && Math.max(...scores)-Math.min(...scores) >= 10 ? "Comfort changes noticeably within this window." : "Check the temperature and comfort range before heading out.";
    return { ...window, points, takeaway, passed, partial: date === comfortDateKey(now) && hourOfDay(now) >= window.start && !passed, count: scores.length, min: scores.length ? Math.min(...scores) : null, max: scores.length ? Math.max(...scores) : null, tempMin: temperatures.length ? Math.round(Math.min(...temperatures)) : null, tempMax: temperatures.length ? Math.round(Math.max(...temperatures)) : null };
  });
}

// Strongest sustained two-hour stretch within the requested windows, ranked by
// its lowest hourly score. No daily/bucket-average scoring and no gap bridging.
export function bestComfortWindow(buckets) {
  let best = null;
  for (const bucket of buckets) for (let i = 0; i < bucket.points.length - 1; i++) {
    const a = bucket.points[i], b = bucket.points[i+1];
    if (Number(b.hour.timestamp)-Number(a.hour.timestamp) !== 3600000) continue;
    const min = Math.round(Math.min(a.score,b.score)*10), max = Math.round(Math.max(a.score,b.score)*10);
    const candidate = { name: bucket.name, start: Number(a.hour.timestamp), end: Number(b.hour.timestamp)+3600000, min, max };
    if (!best || min > best.min || min === best.min && candidate.start < best.start) best = candidate;
  }
  return best;
}
