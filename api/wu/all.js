export default async function handler(req, res) {
  const { lat, lon } = req.query;

  if (!lat || !lon) {
    return res.status(400).json({ error: "Missing lat or lon" });
  }

  console.log("WU ALL ROUTE HIT");
  console.log("WU_API_KEY length:", process.env.WU_API_KEY?.length);

  const apiKey = process.env.WU_API_KEY;

  // ------------------------------------------------------------
  // 1. WEATHER UNDERGROUND (Primary)
  // ------------------------------------------------------------
  try {
    if (apiKey) {
      const nearestUrl = `https://api.weather.com/v3/location/near?geocode=${lat},${lon}&product=pws&format=json&apiKey=${apiKey}`;
      const nearestRes = await fetch(nearestUrl);

      if (nearestRes.ok) {
        const nearestData = await nearestRes.json();
        const stationId = nearestData?.location?.stationId?.[0];

        if (stationId) {
          const currentUrl = `https://api.weather.com/v2/pws/observations/current?stationId=${stationId}&format=json&units=e&apiKey=${apiKey}`;
          const currentRes = await fetch(currentUrl);
          const currentData = currentRes.ok ? await currentRes.json() : null;

          const historyUrl = `https://api.weather.com/v2/pws/observations/hourly/7day?stationId=${stationId}&format=json&units=e&apiKey=${apiKey}`;
          const historyRes = await fetch(historyUrl);
          const historyData = historyRes.ok ? await historyRes.json() : null;

          return res.status(200).json({
            stationId,
            current: currentData?.observations?.[0] ?? null,
            history: historyData ?? null,
            source: "wu"
          });
        }
      }
    }
  } catch (err) {
    console.error("WU failed:", err);
  }

  // ------------------------------------------------------------
  // 2. TEMPEST FALLBACK (Secondary)
  // ------------------------------------------------------------
  try {
    console.log("Using Tempest fallback");

    const tempestUrl = `https://swd.weatherflow.com/swd/rest/observations/station/315255?token=${process.env.TEMPEST_TOKEN}`;
    const tempestRes = await fetch(tempestUrl);

    if (tempestRes.ok) {
      const tempestData = await tempestRes.json();

      return res.status(200).json({
        stationId: "tempest",
        current: tempestData?.obs?.[0] ?? null,
        history: null,
        source: "tempest"
      });
    }
  } catch (err) {
    console.error("Tempest fallback failed:", err);
  }

  // ------------------------------------------------------------
  // 3. FINAL SAFE FALLBACK (Never break the app)
  // ------------------------------------------------------------
  return res.status(200).json({
    stationId: null,
    current: null,
    history: null,
    source: "none"
  });
}
