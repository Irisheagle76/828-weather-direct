// ============================================================
// TEMPEST UNIFIED ENDPOINT — v4 (FULL + FIXED)
// ============================================================

export default async function handler(req, res) {
  try {
    const stationId = process.env.TEMPEST_STATION_ID;
    const token = process.env.TEMPEST_TOKEN;

    if (!token) {
      return res.status(200).json({
        current_conditions: null,
        wind_station: null,
        source: "no_token"
      });
    }

    // ------------------------------------------------------------
    // 1. CURRENT CONDITIONS (BETTER FORECAST)
    // ------------------------------------------------------------
    let current_conditions = null;

    try {
      const url = `https://swd.weatherflow.com/swd/rest/better_forecast?station_id=${stationId}&token=${token}`;
      const r = await fetch(url);

      if (r.ok) {
        const json = await r.json();

        const current =
          json?.current_conditions ||
          json?.forecast?.current_conditions ||
          null;

        if (current) {
          current_conditions = normalizeCurrent(current);
        }
      } else {
        console.warn("⚠️ Better forecast failed:", r.status);
      }
    } catch (err) {
      console.warn("⚠️ Better forecast error:", err);
    }

    // ------------------------------------------------------------
    // 1b. STATION OBSERVATION (RAW STATION PRESSURE BACKUP)
    // ------------------------------------------------------------
    let station_observation = null;

    try {
      const obsUrl = `https://swd.weatherflow.com/swd/rest/observations/station/${stationId}?token=${token}`;
      const r = await fetch(obsUrl);

      if (r.ok) {
        const json = await r.json();
        const obs = json?.obs?.[0];

        if (obs) {
          station_observation = normalizeObsArray(obs);
          station_observation = {
            ...station_observation,
            pressure: null
          };

          if (current_conditions) {
            current_conditions = {
              ...current_conditions,
              precipRate:
                station_observation.precipRate ??
                current_conditions.precipRate ??
                0,
              precipType:
                station_observation.precipType ??
                current_conditions.precipType ??
                null,
              rainRateObservedAt:
                station_observation.rainRateObservedAt ??
                station_observation.timestamp ??
                current_conditions.rainRateObservedAt ??
                current_conditions.timestamp,
              lightningStrikeDistance:
                station_observation.lightningStrikeDistance ??
                current_conditions.lightningStrikeDistance ??
                null,
              lightningStrikeCount:
                station_observation.lightningStrikeCount ??
                current_conditions.lightningStrikeCount ??
                0,
              station_pressure:
                station_observation.station_pressure ??
                current_conditions.station_pressure ??
                null,
              pressure:
                current_conditions.pressure ??
                station_observation.pressure ??
                null,
              timestamp:
                station_observation.timestamp ??
                current_conditions.timestamp
            };
          } else {
            current_conditions = station_observation;
          }
        }
      } else {
        console.warn("Station observation fetch failed:", r.status);
      }
    } catch (err) {
      console.warn("Station observation error:", err);
    }

    // ------------------------------------------------------------
    // 2. WIND STATION (EXPOSED SITE)
    // ------------------------------------------------------------
    let wind_station = null;

    try {
      const windUrl = `https://swd.weatherflow.com/swd/rest/observations/station/144737?token=${token}`;
      const r = await fetch(windUrl);

      if (r.ok) {
        const json = await r.json();
        const obs = json?.obs?.[0];

        if (obs) {
          wind_station = {
            windSpeed: obs[2],
            windGust: obs[3],
            precipRate: getObsPrecipRate(obs),
            rainRateObservedAt: normalizeTs(obs[0]),
            precipType: obs[13] ?? null,
            lightningStrikeDistance: obs[14] ?? null,
            lightningStrikeCount: obs[15] ?? 0,
            timestamp: normalizeTs(obs[0])
          };

          current_conditions = current_conditions
            ? {
                ...current_conditions,
                wind_avg: current_conditions.wind_avg ?? wind_station.windSpeed,
                wind_gust: current_conditions.wind_gust ?? wind_station.windGust,
                precipRate: current_conditions.precipRate ?? wind_station.precipRate,
                precipType: current_conditions.precipType ?? wind_station.precipType,
                rainRateObservedAt:
                  current_conditions.rainRateObservedAt ??
                  wind_station.rainRateObservedAt ??
                  current_conditions.timestamp ??
                  wind_station.timestamp,
                lightningStrikeDistance:
                  nearestDistance(
                    current_conditions.lightningStrikeDistance,
                    wind_station.lightningStrikeDistance
                  ),
                lightningStrikeCount: Math.max(
                  Number(current_conditions.lightningStrikeCount) || 0,
                  Number(wind_station.lightningStrikeCount) || 0
                ),
                timestamp: current_conditions.timestamp ?? wind_station.timestamp
              }
            : {
                wind_avg: wind_station.windSpeed,
                wind_gust: wind_station.windGust,
                precipRate: wind_station.precipRate,
                rainRateObservedAt: wind_station.rainRateObservedAt,
                precipType: wind_station.precipType,
                lightningStrikeDistance: wind_station.lightningStrikeDistance,
                lightningStrikeCount: wind_station.lightningStrikeCount,
                timestamp: wind_station.timestamp
              };
        }
      } else {
        console.warn("⚠️ Wind station fetch failed:", r.status);
      }
    } catch (err) {
      console.warn("⚠️ Wind station error:", err);
    }

    // ------------------------------------------------------------
    // 3. FINAL RESPONSE
    // ------------------------------------------------------------
    return res.status(200).json({
      current_conditions,
      station_observation,
      wind_station,
      source: "ok"
    });

  } catch (err) {
    console.error("🚨 Tempest handler crash:", err);

    return res.status(200).json({
      current_conditions: null,
      wind_station: null,
      source: "exception"
    });
  }
}

