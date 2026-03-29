export function normalizeOpenMeteo(hourly) {
  const out = [];

  for (let i = 0; i < hourly.time.length; i++) {
    out.push({
      temperature: hourly.temperature_2m[i],
      apparent_temperature: hourly.apparent_temperature?.[i] ?? hourly.temperature_2m[i],
      dewpoint: hourly.dewpoint_2m[i],
      relative_humidity: hourly.relative_humidity_2m?.[i] ?? null,
      wind_speed: hourly.wind_speed_10m[i],
      wind_gust: hourly.wind_gusts_10m[i],
      precipitation: hourly.precipitation[i],
      snowfall: hourly.snowfall[i],
      uv_index: hourly.uv_index[i],
      visibility: null,
      cloud_cover: null,
      smoke_index: 0,
      frost_risk: 0,
      freeze_risk: 0,
      inversion_risk: 0,
      black_ice_risk: 0,
      valley_fog_risk: 0,
      ridge_fog_risk: 0,
      timestamp: new Date(hourly.time[i]).getTime()
    });
  }

  return out;
}