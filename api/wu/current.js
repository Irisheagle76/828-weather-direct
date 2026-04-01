export default async function handler(req, res) {
  const { stationId } = req.query;

  if (!stationId) {
    return res.status(400).json({ error: "Missing stationId" });
  }

  try {
    const url = `https://api.weather.com/v2/pws/observations/current?stationId=${stationId}&format=json&units=e&apiKey=${process.env.WU_API_KEY}`;
    const r = await fetch(url);

    if (!r.ok) {
      return res.status(500).json({ error: "WU observation failed" });
    }

    const data = await r.json();
    return res.status(200).json(data);

  } catch (err) {
    return res.status(500).json({ error: "WU observation failed" });
  }
}
