export default async function handler(req, res) {
  const { deviceId, token } = req.query;

  if (!deviceId || !token) {
    return res.status(400).json({ error: "Missing deviceId or token" });
  }

  try {
    const url = `https://swd.weatherflow.com/swd/rest/observations/device/${deviceId}?token=${token}`;
    const r = await fetch(url);

    if (!r.ok) {
      return res.status(500).json({ error: "Tempest API request failed" });
    }

    const data = await r.json();
    return res.status(200).json(data);

  } catch (err) {
    return res.status(500).json({ error: "Tempest device obs failed" });
  }
}