const INCIDENT_SERVICE =
  "https://services.arcgis.com/NuWFvHYDMVmmxMeM/arcgis/rest/services/NCDOT_TIMS_Incidents/FeatureServer/0/query";

const CACHE_TTL = 4 * 60 * 1000;
let cache = null;

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  res.setHeader("Cache-Control", "s-maxage=240, stale-while-revalidate=600");

  if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
    return res.status(200).json(cache.payload);
  }

  try {
    const now = Date.now();
    const where = [
      "CountyName = 'Buncombe'",
      `EndDateTime >= DATE '${new Date(now).toISOString().slice(0, 10)}'`,
      "Latitude >= 35.50",
      "Latitude <= 35.64",
      "Longitude >= -82.66",
      "Longitude <= -82.50"
    ].join(" AND ");

    const params = new URLSearchParams({
      where,
      outFields: [
        "Id",
        "Road",
        "Reason",
        "Condition",
        "DriveNCLink",
        "Latitude",
        "Longitude",
        "LanesAffected",
        "EventType",
        "EventSubType",
        "StartDateTime",
        "EndDateTime",
        "LastUpdateDateTime",
        "IsFullClosure",
        "Direction",
        "Location"
      ].join(","),
      returnGeometry: "true",
      orderByFields: "LastUpdateDateTime DESC",
      resultRecordCount: "100",
      f: "json"
    });

    const response = await fetch(`${INCIDENT_SERVICE}?${params}`, {
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) throw new Error(`NCDOT incident request failed: ${response.status}`);

    const data = await response.json();
    if (data.error) throw new Error(data.error.message || "NCDOT incident service error");

    const incidents = (data.features || [])
      .map(({ attributes = {}, geometry = {} }) => ({
        id: attributes.Id,
        road: attributes.Road || "Asheville roadway",
        direction: attributes.Direction || "",
        condition: attributes.Condition || "Active",
        lanesAffected: attributes.LanesAffected || "",
        type: attributes.EventType || "event",
        subType: attributes.EventSubType || "",
        description: attributes.Location || attributes.Reason || "Active NCDOT event",
        details: attributes.Reason || "",
        fullClosure: String(attributes.IsFullClosure).toLowerCase() === "true",
        startTime: attributes.StartDateTime || null,
        endTime: attributes.EndDateTime || null,
        updatedTime: attributes.LastUpdateDateTime || null,
        latitude: attributes.Latitude ?? geometry.y ?? null,
        longitude: attributes.Longitude ?? geometry.x ?? null,
        url: attributes.DriveNCLink || "https://www.drivenc.gov/region/Asheville"
      }))
      .filter((item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude))
      .filter((item) => !item.startTime || item.startTime <= Date.now() + 15 * 60 * 1000);

    const payload = {
      incidents,
      count: incidents.length,
      updatedAt: new Date().toISOString(),
      source: "NCDOT TIMS / DriveNC"
    };

    cache = { timestamp: Date.now(), payload };
    return res.status(200).json(payload);
  } catch (error) {
    console.error("I-26 incident feed failed", error);
    if (cache) return res.status(200).json({ ...cache.payload, stale: true });
    return res.status(502).json({
      error: "Live NCDOT incidents are temporarily unavailable.",
      incidents: [],
      count: 0
    });
  }
}
