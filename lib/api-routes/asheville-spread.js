import { buildAshevilleSpread } from "../asheville-spread/service.js";

const CACHE_MS = 300_000;
let memoryCache = null;
let pendingRefresh = null;

export default async function handler(req, res) {
  if (req.method && req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const now = Date.now();
    if (!memoryCache || now - memoryCache.createdAt >= CACHE_MS) {
      if (!pendingRefresh) {
        pendingRefresh = buildAshevilleSpread({ nowMs: now }).then(payload => {
          memoryCache = { createdAt: Date.now(), payload };
        }).finally(() => { pendingRefresh = null; });
      }
      await pendingRefresh;
    }

    res.setHeader("Cache-Control", "public, max-age=0, s-maxage=300, stale-while-revalidate=60");
    return res.status(200).json(memoryCache.payload);
  } catch (error) {
    console.error("Asheville Spread endpoint failed", error);
    return res.status(500).json({
      generatedAt: new Date().toISOString(),
      error: "Asheville Spread is temporarily unavailable"
    });
  }
}
