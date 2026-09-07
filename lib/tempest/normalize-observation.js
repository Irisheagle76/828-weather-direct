export function normalizeTempestDeviceObservation(obs = {}) {
  if (Array.isArray(obs)) {
    const airTemperature = finite(obs[7]);
    const relativeHumidity = finite(obs[8]);
    return {
      air_temperature: airTemperature,
      relative_humidity: relativeHumidity,
      dew_point: deriveDewPointC(airTemperature, relativeHumidity),
      wind_avg: finite(obs[2]),
      wind_gust: finite(obs[3]),
      wind_direction: finite(obs[4]),
      pressure: null,
      station_pressure: finite(obs[6]),
      sea_level_pressure: null,
      barometric_pressure: null,
      precipRate: tempestObservationPrecipRate(obs),
      rainRateObservedAt: normalizeTempestTimestamp(obs[0]),
      precipAccum: finite(obs[12]),
      precipAccumLocalDay: finite(obs[18]),
      precipType: obs[13] ?? null,
      lightningStrikeDistance: finite(obs[14]),
      lightningStrikeCount: finite(obs[15]) ?? 0,
      lightningStrikeLastAt: null,
      uv: finite(obs[10]),
      solar_radiation: finite(obs[11]),
      feels_like: airTemperature,
      timestamp: normalizeTempestTimestamp(obs[0])
    };
  }

  const airTemperature = finite(obs.air_temperature ?? obs.temperature ?? obs.temp);
  const relativeHumidity = finite(obs.relative_humidity ?? obs.humidity);
  return {
    air_temperature: airTemperature,
    relative_humidity: relativeHumidity,
    dew_point: finite(obs.dew_point) ?? deriveDewPointC(airTemperature, relativeHumidity),
    wind_avg: finite(obs.wind_avg ?? obs.windSpeed),
    wind_gust: finite(obs.wind_gust ?? obs.windGust),
    wind_direction: finite(obs.wind_direction ?? obs.windDirection),
    pressure: finite(obs.sea_level_pressure ?? obs.barometric_pressure ?? obs.pressure),
    station_pressure: finite(obs.station_pressure),
    sea_level_pressure: finite(obs.sea_level_pressure),
    barometric_pressure: finite(obs.barometric_pressure),
    precipRate: tempestObservationPrecipRate(obs),
    rainRateObservedAt: normalizeTempestTimestamp(obs.rainRateObservedAt ?? obs.timestamp ?? obs.time),
    precipAccum: finite(obs.precipAccum ?? obs.precip_accum ?? obs.rainAccum),
    precipAccumLocalDay: finite(obs.precip_accum_local_day ?? obs.local_day_precip_accum),
    precipType: obs.precipType ?? obs.precip_type ?? null,
    lightningStrikeDistance: finite(obs.lightningStrikeDistance ?? obs.lightning_strike_last_distance ?? obs.lightning_strike_avg_distance),
    lightningStrikeCount: finite(obs.lightningStrikeCount ?? obs.lightning_strike_count) ?? 0,
    lightningStrikeLastAt: normalizeTempestTimestamp(obs.lightningStrikeLastAt ?? obs.lightning_strike_last_epoch ?? obs.lightning_strike_last_at),
    uv: finite(obs.uv),
    solar_radiation: finite(obs.solar_radiation ?? obs.solarRadiation),
    feels_like: finite(obs.feels_like) ?? airTemperature,
    timestamp: normalizeTempestTimestamp(obs.timestamp ?? obs.time)
  };
}

export function tempestObservationPrecipRate(obs) {
  if (!Array.isArray(obs)) return finite(obs?.precipRate ?? obs?.precip_rate) ?? 0;
  const precipAccum = finite(obs[12]) ?? 0;
  const reportIntervalMinutes = finite(obs[17]) ?? 1;
  return precipAccum > 0 && reportIntervalMinutes > 0
    ? precipAccum * (60 / reportIntervalMinutes)
    : 0;
}

export function normalizeTempestTimestamp(value) {
  if (!value) return null;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return numeric < 1e12 ? numeric * 1000 : numeric;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function deriveDewPointC(tempC, humidity) {
  if (!Number.isFinite(tempC) || !Number.isFinite(humidity) || humidity <= 0) return null;
  const a = 17.27;
  const b = 237.7;
  const alpha = (a * tempC) / (b + tempC) + Math.log(humidity / 100);
  return (b * alpha) / (a - alpha);
}

function finite(value) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
