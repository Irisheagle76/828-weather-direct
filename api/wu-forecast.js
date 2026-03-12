export default async function handler(req, res) {
  try {
    const { lat, lon } = req.query;

    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat}&longitude=${lon}` +
      `&hourly=temperature_2m,dewpoint_2m,precipitation,snowfall,windgusts_10m,uv_index` +
      `&forecast_days=3&timezone=America/New_York` +
      `&temperature_unit=fahrenheit` +
      `&dewpoint_unit=fahrenheit` +
      `&wind_speed_unit=mph` +
      `&precipitation_unit=inch`;

    const r = await fetch(url);
    const data = await r.json();

    if (!r.ok) {
      return res.status(r.status).json({ error: data });
    }

    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
