export default async function handler(req, res) {
  const { stationId } = req.query;

  if (!stationId) {
    return res.status(400).json({ error: "Missing stationId" });
  }

  try {
    const url = `https://api.weather.com/v3/location/point?stationId=${stationId}&format=json&apiKey=${process.env.WU_API_KEY}`;
    const r = await fetch(url);

    if (!r.ok) {
      return res.status(500).json({ error: "WU station metadata failed" });
    }

    const data = await r.json();
    return res.status(200).json(data);

  } catch (err) {
    return res.status(500).json({ error: "WU station metadata failed" });
  }
}
