import { buildPayload } from "../fall.js";
import { getElevationObservations } from "../../observations/service.js";

export default async function handler(req, res) {
  if (!process.env.CRON_SECRET || req.headers?.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const now = Date.now();
    const payload = await buildPayload({ now, observationLoader: () => getElevationObservations({ now, force: true }) });
    return res.status(200).json({
      sampledAt: new Date(now).toISOString(),
      forecastStatus: payload.quality.status,
      observationStatus: payload.observations.status,
      availableAnchors: payload.observations.availableAnchors,
      calibration: payload.calibration
    });
  } catch (error) {
    console.error(JSON.stringify({ event: "fall_observation_sample_error", message: error.message }));
    return res.status(503).json({ error: "Calibration sample failed", detail: error.message });
  }
}
