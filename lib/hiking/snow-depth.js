import { OBSERVATION_STATIONS } from "../observations/registry.js";

const sites = [
  { id: "asheville", name: "Asheville", latitude: 35.5951, longitude: -82.5515 },
  ...["frying-pan-pisgah-ridgeline", "mount-mitchell"].map((id) =>
    OBSERVATION_STATIONS.find((station) => station.id === id))
];

const HOUR_MS = 60 * 60 * 1000;
let cached;

export function getHikingSnowDepth({ fetcher = fetch, now = Date.now() } = {}) {
  const hour = Math.floor(now / HOUR_MS);
  if (fetcher !== fetch) return fetchSnowDepth(fetcher, now);
  if (cached?.hour !== hour) cached = { hour, result: fetchSnowDepth(fetcher, now) };
  return cached.result;
}

async function fetchSnowDepth(fetcher, now) {
  const params = new URLSearchParams({
    latitude: sites.map(({ latitude }) => latitude).join(","),
    longitude: sites.map(({ longitude }) => longitude).join(","),
    hourly: "snow_depth",
    forecast_hours: "1",
    timeformat: "unixtime"
  });

  try {
    const response = await fetcher(`https://api.open-meteo.com/v1/forecast?${params}`, { signal: AbortSignal.timeout(3500) });
    if (!response.ok) return [];
    const forecasts = await response.json();
    if (!Array.isArray(forecasts) || forecasts.length !== sites.length) return [];

    return sites.flatMap(({ id, name }, index) => {
      const forecast = forecasts[index];
      const depthM = forecast?.hourly?.snow_depth?.[0];
      const time = forecast?.hourly?.time?.[0];
      if (forecast?.hourly_units?.snow_depth !== "m" || !Number.isFinite(depthM) || depthM < 0 ||
        !Number.isFinite(time) || Math.abs(time * 1000 - now) >= HOUR_MS) return [];

      return [{ id, name, depthIn: depthM / 0.0254, validAt: new Date(time * 1000).toISOString(), source: "Open-Meteo model estimate" }];
    });
  } catch {
    return [];
  }
}
