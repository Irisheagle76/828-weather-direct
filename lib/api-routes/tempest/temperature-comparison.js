import { normalizeTempestDeviceObservation } from "../../tempest/normalize-observation.js";
import { buildTemperatureComparison, yesterdayAtSameTime } from "../../tempest/temperature-comparison.js";

let saved = null;
let pending = null;
let deviceCache = null;
async function tempest(path, token) {
  const url = new URL(`https://swd.weatherflow.com/swd/rest/${path}`);
  url.searchParams.set("token", token);
  const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error("Tempest upstream unavailable");
  const json = await response.json();
  if (json.status?.status_code && json.status.status_code !== 0) throw new Error("Tempest rejected request");
  return json;
}
async function load(stationId, token) {
  const latest = await tempest(`observations/station/${stationId}`, token);
  const current = normalizeTempestDeviceObservation(latest.obs?.[0] || {});
  if (!current.timestamp || !Number.isFinite(current.air_temperature) || Math.abs(Date.now() - current.timestamp) > 900_000) {
    return { available: false, reason: "current_observation_stale" };
  }
  if (!deviceCache || deviceCache.stationId !== stationId || Date.now() - deviceCache.at > 3_600_000) {
    const metadata = await tempest(`stations/${stationId}`, token);
    const device = metadata.stations?.find(s => String(s.station_id) === String(stationId))?.devices?.find(d => d.device_type === "ST");
    if (!device?.device_id) throw new Error("Station Tempest device unavailable");
    deviceCache = { stationId, deviceId: device.device_id, at: Date.now() };
  }
  const target = yesterdayAtSameTime(current.timestamp);
  if (!target) return { available: false, reason: "ambiguous_clock_time" };
  const start = Math.floor((target - 600_000) / 1000);
  const end = Math.ceil((target + 600_000) / 1000);
  const history = await tempest(`observations/device/${deviceCache.deviceId}?time_start=${start}&time_end=${end}`, token);
  if (history.type && history.type !== "obs_st") throw new Error("Unexpected device observation type");
  return { ...buildTemperatureComparison(current, history.obs), stationId };
}
export default async function handler(req, res) {
  if (req.method && req.method !== "GET") { res.setHeader("Allow", "GET"); return res.status(405).json({ error: "Method not allowed" }); }
  const stationId = process.env.TEMPEST_STATION_ID;
  const token = process.env.TEMPEST_TOKEN;
  if (!stationId || !token) { res.setHeader("Cache-Control", "no-store"); return res.status(200).json({ available: false, reason: "not_configured" }); }
  try {
    if (!saved || saved.stationId !== stationId || Date.now() - saved.at >= 300_000) {
      pending ||= load(stationId, token).finally(() => { pending = null; });
      const data = await pending;
      saved = { stationId, at: Date.now(), data };
    }
    res.setHeader("Cache-Control", "public, max-age=60, s-maxage=300");
    return res.status(200).json(saved.data);
  } catch {
    // Never log upstream URLs: they contain the private Tempest token.
    res.setHeader("Cache-Control", "no-store");
    return res.status(503).json({ available: false, reason: "history_unavailable" });
  }
}
