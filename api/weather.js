// /api/weather.js
export default async function handler(req, res) {
  const { type } = req.query;

  try {
    if (type === "hourly") {
      return await handleHourly(req, res);
    }

    return res.status(400).json({ error: "Invalid type" });
  } catch (err) {
    console.error("Weather API error:", err);
    return res.status(500).json({ error: err.message });
  }
}

// ------------------------------------------------------------
// HOURLY FORECAST
// ------------------------------------------------------------
async function handleHourly(req, res) {
  const { lat, lon } = req.query;

  if (!lat || !lon) {
    return res.status(400).json({ error: "Missing lat/lon" });
  }

  // ✅ CORRECT Open-Meteo fields (aligned with your app)
  const hourlyFields = [
    "temperature_2m",
    "apparent_temperature",        // ✅ added
    "dewpoint_2m",
    "relativehumidity_2m",
    "precipitation",               // ✅ replaces rain
    "snowfall",
    "cloudcover",
    "visibility",                  // ✅ added
    "wind_speed_10m",
    "windgusts_10m",               // ✅ FIXED (no underscore after wind)
    "uv_index"
  ].join(",");

 const url =
  `https://api.open-meteo.com/v1/forecast` +
  `?latitude=${lat}&longitude=${lon}` +
  `&hourly=${hourlyFields}` +
  `&forecast_days=3` +
  `&temperature_unit=fahrenheit` +      // ⭐ ADD THIS
  `&dewpoint_unit=fahrenheit` +         // ⭐ ADD THIS
  `&timezone=America/New_York` +
  `&wind_speed_unit=mph` +
  `&precipitation_unit=inch`;

  try {
    const r = await fetch(url);

    if (!r.ok) {
      const text = await r.text();
      console.error("Open-Meteo error:", text);
      return res.status(500).json({ error: "Open-Meteo request failed" });
    }

    const data = await r.json();

    // ✅ HARD VALIDATION (prevents silent failure)
    if (
      !data?.hourly?.time ||
      !data.hourly.temperature_2m ||
      !data.hourly.wind_speed_10m
    ) {
      console.error("Bad Open-Meteo payload:", data);
      return res.status(500).json({ error: "Invalid weather data structure" });
    }

    return res.status(200).json(data.hourly);

  } catch (err) {
    console.error("Fetch failed:", err);
    return res.status(500).json({ error: "Weather fetch failed" });
  }
}