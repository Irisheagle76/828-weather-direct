import { normalizeTempestDeviceObservation } from "./normalize-observation.js";

export const JCC_STATION_ID = "144737";

export async function fetchJccObservation(token, { fetcher = fetch, now = Date.now() } = {}) {
  if (!token) throw new Error("JCC observation credentials are not configured");
  let data;
  try {
    const url = new URL(`https://swd.weatherflow.com/swd/rest/observations/station/${JCC_STATION_ID}`);
    url.searchParams.set("token", token);
    const response = await fetcher(url.toString(), { signal: AbortSignal.timeout(9000) });
    if (!response.ok) throw new Error("Upstream request failed");
    data = await response.json();
  } catch {
    // Fetch errors can contain the authenticated URL. Never propagate them.
    throw new Error("JCC observation request failed");
  }
  if (data?.status?.status_code !== 0 || String(data.station_id) !== JCC_STATION_ID || !data.obs?.[0]) {
    throw new Error("JCC observation response is unavailable or invalid");
  }
  const raw = data.obs[0];
  const observation = normalizeTempestDeviceObservation(raw);
  if (!Number.isFinite(observation.timestamp) || now - observation.timestamp > 10 * 60_000 || observation.timestamp > now + 60_000) {
    throw new Error("JCC observation is stale or has an invalid timestamp");
  }
  return { ...observation, stationId: JCC_STATION_ID, name: "North Downtown",
    lightningStrikes1h: raw.lightning_strike_count_last_1hr ?? null,
    lightningStrikes3h: raw.lightning_strike_count_last_3hr ?? null };
}
