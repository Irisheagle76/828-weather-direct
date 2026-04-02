// ------------------------------------------------------------
// HOURLY FORECAST — SAFE + RESILIENT VERSION
// ------------------------------------------------------------
async function handleHourly(req, res) {
  const { lat, lon } = req.query;

  if (!lat || !lon) {
    return res.status(400).json({ error: "Missing lat/lon" });
  }

  const hourlyFields = [
    "temperature_2m",
    "apparent_temperature",
    "dewpoint_2m",
    "relativehumidity_2m",
    "precipitation",
    "snowfall",
    "cloudcover",
    "visibility",
    "wind_speed_10m",
    "windgusts_10m",
    "uv_index"
  ].join(",");

  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}&longitude=${lon}` +
    `&hourly=${hourlyFields}` +
    `&forecast_days=3` +
    `&temperature_unit=fahrenheit` +
    `&dewpoint_unit=fahrenheit` +
    `&timezone=America/New_York` +
    `&wind_speed_unit=mph` +
    `&precipitation_unit=inch`;

  try {
    const r = await fetch(url);

    if (!r.ok) {
      const text = await r.text();
      console.error("Open-Meteo error:", text);

      return res.status(200).json(buildFallbackHourly("bad-status"));
    }

    const data = await r.json();

    if (!data?.hourly || !Array.isArray(data.hourly.time)) {
      console.error("Bad Open-Meteo payload:", data);

      return res.status(200).json(buildFallbackHourly("malformed"));
    }

    return res.status(200).json(data.hourly);

  } catch (err) {
    console.error("Fetch failed:", err);

    return res.status(200).json(buildFallbackHourly("exception"));
  }
}

// ------------------------------------------------------------
// SAFE FALLBACK HOURLY STRUCTURE
// ------------------------------------------------------------
function buildFallbackHourly(reason) {
  return {
    time: [],
    temperature_2m: [],
    dewpoint_2m: [],
    relativehumidity_2m: [],
    precipitation: [],
    snowfall: [],
    cloudcover: [],
    visibility: [],
    wind_speed_10m: [],
    windgusts_10m: [],
    uv_index: [],
    _fallback: true,
    _reason: reason
  };
}
    const data = await r.json();

    // ⭐ If hourly is missing or malformed, return safe fallback
    if (!data?.hourly || !Array.isArray(data.hourly.time)) {
      console.error("Bad Open-Meteo payload:", data);

      return res.status(200).json({
        time: [],
        temperature_2m: [],
        dewpoint_2m: [],
        relativehumidity_2m: [],
        precipitation: [],
        snowfall: [],
        cloudcover: [],
        visibility: [],
        wind_speed_10m: [],
        windgusts_10m: [],
        uv_index: [],
        _fallback: true,
        _reason: "open-meteo-malformed"
      });
    }

    // ⭐ Normal case
    return res.status(200).json(data.hourly);

  } catch (err) {
    console.error("Fetch failed:", err);

    // ⭐ FINAL SAFETY NET
    return res.status(200).json({
      time: [],
      temperature_2m: [],
      dewpoint_2m: [],
      relativehumidity_2m: [],
      precipitation: [],
      snowfall: [],
      cloudcover: [],
      visibility: [],
      wind_speed_10m: [],
      windgusts_10m: [],
      uv_index: [],
      _fallback: true,
      _reason: "exception"
    });
  }
}