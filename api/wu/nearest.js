export default async function handler(req, res) {
  const { lat, lon } = req.query;

  if (!lat || !lon) {
    return res.status(400).json({ error: "Missing lat or lon" });
  }

  try {
    const url = `https://api.weather.com/v3/location/near?geocode=${lat},${lon}&product=pws&format=json&apiKey=${process.env.WU_API_KEY}`;
    const r = await fetch(url);

    if (!r.ok) {
      return res.status(500).json({ error: "WU nearest station lookup failed" });
    }

    const data = await r.json();
    return res.status(200).json(data);

  } catch (err) {
    return res.status(500).json({ error: "WU nearest station lookup failed" });
  }
}