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
              station_pressure:
                station_observation.station_pressure ??
                current_conditions.station_pressure ??
                null,
              pressure:
                current_conditions.pressure ??
                station_observation.pressure ??
                null
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
            timestamp: normalizeTs(obs[0])
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

// ------------------------------------------------------------
// TIMESTAMP NORMALIZER
// ------------------------------------------------------------
function normalizeTs(ts) {
  if (!ts) return Date.now();
  if (ts < 1e12) return ts * 1000;
  return ts;
}
