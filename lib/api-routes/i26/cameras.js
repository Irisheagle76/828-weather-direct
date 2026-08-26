const CAMERA_ENDPOINT = "https://www.drivenc.gov/api/v2/get/cameras";
const CACHE_TTL = 10 * 60 * 1000;
let cache = null;

const FEATURED_CAMERAS = [
  { id: 6092, location: "PCCTV13-I40-45W", label: "I-40 near Mile 45" },
  { id: 4228, location: "CCTV13-I240-3E_I26", label: "I-240 East at I-26" },
  { id: 4204, location: "CCTV13-I240-5W_CHARLOTTE", label: "I-240 at Charlotte Street" },
  { id: 4206, location: "CCTV13-I26-31W_POND", label: "I-26 at Pond Road" },
  { id: 4839, location: "CCTV13-I26-35M", label: "I-26 near Mile 35" },
  { id: 4841, location: "CCTV13-I26-27M", label: "I-26 near Mile 27" },
  { id: 4846, location: "CCTV13-I40-44W_SMOKYPARK", label: "I-40 at Smokey Park Highway" },
  { id: 5125, location: "CCTV13-I240-4M_I26", label: "I-240 at I-26" },
  { id: 5266, location: "CCTV13-I26-21E", label: "I-26 near Mile 21" }
];

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

    const allCameras = rows
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
          videoUrl: view.VideoUrl || view.videoUrl || "",
          imageUrl: `https://nc.prod.traveliq.co/map/Cctv/${view.Id || view.id || camera.Id || camera.id}`
        }));
      });

    const byId = new Map(allCameras.map((camera) => [Number(camera.id), camera]));
    const cameras = FEATURED_CAMERAS.map((featured) => ({
      id: featured.id,
      roadway: byId.get(featured.id)?.roadway || featured.location.match(/I-?\d+/)?.[0] || "Interstate",
      direction: byId.get(featured.id)?.direction || "",
      location: featured.location,
      label: featured.label,
      latitude: byId.get(featured.id)?.latitude ?? null,
      longitude: byId.get(featured.id)?.longitude ?? null,
      status: byId.get(featured.id)?.status || "Enabled",
      url: byId.get(featured.id)?.url || `https://www.drivenc.gov/map/Cctv/${featured.id}`,
      videoUrl: byId.get(featured.id)?.videoUrl || "",
      imageUrl: `https://nc.prod.traveliq.co/map/Cctv/${featured.id}`
    }));

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
