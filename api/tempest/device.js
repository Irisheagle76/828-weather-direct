// /api/tempest/device.js
// Unified Tempest Proxy — supports device obs + Better Forecast

export default async function handler(req, res) {
  try {
    const { deviceId, stationId, token } = req.query;

    if (!token) {
      return res.status(400).json({ error: "Missing Tempest token" });
    }

    // ⭐ If stationId is provided → use Better Forecast (preferred)
    if (stationId) {
      const url = `https://swd.weatherflow.com/swd/rest/better_forecast?station_id=${stationId}&token=${token}`;
      const r = await fetch(url);
      const json = await r.json();
      return res.status(200).json(json);
    }

    // ⭐ Otherwise fall back to device observations (legacy)
    if (deviceId) {
      const url = `https://swd.weatherflow.com/swd/rest/observations/device/${deviceId}?token=${token}`;
      const r = await fetch(url);
      const json = await r.json();
      return res.status(200).json(json);
    }

    return res.status(400).json({ error: "Missing stationId or deviceId" });

  } catch (err) {
    console.error("Tempest fetch failed:", err);
    return res.status(500).json({ error: "Server error" });
  }
}