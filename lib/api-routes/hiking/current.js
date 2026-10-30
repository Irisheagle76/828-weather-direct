import { analyzeHikingStations } from "../../hiking/guidance.js";
import { getElevationObservations } from "../../observations/service.js";
import { OBSERVATION_STATIONS } from "../../observations/registry.js";

export function hikingCurrentPayload(observations, { now = Date.now() } = {}) {
  const usable = observations.stations.filter(station => station.health?.usable !== false && Number.isFinite(station.temperatureF));
  const byId = new Map(usable.map(station => [station.id, station]));
  const stations = OBSERVATION_STATIONS.filter(station => !station.componentOnly && station.enabled !== false).map(definition => byId.get(definition.id) || {
    id: definition.id, stationId: definition.providerStationId, provider: definition.provider,
    source: definition.provider, name: definition.name, elevationFt: definition.elevationFt,
    url: definition.url, lat: definition.latitude, lon: definition.longitude,
    status: "unavailable", health: { usable: false }
  });
  const guidance = analyzeHikingStations(usable, { now });
  if (usable.length < observations.quality.requestedStations) {
    const warning = `Limited station coverage: ${usable.length} of ${observations.quality.requestedStations} sites reporting. Check current conditions for your route; unavailable sites cannot rule out wind, rain, or lightning.`;
    guidance.hikerNarrative = `${warning} ${guidance.hikerNarrative}`;
    guidance.routeWarnings.push(warning);
  }
  return { ...observations, stations, guidance };
}

export default async function handler(req, res) {
  try {
    const observations = await getElevationObservations();
    const payload = hikingCurrentPayload(observations);
    res.setHeader("Cache-Control", `public, max-age=0, s-maxage=${Math.max(1, Math.ceil((1800000 - Date.now() % 1800000) / 1000))}`);
    res.setHeader("X-828-Observation-Data", observations.quality.status);
    return res.status(observations.quality.status === "fresh" ? 200 : 206).json(payload);
  } catch (error) {
    console.error(JSON.stringify({ event: "hiking_guidance_error", message: error.message }));
    return res.status(503).json({ error: "Live hiking guidance unavailable", detail: error.message });
  }
}