//
// ============================================================
// NORMALIZERS (UNCHANGED — KEPT INTACT)
// ============================================================
//

// ------------------------------------------------------------
// Better Forecast → normalize
// ------------------------------------------------------------
function normalizeCurrent(c) {
  return {
    air_temperature: c.air_temperature ?? null,
    dew_point: c.dew_point ?? null,
    relative_humidity: c.relative_humidity ?? null,
    wind_avg: c.wind_avg ?? null,
    wind_gust: c.wind_gust ?? null,
    wind_direction: c.wind_direction ?? null,
    pressure:
      c.sea_level_pressure ??
      c.barometric_pressure ??
      c.pressure ??
      null,
    station_pressure: c.station_pressure ?? null,
    sea_level_pressure: c.sea_level_pressure ?? null,
    barometric_pressure: c.barometric_pressure ?? null,
    precipRate: c.precip_rate ?? c.precipRate ?? 0,
    rainRateObservedAt: normalizeTs(c.timestamp),
    precipAccumLocalDay:
      c.precip_accum_local_day ??
      c.local_day_precip_accum ??
      null,
    precipType: c.precip_type ?? c.precipType ?? null,
    lightningStrikeCount:
      c.lightning_strike_count ??
      c.lightningStrikeCount ??
      0,
    lightningStrikeDistance:
      c.lightning_strike_last_distance ??
      c.lightning_strike_avg_distance ??
      c.lightningStrikeDistance ??
      null,
    feels_like: c.feels_like ?? c.air_temperature ?? null,
    uv: c.uv ?? null,
    solar_radiation: c.solar_radiation ?? null,
    timestamp: normalizeTs(c.timestamp)
  };
}

