import { kv } from '@vercel/kv';
const HALF_HOUR = 1800000;
const missing = () => ({ precipitation24HourIn: null, precipitation24HourEndAt: null });

// Optional enrichment: failures leave current conditions available. Shared cooldown
// prevents history downloads per visitor, instance or deployment.
export async function enrichRainfall(station, observation, options = {}) {
  const env = options.env ?? process.env;
  if (!options.rainfallCache && !env.KV_REST_API_URL) return { ...observation, ...missing() };
  const cache = options.rainfallCache ?? kv;
  const now = options.nowMs ?? Date.now();
  const key = `observations:rain24:v1:${station.source.provider}:${station.source.stationId}`;
  let rain = missing();
  try {
    const cached = await cache.get(key);
    const valid = cached?.rain?.precipitation24HourEndAt && now - Date.parse(cached.rain.precipitation24HourEndAt) <= 90 * 60000;
    if (cached?.slot === Math.floor(now / HALF_HOUR)) rain = valid ? cached.rain : missing();
    else if (!await cache.set(key + ':cooldown', '1', { nx: true, ex: 1800 })) rain = valid ? cached.rain : missing();
    else {
      try {
        rain = station.source.provider === 'tempest'
          ? await tempestRain(station, { ...options, env, cache, now })
          : await nwsRain(station, options);
      } catch { rain = missing(); }
      await cache.set(key, { slot: Math.floor(now / HALF_HOUR), rain }, { ex: 86400 });
    }
  } catch { rain = missing(); }
  const end = Date.parse(rain.precipitation24HourEndAt);
  if (!Number.isFinite(end) || now - end > 90 * 60000 || end > now + 60000) rain = missing();
  return { ...observation, ...rain };
}

async function json(url, options) {
  const response = await (options.fetchImpl ?? fetch)(url, { signal: AbortSignal.timeout(options.timeoutMs ?? 10000), headers: { 'User-Agent': '828Weather/1.0 (https://avlweather.com)' } });
  if (!response.ok) throw new Error('Rainfall source unavailable');
  return response.json();
}

async function tempestRain(station, options) {
  const id = station.source.stationId;
  const token = id === '144737' ? options.env.JCC_TEMPEST_TOKEN || options.env.TEMPEST_TOKEN : options.env.TEMPEST_TOKEN;
  const apiKey = options.env.WEATHERFLOW_API_KEY;
  if (!token && !apiKey) return missing();
  const url = path => { const u = new URL('https://swd.weatherflow.com/swd/rest/' + path); u.searchParams.set(token ? 'token' : 'api_key', token || apiKey); return u; };
  const key = `observations:rain24:device:${id}`;
  let device = await options.cache.get(key);
  if (!device) {
    const meta = await json(url('stations/' + encodeURIComponent(id)), options);
    const devices = meta.stations?.find(s => String(s.station_id) === String(id))?.devices?.filter(d => d.device_type === 'ST' && d.serial_number && d.device_meta?.environment !== 'indoor');
    // Do not guess which rain gauge belongs to a station with multiple devices.
    if (devices?.length !== 1) return missing();
    device = devices[0].device_id;
    if (!Number.isInteger(device) || device <= 0) return missing();
    await options.cache.set(key, device, { ex: 86400 });
  }
  const u = url('observations/device/' + device);
  u.searchParams.set('time_start', String(Math.floor(options.now / 1000) - 26 * 3600));
  u.searchParams.set('time_end', String(Math.floor(options.now / 1000)));
  const history = await json(u, options);
  if (history.type !== 'obs_st' || (history.device_id != null && Number(history.device_id) !== device)) return missing();
  return sumRainIntervals((history.obs ?? []).map(row => ({ end: row[0] * 1000, duration: row[17] * 60000, inches: typeof row[12] === 'number' ? row[12] / 25.4 : null })));
}

async function nwsRain(station, options) {
  const now = options.nowMs ?? Date.now();
  const u = new URL(`https://api.weather.gov/stations/${encodeURIComponent(station.source.stationId)}/observations`);
  u.searchParams.set('start', new Date(now - 27 * 3600000).toISOString()); u.searchParams.set('limit', '500');
  const history = await json(u, options);
  // Use explicit one-hour accumulations only. Null and failed QC are never dry.
  return sumRainIntervals((history.features ?? []).map(({ properties: p }) => ({
    end: Date.parse(p.timestamp), duration: 3600000,
    inches: p.precipitationLastHour?.unitCode === 'wmoUnit:mm' && !['X','Z'].includes(p.precipitationLastHour.qualityControl) && typeof p.precipitationLastHour.value === 'number' ? p.precipitationLastHour.value / 25.4 : null
  })).filter(row => Number.isFinite(row.inches)));
}

export function sumRainIntervals(intervals) {
  const rows = intervals.filter(r => Number.isFinite(r.end) && Number.isFinite(r.duration) && r.duration > 0 && r.duration <= 3600000).sort((a,b) => b.end - a.end);
  if (!rows.length) return missing();
  const end = rows[0].end, start = end - 86400000;
  let cursor = end, sum = 0;
  // Select a continuous non-overlapping 24-hour chain. Partial history is unknown.
  while (cursor > start) {
    const row = rows.find(r => r.end === cursor && Number.isFinite(r.inches) && r.inches >= 0 && r.inches <= 20 && r.end - r.duration >= start);
    if (!row) return missing();
    sum += row.inches; cursor -= row.duration;
  }
  return { precipitation24HourIn: Number(sum.toFixed(3)), precipitation24HourEndAt: new Date(end).toISOString() };
}
