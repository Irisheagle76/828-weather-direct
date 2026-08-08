import { getRainfallContextLive } from "../rainfall-context/live.js";

export default async function handler(req, res) {
  if (req.method && req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const data = await getRainfallContextLive();
    res.setHeader("Cache-Control", "public, s-maxage=21600, stale-while-revalidate=86400");
    return res.status(200).json(data);
  } catch (error) {
    console.error("Rainfall context error:", error);
    return res.status(500).json({ error: "Live rainfall context is temporarily unavailable" });
  }
}
