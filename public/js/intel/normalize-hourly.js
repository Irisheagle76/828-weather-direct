export function normalizeOpenMeteo(hourly) {
  if (!hourly?.time?.length) {
    console.error("normalizeOpenMeteo: invalid hourly payload", hourly);
    return [];
  }

  const out = [];

  for (let i = 0; i < hourly.time.length; i++) {
    const pick = (...keys) => {
      for (const k of keys) {
        const val = hourly[k]?.[i];
        if (val != null) return val;
      }
      return null;
    };

    const num = v => (v != null && !isNaN(v) ? v : null);

    // CORE INPUTS
    const temp = num(pick("temperature_2m"));
    const dew = num(pick("dewpoint_2m"));
    const humidity = num(pick("relativehumidity_2m"));

    const windSpeed = num(pick("wind_speed_10m", "windspeed_10m")) ?? 0;
    const windDir = pick("wind_direction_10m") ?? "";

    const precip = num(pick("precipitation")) ?? 0;
    const snow = num(pick("snowfall")) ?? 0;

    const cloud = num(pick("cloudcover"));
    const visibility = num(pick("visibility"));

    const apparent = num(pick("apparent_temperature")) ?? temp;

    if (i === 0) {
      console.log("NORMALIZE DEBUG:", {
        temp,
        dew,
        humidity,
        windSpeed,
        windDir,
        precip,
        cloud,
        visibility
      });
    }

    out.push({
      // REQUIRED BY RENDERER + COMFORT ENGINE
      time: hourly.time[i],
      temp,
      dew,
      humidity,
      windSpeed,
      windDir,

      // OPTIONAL BUT USED BY FUTURE COMFORT
      apparent,
      precip,
      snow,
      cloud,
      visibility,
      uv: num(pick("uv_index"))
    });
  }

  return out;
}