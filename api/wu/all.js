export default async function handler(req, res) {
  const { lat, lon } = req.query;

  if (!lat || !lon) {
    return res.status(400).json({ error: "Missing lat or lon" });
  }

  try {
    // 1. Nearest station lookup
    const nearestUrl = `https://api.weather.com/v3/location/near?geocode=${lat},${lon}&product=pws&format=json&apiKey=${process.env.WU_API_KEY}`;
    const nearestRes = await fetch(nearestUrl);

    if (!nearestRes.ok) {
      return res.status(500).json({ error: "WU nearest station lookup failed" });
    }

    const nearestData = await nearestRes.json();
    const stationId = nearestData?.location?.stationId?.[0];

    if (!stationId) {
      return res.status(200).json({
        stationId: null,
        current: null,
        history: null
      });
    }

    // 2. Current observation
    const currentUrl = `https://api.weather.com/v2/pws/observations/current?stationId=${stationId}&format=json&units=e&apiKey=${process.env.WU_API_KEY}`;
    const currentRes = await fetch(currentUrl);
    const currentData = currentRes.ok ? await currentRes.json() : null;
    const currentObs = currentData?.observations?.[0] ?? null;

    // 3. 7-day hourly history
    const historyUrl = `https://api.weather.com/v2/pws/observations/hourly/7day?stationId=${stationId}&format=json&units=e&apiKey=${process.env.WU_API_KEY}`;
    const historyRes = await fetch(historyUrl);
    const historyData = historyRes.ok ? await historyRes.json() : null;

    // 4. Unified response
    return res.status(200).json({
      stationId,
      current: currentObs,
      history: historyData
    });

  } catch (err) {
    return res.status(500).json({ error: "WU all fetch failed" });
  }
}