// ------------------------------------------------------------
// Device obs array → normalize (kept for compatibility)
// ------------------------------------------------------------
function normalizeObsArray(obs) {
  if (!Array.isArray(obs)) return normalizeObsObject(obs);

  const airTemperature = obs[7] ?? null;
  const relativeHumidity = obs[8] ?? null;

  return {
    air_temperature: airTemperature,
    relative_humidity: relativeHumidity,
    dew_point: deriveDewPointC(airTemperature, relativeHumidity),
    wind_avg: obs[2] ?? null,
    wind_gust: obs[3] ?? null,
    wind_direction: obs[4] ?? null,
    pressure: null,
    station_pressure: obs[6] ?? null,
    precipRate: getObsPrecipRate(obs),
    rainRateObservedAt: normalizeTs(obs[0]),
    precipAccum: obs[12] ?? null,
    precipType: obs[13] ?? null,
    lightningStrikeDistance: obs[14] ?? null,
    lightningStrikeCount: obs[15] ?? 0,
    uv: obs[10] ?? null,
    solar_radiation: obs[11] ?? null,
    feels_like: airTemperature,
    timestamp: normalizeTs(obs[0])
  };
}

function normalizeObsObject(obs = {}) {
  const airTemperature =
    obs.air_temperature ??
    obs.temperature ??
    obs.temp ??
    null;

  const relativeHumidity =
    obs.relative_humidity ??
    obs.humidity ??
    null;

  return {
    air_temperature: airTemperature,
    relative_humidity: relativeHumidity,
    dew_point:
      obs.dew_point ??
      deriveDewPointC(airTemperature, relativeHumidity),
    wind_avg: obs.wind_avg ?? obs.windSpeed ?? null,
    wind_gust: obs.wind_gust ?? obs.windGust ?? null,
    wind_direction: obs.wind_direction ?? obs.windDirection ?? null,
    pressure:
      obs.sea_level_pressure ??
      obs.barometric_pressure ??
      obs.pressure ??
      null,
    station_pressure: obs.station_pressure ?? null,
    sea_level_pressure: obs.sea_level_pressure ?? null,
    barometric_pressure: obs.barometric_pressure ?? null,
    precipRate: obs.precipRate ?? obs.precip_rate ?? 0,
    rainRateObservedAt: normalizeTs(
      obs.rainRateObservedAt ?? obs.timestamp ?? obs.time
    ),
    precipAccum:
      obs.precipAccum ??
      obs.precip_accum ??
      obs.rainAccum ??
      null,
    precipType: obs.precipType ?? obs.precip_type ?? null,
    lightningStrikeDistance:
      obs.lightningStrikeDistance ??
      obs.lightning_strike_last_distance ??
      obs.lightning_strike_avg_distance ??
      null,
    lightningStrikeCount:
      obs.lightningStrikeCount ??
      obs.lightning_strike_count ??
      0,
    uv: obs.uv ?? null,
    solar_radiation: obs.solar_radiation ?? obs.solarRadiation ?? null,
    feels_like: obs.feels_like ?? airTemperature,
    timestamp: normalizeTs(obs.timestamp ?? obs.time)
  };
}

function deriveDewPointC(tempC, rh) {
  if (!Number.isFinite(tempC) || !Number.isFinite(rh) || rh <= 0) return null;

  const a = 17.27;
  const b = 237.7;
  const alpha = ((a * tempC) / (b + tempC)) + Math.log(rh / 100);

  return (b * alpha) / (a - alpha);
}

function getObsPrecipRate(obs) {
  if (!Array.isArray(obs)) return 0;

  const precipAccum = obs[12] ?? 0;
  const reportIntervalMinutes = obs[17] ?? 1;

  return precipAccum > 0 && reportIntervalMinutes > 0
    ? precipAccum * (60 / reportIntervalMinutes)
    : 0;
}

function nearestDistance(...values) {
  const valid = values.map(Number).filter(Number.isFinite);
  return valid.length ? Math.min(...valid) : null;
}

// ------------------------------------------------------------
// TIMESTAMP NORMALIZER
// ------------------------------------------------------------
function normalizeTs(ts) {
  if (!ts) return null;
  if (ts < 1e12) return ts * 1000;
  return ts;
}
