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

  // ⭐ VALID Open-Meteo hourly fields
  const hourlyFields = [
    "temperature_2m",
    "dewpoint_2m",
    "relativehumidity_2m",
    "windspeed_10m",
    "wind_gusts_10m",
    "cloudcover",
    "rain",
    "snowfall",
    "uv_index"
  ].join(",");

  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}&longitude=${lon}` +
    `&hourly=${hourlyFields}` +
    `&forecast_days=3` +
    `&timezone=America/New_York` +
    `&temperature_unit=fahrenheit` +
    `&dewpoint_unit=fahrenheit` +
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

    // ⭐ HARD VALIDATION
    if (!data?.hourly?.time || !data.hourly.temperature_2m) {
      console.error("Bad Open-Meteo payload:", data);
      return res.status(500).json({ error: "Invalid weather data structure" });
    }

    // ⭐ Return ONLY the inner hourly object
    return res.status(200).json(data.hourly);

  } catch (err) {
    console.error("Fetch failed:", err);
    return res.status(500).json({ error: "Weather fetch failed" });
  }
}