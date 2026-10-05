const HOUR_MS = 3600000;
// Forecast samples represent hourly intervals. Clip edge samples to solar daylight.
export function daylightInterval(hour) {
  const { timestamp, sunrise, sunset } = hour;
  if (![timestamp, sunrise, sunset].every(Number.isFinite) || sunrise <= 0 || sunset <= sunrise) return null;
  const start = Math.max(timestamp, sunrise);
  const end = Math.min(timestamp + HOUR_MS, sunset);
  return end > start ? { start, end } : null;
}
export function hasSolarTimes(hour) {
  return Number.isFinite(hour.sunrise) && Number.isFinite(hour.sunset) && hour.sunrise > 0 && hour.sunset > hour.sunrise;
}
