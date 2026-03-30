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

    const temp = num(pick("temperature_2m"));
    const dew = num(pick("dewpoint_2m"));
    const humidity = num(pick("relativehumidity_2m"));
    const windSpeed = num(pick("wind_speed_10m", "windspeed_10m")) ?? 0;
    const windGust = num(pick("wind_gusts_10m", "windgusts_10m")) ?? 0;
    const precip = num(pick("precipitation")) ?? 0;
    const snow = num(pick("snowfall")) ?? 0;
    const cloud = num(pick("cloudcover"));
    const visibility = num(pick("visibility"));
    const apparent = num(pick("apparent_temperature")) ?? temp;

    out.push({
      // EXACT FIELDS HUMAN-ACTION EXPECTS
      temperature: temp,
      apparent_temperature: apparent,
      dewpoint: dew,
      relative_humidity: humidity,
      wind_speed: windSpeed,
      wind_gust: windGust,
      precipitation: precip,
      snowfall: snow,
      uv_index: num(pick("uv_index")),
      visibility,
      cloud_cover: cloud,

      // RISKS (safe defaults)
      smoke_index: 0,
      frost_risk: temp != null && dew != null && temp <= 37 && dew <= 36 ? 0.6 : temp != null && temp <= 34 ? 1 : 0,
      freeze_risk: temp != null && temp <= 32 ? 1 : temp != null && temp <= 34 ? 0.5 : 0,
      black_ice_risk: temp != null && temp <= 32 && precip > 0 ? 1 : 0,
      inversion_risk: temp != null && temp <= 40 && windSpeed < 3 ? 0.5 : 0,
      valley_fog_risk: humidity != null && humidity >= 95 ? 0.6 : 0,
      ridge_fog_risk: humidity != null && humidity >= 98 ? 0.5 : 0,

      timestamp: new Date(hourly.time[i]).getTime()
    });
  }

  return out;
}
