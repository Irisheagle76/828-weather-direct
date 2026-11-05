import { kv } from '@vercel/kv';

const HALF_HOUR_MS = 30 * 60_000;
const error = (code, message) => Object.assign(new Error(message), { code });

// FindU documents <=20 stations, each no more than once per five minutes.
// Shared cooldown survives cold starts and deployments. Storage failure never
// falls back to visitor-driven upstream requests.
export async function fetchCwop(station, { fetchImpl = fetch, nowMs = Date.now(), timeoutMs = 10000, cwopCache = kv } = {}) {
  const call = station.source.stationId;
  if (!/^[A-Z0-9-]{3,12}$/.test(call)) throw error('invalid_station', 'Invalid CWOP identifier');
  const key = `observations:cwop:v1:${call}`;
  let cached;
  try {
    cached = await cwopCache.get(key);
    if (cached?.slot === Math.floor(nowMs / HALF_HOUR_MS)) {
      if (cached.observation) return cached.observation;
      throw error('empty_observation', 'No current CWOP observation');
    }
    // Keep the cooldown even on failure: do not repeatedly retry a struggling feed.
    const acquired = await cwopCache.set(key + ':cooldown', '1', { nx: true, ex: 1800 });
    if (!acquired) {
      if (cached?.observation) return cached.observation;
      throw error('collection_pending', 'CWOP collection is pending');
    }
  } catch (e) {
    if (e.code) throw e;
    throw error('shared_cache_unavailable', 'Shared observation cache is unavailable');
  }
  let observation = null;
  let failure;
  try {
    const url = new URL('http://www.findu.com/cgi-bin/wxxml.cgi');
    url.searchParams.set('call', call);
    url.searchParams.set('last', '1');
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs), headers: { 'User-Agent': '828Weather/1.0 (https://avlweather.com)' } });
    if (!response.ok) throw error('upstream_http', 'CWOP request failed');
    const xml = await response.text();
    if (xml.length > 100000) throw error('invalid_observation', 'CWOP response is too large');
    observation = normalizeCwopXml(xml, call);
    // The XML feed omits APRS's rolling 24-hour precipitation field.
    // This small raw-report request shares the existing station cooldown.
    try {
      const rawUrl = new URL('http://www.findu.com/cgi-bin/rawwx.cgi');
      rawUrl.searchParams.set('call', call); rawUrl.searchParams.set('time', '1'); rawUrl.searchParams.set('last', '1');
      const rawResponse = await fetchImpl(rawUrl, { signal: AbortSignal.timeout(timeoutMs) });
      if (rawResponse.ok) Object.assign(observation, normalizeCwopRain(await rawResponse.text(), call, observation.observedAt));
    } catch { /* A rainfall failure must not discard the station's other observations. */ }
  } catch (e) { failure = e; }
  await cwopCache.set(key, { slot: Math.floor(nowMs / HALF_HOUR_MS), observation: observation ?? cached?.observation ?? null }, { ex: 86400 });
  if (observation) return observation;
  if (cached?.observation) return cached.observation;
  throw failure ?? error('empty_observation', 'No CWOP observations');
}

export function normalizeCwopXml(xml, call) {
  const text = (body, tag) => body.match(new RegExp(`<${tag}>([^<]*)</${tag}>`))?.[1]?.trim();
  if (text(xml, 'call') !== call) throw error('invalid_observation', 'CWOP station mismatch');
  const reports = [...xml.matchAll(/<weatherReport>([\s\S]*?)<\/weatherReport>/g)].map(match => {
    const body = match[1];
    const stamp = text(body, 'timeReceived');
    if (!/^\d{14}$/.test(stamp ?? '')) return null;
    const iso = `${stamp.slice(0,4)}-${stamp.slice(4,6)}-${stamp.slice(6,8)}T${stamp.slice(8,10)}:${stamp.slice(10,12)}:${stamp.slice(12,14)}Z`;
    const date = new Date(iso);
    if (!Number.isFinite(date.valueOf()) || date.toISOString().replace(/[-:T]/g,'').slice(0,14) !== stamp) return null;
    const value = (tag, min, max) => {
      const raw = text(body, tag);
      if (!/^-?\d+(?:\.\d+)?$/.test(raw ?? '')) return null;
      const number = Number(raw);
      return number >= min && number <= max ? number : null;
    };
    const temperatureF = value('temperature', -40, 125);
    const humidityPct = value('humidity', 0, 100);
    const tempC = temperatureF == null ? null : (temperatureF - 32) * 5 / 9;
    const alpha = tempC != null && humidityPct > 0 ? Math.log(humidityPct / 100) + 17.625 * tempC / (243.04 + tempC) : null;
    return {
      observedAt: date.toISOString(), timestampBasis: 'received',
      temperatureF, humidityPct,
      dewPointF: alpha == null ? null : Number((243.04 * alpha / (17.625 - alpha) * 9 / 5 + 32).toFixed(1)),
      windMph: value('windSpeed', 0, 150), windGustMph: value('windGust', 0, 180),
      windDirectionDeg: value('windDirection', 0, 360),
      seaLevelPressureMb: value('barometer', 850, 1100), pressureDatum: 'sea_level',
      precipitationLastHourIn: value('rain1h', 0, 20),
      precipitationRateInHr: null, precipitationTodayIn: null,
      providerQcStatus: 'unverified', sourceUrl: `http://www.findu.com/cgi-bin/wxpage.cgi?call=${call}`
    };
  }).filter(Boolean).sort((a,b) => Date.parse(b.observedAt) - Date.parse(a.observedAt));
  if (!reports.length) throw error('empty_observation', 'CWOP returned no reports');
  return reports[0];
}

// APRS 1.0: lowercase p = past 24 hours, uppercase P = since midnight;
// both use hundredths of an inch. Never substitute one for the other.
export function normalizeCwopRain(raw, call, observedAt) {
  const missing = { precipitation24HourIn: null, precipitation24HourEndAt: null };
  if (raw.length > 100000) return missing;
  const reports = [...raw.matchAll(/(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}),([A-Z0-9-]+)(?:>|&gt;)[^\r\n<]*/g)]
    .filter(m => m[2] === call).sort((a,b) => b[1].localeCompare(a[1]));
  const latest = reports[0];
  if (!latest) return missing;
  const end = Date.parse(latest[1].replace(' ', 'T') + 'Z');
  if (!Number.isFinite(end) || Math.abs(end - Date.parse(observedAt)) > 15 * 60000) return missing;
  const weather = latest[0].match(/_([0-9.]{3}\/[0-9.]{3}(?:[A-Za-z][0-9.\-]+)*)/)?.[1];
  const rain = weather?.match(/p(\d{3})(?!\d)/);
  return rain ? { precipitation24HourIn: Number(rain[1]) / 100, precipitation24HourEndAt: new Date(end).toISOString() } : missing;
}
