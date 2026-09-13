export const FRESH_MINUTES = 15;
export const STALE_MINUTES = 30;

export function assessObservation(observation, nowMs = Date.now()) {
  const flags = [];
  const observedMs = Date.parse(observation?.observedAt);
  const ageMinutes = Number.isFinite(observedMs) ? Math.max(0, (nowMs - observedMs) / 60_000) : null;

  if (!Number.isFinite(observedMs)) flags.push("missing_timestamp");
  if (Number.isFinite(observedMs) && observedMs > nowMs + 5 * 60_000) flags.push("future_timestamp");
  validateRange(flags, "temperature", observation?.temperatureF, -40, 125, true);
  validateRange(flags, "dew_point", observation?.dewPointF, -60, 105);
  validateRange(flags, "humidity", observation?.humidityPct, 0, 100);
  validateRange(flags, "wind", observation?.windMph, 0, 150);
  validateRange(flags, "wind_gust", observation?.windGustMph, 0, 180);
  validateRange(flags, "station_pressure", observation?.stationPressureMb, 750, 1100);
  validateRange(flags, "sea_level_pressure", observation?.seaLevelPressureMb, 850, 1100);
  validateRange(flags, "normalized_pressure", observation?.normalizedPressureMb, 870, 1085);
  if (Number.isFinite(observation?.reportedPressureMb) && observation?.pressureNormalization === "unresolved") flags.push("pressure_datum_unresolved");
  validateRange(flags, "precipitation_rate", observation?.precipitationRateInHr, 0, 20);

  if (Number.isFinite(observation?.dewPointF) && Number.isFinite(observation?.temperatureF) && observation.dewPointF > observation.temperatureF + 4) {
    flags.push("dew_point_above_temperature");
  }

  const freshness = ageMinutes == null
    ? "unknown"
    : ageMinutes <= FRESH_MINUTES
      ? "fresh"
      : ageMinutes <= STALE_MINUTES
        ? "delayed"
        : "stale";
  const blockingFlags = new Set(["missing_timestamp", "future_timestamp", "missing_temperature", "temperature_out_of_range"]);
  const usable = freshness !== "stale" && !flags.some((flag) => blockingFlags.has(flag));

  return {
    freshness,
    ageMinutes: ageMinutes == null ? null : Number(ageMinutes.toFixed(1)),
    usable,
    flags
  };
}

function validateRange(flags, name, value, min, max, required = false) {
  if (value == null) {
    if (required) flags.push(`missing_${name}`);
    return;
  }
  if (!Number.isFinite(value) || value < min || value > max) flags.push(`${name}_out_of_range`);
}
