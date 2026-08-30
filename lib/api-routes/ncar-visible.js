import {
  NCAR_PAGE_URL,
  fetchVisibleSatelliteSignal
} from "../sky/visible-satellite.js";

export { getObservedAt, parseVisibleImage, parseVisibleImages } from "../sky/visible-satellite.js";

export default async function handler(req, res) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const signal = await fetchVisibleSatelliteSignal({
      fetchImpl: (url, options = {}) => fetch(url, { ...options, signal: controller.signal })
    });
    res.setHeader("Cache-Control", "public, s-maxage=180, stale-while-revalidate=300");
    return res.status(200).json({
      image: signal.image,
      previousImage: signal.previousImage,
      source: NCAR_PAGE_URL,
      observedAt: signal.observedAt,
      fetchedAt: new Date().toISOString(),
      lowCloudAnalysis: signal.analysis
    });
  } catch (error) {
    console.error("NCAR visible satellite feed failed:", error);
    res.setHeader("Cache-Control", "no-store");
    return res.status(502).json({ error: "The North Carolina visible-satellite image is temporarily unavailable", source: NCAR_PAGE_URL });
  } finally {
    clearTimeout(timeout);
  }
}
