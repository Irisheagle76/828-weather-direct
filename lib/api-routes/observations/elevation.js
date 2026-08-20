import { getElevationObservations } from "../../observations/service.js";

export default async function handler(req, res) {
  try {
    const payload = await getElevationObservations();
    res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=1800");
    res.setHeader("X-828-Observation-Data", payload.quality.status);
    return res.status(payload.quality.status === "fresh" ? 200 : 206).json(payload);
  } catch (error) {
    console.error(JSON.stringify({ event: "elevation_observation_error", message: error.message }));
    return res.status(503).json({ error: "Elevation observations unavailable", detail: error.message });
  }
}
