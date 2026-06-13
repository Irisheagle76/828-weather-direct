const CAMERA_ENDPOINT = "https://www.drivenc.gov/api/v2/get/cameras";
const CACHE_TTL = 10 * 60 * 1000;
let cache = null;

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=1800");

  if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
    return res.status(200).json(cache.payload);
  }

  const key = process.env.DRIVENC_API_KEY;
  if (!key) {
    return res.status(200).json({
      cameras: [],
      count: 0,
      configured: false,
      message: "Add DRIVENC_API_KEY to enable camera cards.",
      sourceUrl: "https://www.drivenc.gov/cctv"
    });
  }

  try {
    const params = new URLSearchParams({ key, format: "json" });
    const response = await fetch(`${CAMERA_ENDPOINT}?${params}`, {
      signal: AbortSignal.timeout(12000)
    });

    if (!response.ok) throw new Error(`DriveNC camera request failed: ${response.status}`);
    const data = await response.json();
    const rows = Array.isArray(data) ? data : data?.Cameras || data?.cameras || [];

    const cameras = rows
      .filter((camera) => {
        const county = String(camera.County || camera.county || "").toLowerCase();
        const roadway = String(camera.Roadway || camera.roadway || "").toUpperCase();
        return county === "buncombe" && ["I-26", "I-240", "I-40"].some((road) => roadway.includes(road));
      })
      .flatMap((camera) => {
        const views = camera.Views || camera.views || [];
        return views.map((view) => ({
          id: view.Id || view.id || camera.Id || camera.id,
          roadway: camera.Roadway || camera.roadway || "Interstate",
          direction: camera.Direction || camera.direction || "",
          location: view.Description || view.description || camera.Location || camera.location || "Buncombe County",
          latitude: camera.Latitude ?? camera.latitude ?? null,
          longitude: camera.Longitude ?? camera.longitude ?? null,
          status: view.Status || view.status || "Unknown",
          url: view.Url || view.url || "https://www.drivenc.gov/cctv",
          videoUrl: view.VideoUrl || view.videoUrl || ""
        }));
      })
      .slice(0, 24);

    const payload = {
      cameras,
      count: cameras.length,
      configured: true,
      updatedAt: new Date().toISOString(),
      source: "DriveNC"
    };

    cache = { timestamp: Date.now(), payload };
    return res.status(200).json(payload);
  } catch (error) {
    console.error("I-26 camera feed failed", error);
    if (cache) return res.status(200).json({ ...cache.payload, stale: true });
    return res.status(502).json({
      error: "DriveNC cameras are temporarily unavailable.",
      cameras: [],
      count: 0,
      configured: true
    });
  }
}
