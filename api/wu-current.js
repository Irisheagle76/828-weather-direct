export default async function handler(req, res) {
  try {
    const { stationId } = req.query;
    const apiKey = process.env.WU_API_KEY;

    const url =
      `https://api.weather.com/v2/pws/observations/current?stationId=${stationId}` +
      `&format=json&units=e&apiKey=${apiKey}`;

    const r = await fetch(url);
    const data = await r.json();

    if (!r.ok) {
      return res.status(r.status).json({ error: data });
    }

    res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=300");
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
