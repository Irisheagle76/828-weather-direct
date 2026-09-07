import { buildAshevilleSpread } from "../asheville-spread/service.js";

const CACHE_MS = 60_000;
let memoryCache = null;

export default async function handler(req, res) {
  if (req.method && req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const now = Date.now();
    if (!memoryCache || now - memoryCache.createdAt >= CACHE_MS) {
      memoryCache = { createdAt: now, payload: await buildAshevilleSpread({ nowMs: now }) };
    }

    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=120");
    return res.status(200).json(memoryCache.payload);
  } catch (error) {
    console.error("Asheville Spread endpoint failed", error);
    return res.status(500).json({
      generatedAt: new Date().toISOString(),
      error: "Asheville Spread is temporarily unavailable"
    });
  }
}
