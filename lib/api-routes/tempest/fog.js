import { normalizeTempestDeviceObservation } from '../../tempest/normalize-observation.js';
import { FOG_STATIONS, buildFogIndex } from '../../tempest/fog-index.js';

export function createFogHandler({ fetcher = (...args) => fetch(...args), clock = Date.now, env = process.env } = {}) {
  let saved;
  let pending;
  async function cloud(config) {
    try {
      const coords = config.stationId === '144737' ? 'latitude=35.606&longitude=-82.548' : 'latitude=35.616&longitude=-82.506';
      const response = await fetcher(new URL(`https://api.open-meteo.com/v1/forecast?${coords}&current=cloud_cover&timeformat=unixtime&timezone=GMT`), { signal: AbortSignal.timeout(6000) });
      if (!response.ok) return null;
      const data = await response.json();
      const at = data.current?.time * 1000;
      return Number.isFinite(at) && clock() - at <= 1800000 && at <= clock() + 60000 && data.current_units?.cloud_cover === '%'
        ? data.current.cloud_cover : null;
    } catch { return null; }
  }
  async function request(path, token) {
    const url = new URL(`https://swd.weatherflow.com/swd/rest/${path}`);
    url.searchParams.set('token', token);
    const response = await fetcher(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error('Station request unavailable');
    const data = await response.json();
    if (data.status?.status_code !== 0) throw new Error('Station response unavailable');
    return data;
  }
  async function station(config) {
    const token = config.stationId === '144737' ? env.JCC_TEMPEST_TOKEN || env.TEMPEST_TOKEN : env.TEMPEST_TOKEN;
    if (!token) return { ...config, available: false, reason: 'Station access not configured' };
    try {
      const [latest, cloudCover] = await Promise.all([request(`observations/station/${config.stationId}`, token), cloud(config)]);
      if (String(latest.station_id) !== config.stationId || !latest.obs?.[0]) throw new Error('Wrong station');
      const current = normalizeTempestDeviceObservation(latest.obs[0]);
      const initial = buildFogIndex(current, { now: clock() });
      if (!initial.available) return { ...config, ...initial };
      let history = [];
      try {
        const metadata = await request(`stations/${config.stationId}`, token);
        const device = metadata.stations?.find(s => String(s.station_id) === config.stationId)?.devices?.find(d => d.device_type === 'ST');
        if (!device?.device_id) throw new Error('Device unavailable');
        const end = Math.floor(current.timestamp / 1000);
        const data = await request(`observations/device/${device.device_id}?time_start=${end - 86400}&time_end=${end}`, token);
        if (data.type !== 'obs_st' || (data.device_id != null && String(data.device_id) !== String(device.device_id))) throw new Error('Invalid history');
        history = (data.obs || []).filter(Array.isArray).map(row => ({
          ...normalizeTempestDeviceObservation(row), reportIntervalMinutes: row[17]
        }));
      } catch { /* Current observations still yield an explicitly partial index. */ }
      return { ...config, ...buildFogIndex(current, { history, cloudCover, now: clock() }) };
    } catch {
      // Upstream errors may contain authenticated URLs; never log or return them.
      return { ...config, available: false, reason: 'Fresh station observations unavailable' };
    }
  }
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method && req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Method not allowed' }); }
    if (!saved || clock() - saved.at >= 300_000) {
      pending ||= Promise.all(FOG_STATIONS.map(station)).then(stations => ({ at: clock(), stations })).finally(() => { pending = null; });
      saved = await pending;
    }
    return res.status(200).json({ generatedAt: saved.at, stations: saved.stations.map(s =>
      s.available && clock() - s.observedAt > 600_000 ? { stationId: s.stationId, name: s.name, available: false, reason: 'Fresh station observations unavailable' } : s) });
  };
}
export default createFogHandler();
