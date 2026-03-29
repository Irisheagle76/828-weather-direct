export function normalizeOpenMeteo(hourly) {
  if (!hourly?.time?.length) {
    console.error("normalizeOpenMeteo: invalid hourly payload", hourly);
    return [];
  }

  const out = [];

  for (let i = 0; i < hourly.time.length; i++) {
    const temp = hourly.temperature_2m?.[i] ?? null;
    const dew = hourly.dewpoint_2m?.[i] ?? null;
    const humidity = hourly.relativehumidity_2m?.[i] ?? null;

    const windSpeed = hourly.wind_speed_10m?.[i] ?? 0; // ✅ FIXED
    const windGust = hourly.windgusts_10m?.[i] ?? 0;

    const precip = hourly.precipitation?.[i] ?? 0;
    const snow = hourly.snowfall?.[i] ?? 0;

    const cloud = hourly.cloudcover?.[i] ?? null;
    const visibility = hourly.visibility?.[i] ?? null;

    out.push({
      // CORE
      temperature: temp,

      apparent_temperature:
        hourly.apparent_temperature?.[i] ?? temp,

      feels_like:
        hourly.apparent_temperature?.[i] ?? temp, // ✅ comma added below

      dewpoint: dew,
      relative_humidity: humidity,

      wind_speed: windSpeed,
      wind_speed_10m: windSpeed, // ✅ alias (important)
      wind_gust: windGust,

      precipitation: precip,
      rain: precip,

      snowfall: snow,

      cloud_cover: cloud,
      visibility: visibility,

      uv_index: hourly.uv_index?.[i] ?? null,

      // DERIVED
      smoke_index: 0,

      frost_risk:
        temp != null && dew != null && temp <= 37 && dew <= 36 ? 0.6 :
        temp != null && temp <= 34 ? 1 : 0,

      freeze_risk:
        temp != null && temp <= 32 ? 1 :
        temp != null && temp <= 34 ? 0.5 : 0,

      black_ice_risk:
        temp != null && temp <= 32 && precip > 0 ? 1 : 0,

      inversion_risk:
        temp != null && temp <= 40 && windSpeed < 3 ? 0.5 : 0,

      valley_fog_risk:
        humidity != null && humidity >= 95 ? 0.6 : 0,

      ridge_fog_risk:
        humidity != null && humidity >= 98 ? 0.5 : 0,

      timestamp: new Date(hourly.time[i]).getTime()
    });
  }

  return out;
}