// Compare distinct detections from one sensor; this is not storm motion.
export function lightningDistanceTrend(samples, now = Date.now()) {
  const unique = new Map();
  for (const sample of samples || []) {
    if (Number.isFinite(sample.at) && sample.at <= now && now - sample.at <= 15 * 60_000 &&
        Number.isFinite(sample.distanceKm) && sample.distanceKm >= 0) unique.set(sample.at, sample);
  }
  const points = [...unique.values()].sort((a, b) => a.at - b.at);
  if (points.length < 3 || points.at(-1).at - points[0].at < 60_000 || now - points.at(-1).at > 180_000) return "insufficient data";
  const deltas = points.slice(1).map((p, i) => p.distanceKm - points[i].distanceKm);
  if (deltas.every(d => d <= 0) && points[0].distanceKm - points.at(-1).distanceKm >= 2) return "decreasing";
  if (deltas.every(d => d >= 0) && points.at(-1).distanceKm - points[0].distanceKm >= 2) return "increasing";
  return "variable or steady";
}

const detections = new Map();
export function rememberStationObservation(station, now = Date.now()) {
  if (!station || station.stationId !== '144737') return station;
  for (const [at] of detections) if (now - at > 900_000 || at > now) detections.delete(at);
  const at = station.lightningStrikeLastAt ?? (station.lightningStrikeCount > 0 ? station.timestamp : null);
  if (Number.isFinite(station.timestamp) && now - station.timestamp <= 180_000 && station.timestamp <= now + 60_000 &&
      Number.isFinite(at) && at <= now && now - at <= 900_000 && Number.isFinite(station.lightningStrikeDistance)) {
    detections.set(at, { at, distanceKm: station.lightningStrikeDistance });
  }
  while (detections.size > 60) detections.delete(detections.keys().next().value);
  return { ...station, lightningDistanceTrend: lightningDistanceTrend([...detections.values()], now) };
}

export function stationWeatherSummary(station, now = Date.now(), { surface = 'sky' } = {}) {
  if (!station || !Number.isFinite(station.timestamp) || now - station.timestamp > 180_000 || station.timestamp > now + 60_000) return "";
  const parts = [];
  const name = 'The North Downtown weather station';
  const rainAt = station.rainRateObservedAt ?? station.timestamp;
  if (station.precipRate > 0 && Number.isFinite(rainAt) && now - rainAt <= 180_000 && rainAt <= now + 60_000) parts.push(`${name} is measuring rain at ${(station.precipRate / 25.4).toFixed(2)} in/hr.`);
  const recent = Number.isFinite(station.lightningStrikeLastAt) && now - station.lightningStrikeLastAt <= 15 * 60_000 && station.lightningStrikeLastAt <= now;
  if (station.lightningStrikeCount > 0 || recent) {
    parts.push(Number.isFinite(station.lightningStrikeDistance)
      ? `${name} detected lightning about ${(station.lightningStrikeDistance * 0.621371).toFixed(1)} miles from the station.`
      : `${name} detected lightning; distance is unavailable.`);
    if (['decreasing', 'increasing'].includes(station.lightningDistanceTrend)) parts.push(`Successive detections are ${station.lightningDistanceTrend === 'decreasing' ? 'closer to' : 'farther from'} the station; this does not establish storm movement.`);
  }
  if (parts.length) return parts.join(' ');
  const temp = Number.isFinite(station.air_temperature) ? station.air_temperature * 1.8 + 32 : null;
  const dew = Number.isFinite(station.dew_point) ? station.dew_point * 1.8 + 32 : null;
  const humidity = Number.isFinite(station.relative_humidity) ? Math.round(station.relative_humidity) : null;
  if (surface === 'sky' && humidity >= 92 && temp != null && dew != null && Math.abs(temp - dew) <= 3) {
    return `${name} reports ${humidity}% humidity with temperature close to the dew point—supporting near-saturated air locally, though this alone does not confirm fog.`;
  }
  if (surface === 'sky' && Number.isFinite(station.solar_radiation) && station.solar_radiation >= 400) {
    return `${name} measures ${Math.round(station.solar_radiation)} W/m² of solar radiation, adding a ground-level sunlight reading to the camera view.`;
  }
  if (Number.isFinite(station.wind_gust) && station.wind_gust * 2.236936 >= 15) {
    return `${name} reports gusts to ${Math.round(station.wind_gust * 2.236936)} mph.`;
  }
  if (surface === 'sky' && humidity != null && dew != null) return `${name} reports ${humidity}% humidity and a ${Math.round(dew)}°F dew point, adding local moisture context to the sky read.`;
  if (temp != null) return `${name} reports ${Math.round(temp)}°F${humidity != null ? ` with ${humidity}% humidity` : ''}${Number.isFinite(station.wind_avg) ? ` and ${Math.round(station.wind_avg * 2.236936)} mph wind` : ''}.`;
  return '';
}

export function withStationContext(narrative, station, now = Date.now()) {
  const summary = stationWeatherSummary(station, now);
  if (!summary || narrative?.detail?.includes(summary)) return narrative;
  return { ...narrative, detail: [narrative?.detail, summary].filter(Boolean).join(' ') };
}

export function withStationSkyMeasurements(context, station, now = Date.now()) {
  if (!station || !Number.isFinite(station.timestamp) || now - station.timestamp > 180_000 || station.timestamp > now + 60_000) return context;
  const local = rememberStationObservation(station, now);
  const result = {...context, supplementalStation:local};
  for (const [key,field,scale,offset] of [
    ['humidity','relative_humidity',.01,0], ['temperature','air_temperature',1.8,32],
    ['dewPoint','dew_point',1.8,32], ['solarRadiation','solar_radiation',1,0], ['uvIndex','uv',1,0]
  ]) if (Number.isFinite(local[field])) result[key] = local[field]*scale+offset;
  return result;
}
