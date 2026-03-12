export default async function handler(req, res) {
  try {
    const { lat, lon } = req.query;
    const apiKey = process.env.WU_API_KEY;

    const url =
      `https://api.weather.com/v3/location/near?geocode=${lat},${lon}` +
      `&product=pws&format=json&apiKey=${apiKey}`;

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
