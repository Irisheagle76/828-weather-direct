// ============================================================
// /js/intel/trend/analyzeTrend.js
// ============================================================

export function analyzeTrend(hourly = []) {
  if (!hourly.length) return {};

  const now = Date.now();

  const future = hourly
    .filter(h => h.timestamp >= now)
    .slice(0, 5);

  if (future.length < 2) return {};

  const first = future[0];

  const peak = future.reduce((max, h) =>
    h.temperatureF > max.temperatureF ? h : max,
    future[0]
  );

  const last = future[future.length - 1];

  const tempRise = peak.temperatureF - first.temperatureF;
  const tempDrop = last.temperatureF - peak.temperatureF;

  const windRise =
    (last.windSpeed ?? 0) - (first.windSpeed ?? 0);

  const humidityDrop =
    (first.relative_humidity ?? 0) -
    (last.relative_humidity ?? 0);

  return {
    strongWarmup: tempRise >= 6,
    mildWarmup: tempRise >= 3,

    afternoonPeak:
      peak.timestamp !== first.timestamp,

    coolingAfterPeak: tempDrop < -2,

    windIncreasing: windRise > 3,

    drying: humidityDrop > 5
  };
}