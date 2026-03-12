export default async function handler(req, res) {
  try {
    const { stationId } = req.query;
    const apiKey = process.env.WU_API_KEY;

    const url =
      `https://api.weather.com/v2/pws/observations/current?stationId=${stationId}` +
      `&format=json&units=e&apiKey=${apiKey}`;

    const r = await fetch(url);
    const text = await r.text();   // <-- read raw text

    console.log("WU RAW RESPONSE:", text);  // <-- log it

    if (!r.ok) {
      return res.status(r.status).json({ error: text });
    }

    const data = JSON.parse(text); // <-- parse manually
    res.status(200).json(data);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
