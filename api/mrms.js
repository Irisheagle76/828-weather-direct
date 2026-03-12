export default async function handler(req, res) {
  const upstreamUrl =
    "https://mrms.ncep.noaa.gov/data/2D/PrecipRate/latest/MRMS_PrecipRate_00.00.json";

  try {
    const r = await fetch(upstreamUrl);

    if (!r.ok) {
      console.error("MRMS upstream error:", r.status, r.statusText);
      res.status(r.status).json({ error: "Upstream MRMS error" });
      return;
    }

    const data = await r.json();

    // Allow your frontend to call this endpoint
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    res.status(200).json(data);
  } catch (err) {
    console.error("MRMS proxy error:", err);
    res.status(500).json({ error: "MRMS proxy failed" });
  }
}
