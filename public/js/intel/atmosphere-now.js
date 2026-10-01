const finite = Number.isFinite;
const fresh = (at, now, age = 180_000) => finite(at) && at <= now + 60_000 && now - at <= age;
const f = c => Math.round(c * 1.8 + 32);

// Station inputs use normalized Tempest units: C, m/s, mm/hr, km, epoch ms.
// These are local surface observations, not a vertical atmospheric sounding.
export function buildAtmosphereNow(station, { now = Date.now(), daylight = null } = {}) {
  const available = fresh(station?.timestamp, now);
  const s = available ? station : {};
  const cards = [];
  const add = (title, value, detail) => cards.push({ title, value, detail });
  const humidity = finite(s.relative_humidity) && s.relative_humidity >= 0 && s.relative_humidity <= 100 ? s.relative_humidity : null;
  const spread = finite(s.air_temperature) && finite(s.dew_point) && s.dew_point <= s.air_temperature ? s.air_temperature - s.dew_point : null;
  const saturated = humidity != null && humidity >= 92 && spread != null && spread <= 1.7;
  add('Moisture', humidity == null ? 'Unavailable' : `${Math.round(humidity)}% humidity`,
    spread == null ? 'Temperature and dew point are needed to assess proximity to saturation.' :
    `${f(s.air_temperature)}°F air · ${f(s.dew_point)}°F dew point · ${(spread * 1.8).toFixed(1)}°F apart. ${saturated ? 'Near-saturated air at the station supports fog or low-cloud potential; visibility observations are needed to confirm fog.' : 'This describes moisture near the ground; it does not establish cloud height or cloud cover.'}`);
  add('Sunlight at the ground', finite(s.solar_radiation) && s.solar_radiation >= 0 ? `${Math.round(s.solar_radiation)} W/m²` : 'Unavailable',
    daylight === false ? 'After sunset, low solar radiation is expected and does not indicate cloud cover.' :
    'Measured solar energy at the station. Sun angle, cloud, and local shading all affect this reading; a single value cannot establish clearing.');
  const wind = finite(s.wind_avg) && s.wind_avg >= 0;
  const direction = finite(s.wind_direction) && s.wind_direction >= 0 && s.wind_direction <= 360
    ? ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(s.wind_direction / 45) % 8] : null;
  add('Surface wind', wind ? `${Math.round(s.wind_avg * 2.236936)} mph${s.wind_avg >= 0.5 && direction ? ` from ${direction}` : ''}` : 'Unavailable',
    `${finite(s.wind_gust) && s.wind_gust >= 0 ? `Gusts ${Math.round(s.wind_gust * 2.236936)} mph. ` : ''}Wind at this site describes local air movement, not cloud motion or winds above the ridges.`);
  const rain = fresh(s.rainRateObservedAt ?? s.timestamp, now) && finite(s.precipRate) && s.precipRate >= 0;
  add('Rain at the station', rain ? s.precipRate > 0 ? `${(s.precipRate / 25.4).toFixed(3)} in/hr` : 'None measured' : 'Unavailable',
    'A local rain-rate observation. Showers elsewhere in Asheville may differ; forecast rain probability is a separate signal.');
  const recent = finite(s.lightningStrikeLastAt) && s.lightningStrikeLastAt <= now && now - s.lightningStrikeLastAt <= 900_000;
  const detected = recent || (finite(s.lightningStrikeCount) && s.lightningStrikeCount > 0);
  add('Lightning detections', detected ? 'Recent detection' : finite(s.lightningStrikeCount) ? 'No recent detection reported' : 'Unavailable',
    detected ? `${finite(s.lightningStrikeDistance) && s.lightningStrikeDistance >= 0 ? `Reported distance ${(s.lightningStrikeDistance * 0.621371).toFixed(1)} miles from the station. ` : ''}A single detector does not establish direction, storm movement, or citywide coverage.` :
    'This sensor cannot establish that the area is free of lightning.');
  if (!available) for (const card of cards) { card.value = 'Unavailable'; card.detail = 'Waiting for a station observation no more than three minutes old.'; }
  return { available, timestamp: available ? s.timestamp : null, cards,
    summary: !available ? 'Fresh local observations are unavailable. The camera and sunset forecast remain separate sources.' :
      detected ? 'Recent lightning is reported by the North Downtown station.' :
      rain && s.precipRate > 0 ? 'Rain is being measured at the North Downtown station.' :
      saturated ? 'The air is close to saturation at North Downtown; check the cameras for visibility changes.' :
      'A local surface read to compare with the Asheville camera views.' };
}
