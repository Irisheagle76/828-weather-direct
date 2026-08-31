import { analyzeHikingStations } from "../../hiking/guidance.js";
import { getElevationObservations } from "../../observations/service.js";

export default async function handler(req, res) {
  try {
    const observations = await getElevationObservations();
    const stations = observations.stations.filter((station) => station.health?.usable !== false);
    const payload = {
      ...observations,
      stations,
      guidance: analyzeHikingStations(stations)
    };
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=60");
    res.setHeader("X-828-Observation-Data", observations.quality.status);
    return res.status(observations.quality.status === "fresh" ? 200 : 206).json(payload);
  } catch (error) {
    console.error(JSON.stringify({ event: "hiking_guidance_error", message: error.message }));
    return res.status(503).json({ error: "Live hiking guidance unavailable", detail: error.message });
  }
}
