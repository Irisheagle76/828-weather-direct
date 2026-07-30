import { getLiveWaterConditions } from "../../water/liveConditions.js";

export default async function handler(req, res) {
  if (req.method && req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const payload = await getLiveWaterConditions();
    res.setHeader("Cache-Control", "public, s-maxage=900, stale-while-revalidate=1800");
    return res.status(200).json(payload);
  } catch (error) {
    console.error("Water conditions aggregation failed", error);
    return res.status(503).json({
      error: "Live water conditions are temporarily unavailable"
    });
  }
}
