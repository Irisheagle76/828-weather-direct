// Rain is local: retain the station and observation time behind the signal.
export function supplementCurrentConditions(current, supplemental, now = Date.now()) {
  if (!supplemental || !Number.isFinite(supplemental.timestamp) ||
      now - supplemental.timestamp > 180_000 || supplemental.timestamp > now + 60_000) return current;
  const result = { ...current, supplementalStation: supplemental };
  if (!current) result.timestamp = supplemental.timestamp;
  if (!Number.isFinite(result.precipRate) && Number.isFinite(supplemental.precipRate) &&
      Number.isFinite(supplemental.rainRateObservedAt) && now - supplemental.rainRateObservedAt <= 180_000 && supplemental.rainRateObservedAt <= now + 60_000) {
    result.precipRate = supplemental.precipRate;
    result.precipType = supplemental.precipType;
    result.rainRateObservedAt = supplemental.rainRateObservedAt;
    result.rainSource = { stationId: supplemental.stationId, name: supplemental.name, observedAt: supplemental.rainRateObservedAt };
  }
  const fields = ["air_temperature", "relative_humidity", "dew_point", "wind_avg", "wind_gust",
    "wind_direction", "pressure", "station_pressure", "sea_level_pressure", "solar_radiation", "uv", "feels_like"];
  result.supplementalFields = [];
  for (const field of fields) {
    if (!Number.isFinite(result[field]) && Number.isFinite(supplemental[field])) {
      result[field] = supplemental[field];
      result.supplementalFields.push(field);
    }
  }
  const strikeAt = supplemental.lightningStrikeLastAt;
  const recentStrike = Number.isFinite(strikeAt) && now - strikeAt <= 15 * 60_000 && strikeAt <= now;
  if (supplemental.lightningStrikeCount > 0 || recentStrike) {
    const distance = supplemental.lightningStrikeDistance;
    const primaryAt = result.lightningStrikeLastAt;
    const primaryActive = (result.lightningStrikeCount > 0 && now - result.timestamp <= 180_000) ||
      (Number.isFinite(primaryAt) && now - primaryAt <= 15 * 60_000 && primaryAt <= now);
    if (!primaryActive || !Number.isFinite(result.lightningStrikeDistance) ||
        (Number.isFinite(distance) && distance < result.lightningStrikeDistance)) {
      result.lightningStrikeDistance = distance;
      result.lightningStrikeCount = supplemental.lightningStrikeCount;
      result.lightningStrikeLastAt = strikeAt;
      result.lightningSource = { stationId: supplemental.stationId, name: supplemental.name };
    }
  }
  return supplementCurrentRain(result, supplemental, now);
}

export function supplementCurrentRain(current, supplemental, now = Date.now()) {
  const observedAt = supplemental?.rainRateObservedAt;
  const rate = supplemental?.precipRate;
  if (!Number.isFinite(observedAt) || observedAt > now + 60_000 || now - observedAt > 180_000 ||
      !Number.isFinite(rate) || rate <= 0) return current;
  const primaryFresh = Number.isFinite(current?.rainRateObservedAt) &&
    now - current.rainRateObservedAt <= 180_000 && current.rainRateObservedAt <= now + 60_000;
  if (primaryFresh && current.precipRate >= rate) return current;
  return {
    ...current,
    precipRate: rate,
    precipType: supplemental.precipType,
    rainRateObservedAt: observedAt,
    rainSource: { stationId: supplemental.stationId, name: supplemental.name, observedAt }
  };
}
