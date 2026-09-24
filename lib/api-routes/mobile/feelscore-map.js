export const FOCUS = { west: -84.8, east: -81.3, south: 33.8, north: 36.8 };
const cache = new Map();
const pending = new Map();
let borders;
export function focusedDataset(data, boundaries) {
  return { forecastDate: data.forecastDate, generatedAt: data.generatedAt, bbox: data.bbox, focus: FOCUS,
    spacingDegrees: data.spacingDegrees,
    // Keep a margin for the desktop sampler's three-cell smoothing kernel.
    points: data.points.filter(p => p.lon >= FOCUS.west - .75 && p.lon <= FOCUS.east + .75 && p.lat >= FOCUS.south - .75 && p.lat <= FOCUS.north + .75)
      .map(({ lat, lon, finalCategory }) => ({ lat, lon, finalCategory })),
    boundaries: { type: "FeatureCollection", features: boundaries.features.filter(f => ["Tennessee", "North Carolina", "South Carolina", "Georgia"].includes(f.properties?.name || f.properties?.NAME)) } };
}
async function read(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error("Published map unavailable");
  return response.json();
}
export default async function handler(req, res) {
  if (req.method && req.method !== "GET") return res.status(405).json({ error: "GET required" });
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const next = new Date(`${today}T12:00:00Z`); next.setUTCDate(next.getUTCDate() + 1);
  const date = req.query?.date || today;
  if (![today, next.toISOString().slice(0, 10)].includes(date)) return res.status(400).json({ error: "Choose today or tomorrow" });
  try {
    if (!cache.has(date) || Date.now() - cache.get(date).at > 300000) {
      if (!pending.has(date)) pending.set(date, (async () => {
        // The desktop API locks to its automatic 3 PM rollover. Read the same
        // published daily files directly to support explicit Today/Tomorrow.
        const [data, states] = await Promise.all([read(`https://raw.githubusercontent.com/Irisheagle76/828-weather-direct/main/public/data/feelscore/${date}.json`), borders || read("https://avlweather.com/data/southeast-states.geojson")]);
        const age = Date.now() - Date.parse(data.generatedAt);
        if (data.forecastDate !== date || !Array.isArray(data.points) || !Number.isFinite(age) || age < -300000 || age > 36 * 3600000 || data.spacingDegrees !== .25) throw new Error("Wrong or stale forecast");
        borders = states;
        const result = focusedDataset(data, states);
        if (!result.points.length || !result.boundaries.features.length) throw new Error("Empty focus");
        for (const key of cache.keys()) if (![today, next.toISOString().slice(0, 10)].includes(key)) cache.delete(key);
        cache.set(date, { at: Date.now(), data: result }); return result;
      })().finally(() => pending.delete(date)));
      await pending.get(date);
    }
    res.setHeader("Cache-Control", "public, max-age=60, s-maxage=300");
    return res.status(200).json(cache.get(date).data);
  } catch { res.setHeader("Cache-Control", "no-store"); return res.status(503).json({ error: "Published regional forecast temporarily unavailable" }); }
}
