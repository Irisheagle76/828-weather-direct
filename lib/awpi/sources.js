import { localDate } from './engine.js';
export const SOURCE_URLS = {
  ensemble: 'https://ensemble-api.open-meteo.com/v1/ensemble?latitude=35.5951&longitude=-82.5515&hourly=temperature_2m,precipitation,snowfall&models=gfs_seamless&forecast_days=14&timezone=America%2FNew_York',
  ao: 'https://ftp.cpc.ncep.noaa.gov/cwlinks/norm.daily.ao.cdas.z1000.19500101_current.csv',
  nao: 'https://ftp.cpc.ncep.noaa.gov/cwlinks/norm.daily.nao.cdas.z500.19500101_current.csv',
  pna: 'https://ftp.cpc.ncep.noaa.gov/cwlinks/norm.daily.pna.cdas.z500.19500101_current.csv',
  roni: 'https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso/roni/',
  nino34: 'https://www.cpc.ncep.noaa.gov/data/indices/sstoi.indices',
};
export async function fetchSource(url, fetcher = fetch) {
  const response = await fetcher(url, { signal: AbortSignal.timeout(18000), headers: { 'User-Agent': '828WeatherDirect-AWPI/1.0 (avlweather.com)' } });
  if (!response.ok) throw new Error(`Source returned HTTP ${response.status}`);
  return response.text();
}
export function parseDaily(text, now = new Date()) {
  const rows = text.trim().split(/\r?\n/);
  if (!/^year,month,day,/i.test(rows.shift() || '')) throw new Error('Unexpected CPC columns');
  const records = rows.map(line => line.split(',').map(Number)).filter(a => a.length === 4 && a.every(Number.isFinite) && Math.abs(a[3]) <= 20).map(([year, month, day, value]) => ({ date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`, value })).filter(r => r.date <= localDate(now)).sort((a, b) => a.date.localeCompare(b.date));
  const latest = records.at(-1);
  if (!latest) throw new Error('No valid CPC values');
  return { ...latest, previous: records.at(-2)?.value ?? null, stale: now - new Date(`${latest.date}T23:59:59Z`) > 5 * 86400000 };
}
const strip = value => value.replace(/<[^>]*>/g, '').replace(/&minus;/g, '-').replace(/&nbsp;/g, ' ').trim();
export function parseRoni(html, now = new Date()) {
  const records = [];
  for (const row of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[1].matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)].map(m => strip(m[1]));
    if (!/^\d{4}$/.test(cells[0] || '')) continue;
    const year = +cells[0];
    cells.slice(1, 13).forEach((cell, i) => {
      if (!/^-?\d+(\.\d+)?$/.test(cell) || Math.abs(+cell) > 10) return;
      // Seasonal value is eligible only after its final month has ended.
      const end = new Date(Date.UTC(year, i + 2, 0));
      if (end < now) records.push({ value: +cell, period: `${year} ${['DJF','JFM','FMA','MAM','AMJ','MJJ','JJA','JAS','ASO','SON','OND','NDJ'][i]}`, date: end.toISOString().slice(0, 10) });
    });
  }
  records.sort((a, b) => a.date.localeCompare(b.date));
  const latest = records.at(-1);
  if (!latest) throw new Error('No valid RONI seasons');
  const tail = records.slice(-5);
  return { ...latest, previous: records.at(-2)?.value ?? null, classification: tail.length === 5 && tail.every(r => r.value >= .5) ? 'Warm episode (RONI criterion)' : tail.length === 5 && tail.every(r => r.value <= -.5) ? 'Cold episode (RONI criterion)' : 'No sustained RONI episode', stale: now - new Date(latest.date) > 100 * 86400000, revision: 'ERSSTv6; recent values may be revised' };
}
export function parseNino(text, now = new Date()) {
  const records = text.trim().split(/\r?\n/).slice(1).map(line => line.trim().split(/\s+/).map(Number)).filter(a => a.length === 10 && a.every(Number.isFinite) && a[1] >= 1 && a[1] <= 12 && Math.abs(a[9]) < 10).map(a => ({ value: a[9], date: new Date(Date.UTC(a[0], a[1], 0)).toISOString().slice(0, 10), period: `${a[0]}-${String(a[1]).padStart(2, '0')}` })).filter(r => new Date(r.date) < now).sort((a, b) => a.date.localeCompare(b.date));
  const latest = records.at(-1);
  if (!latest) throw new Error('No valid Niño 3.4 observations');
  return { ...latest, previous: records.at(-2)?.value ?? null, stale: now - new Date(latest.date) > 75 * 86400000 };
}
export async function collectSources({ now = new Date(), fetcher = fetch, cached = {} } = {}) {
  const results = await Promise.all(Object.entries(SOURCE_URLS).map(async ([key, url]) => {
    // Climate products update monthly; teleconnections daily. Keep timestamps on reuse.
    const ttl = key === 'roni' || key === 'nino34' ? 24 * 3600000 : 3 * 3600000;
    if (key !== 'ensemble' && cached[key]?.status === 'ok' && now - new Date(cached[key].retrievedAt) < ttl) return [key, cached[key]];
    try {
      const raw = await fetchSource(url, fetcher);
      const data = key === 'ensemble' ? JSON.parse(raw) : key === 'roni' ? parseRoni(raw, now) : key === 'nino34' ? parseNino(raw, now) : parseDaily(raw, now);
      return [key, { status: data.stale ? 'stale' : 'ok', url, retrievedAt: now.toISOString(), data }];
    } catch (error) {
      if (key !== 'ensemble' && cached[key]?.data) return [key, { ...cached[key], status: 'stale', refreshAttemptAt: now.toISOString(), error: error.message }];
      return [key, { status: 'unavailable', url, retrievedAt: now.toISOString(), error: error.message }];
    }
  }));
  return Object.fromEntries(results);
}
