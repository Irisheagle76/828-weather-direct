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
    // 1b. STATION OBSERVATION (PRESSURE SOURCE)
    // ------------------------------------------------------------
    let station_observation = null;

    try {
      const obsUrl = `https://swd.weatherflow.com/swd/rest/observations/station/${stationId}?token=${token}`;
      const [r, stationMeta] = await Promise.all([
        fetch(obsUrl),
        fetchStationMeta(stationId, token)
      ]);

      if (r.ok) {
        const json = await r.json();
        const obs = json?.obs?.[0];

        if (obs) {
          station_observation = normalizeObsArray(obs);
          const seaLevelPressure = toSeaLevelPressure(
            station_observation.pressure,
            stationMeta?.elevationM
          );

          station_observation = {
            ...station_observation,
            station_pressure: station_observation.pressure,
            pressure: seaLevelPressure ?? station_observation.pressure,
            elevation_m: stationMeta?.elevationM ?? null
          };

          if (current_conditions) {
            current_conditions = {
              ...current_conditions,
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
      c.pressure ??
      c.station_pressure ??
      c.sea_level_pressure ??
      c.barometric_pressure ??
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
    pressure: obs[6] ?? null,
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
      obs.station_pressure ??
      obs.pressure ??
      obs.sea_level_pressure ??
      null,
    uv: obs.uv ?? null,
    solar_radiation: obs.solar_radiation ?? obs.solarRadiation ?? null,
    feels_like: obs.feels_like ?? airTemperature,
    timestamp: normalizeTs(obs.timestamp ?? obs.time)
  };
}

async function fetchStationMeta(stationId, token) {
  const urls = [
    `https://swd.weatherflow.com/swd/rest/stations/${stationId}?token=${token}`,
    `https://swd.weatherflow.com/swd/rest/station/${stationId}?token=${token}`,
    `https://swd.weatherflow.com/swd/rest/stations?token=${token}`
  ];

  for (const url of urls) {
    try {
      const r = await fetch(url);
      if (!r.ok) continue;

      const json = await r.json();
      const stations = Array.isArray(json?.stations) ? json.stations : [];
      const stationFromList = stations.find(s =>
        String(s?.station_id ?? s?.id) === String(stationId)
      );
      const station =
        stationFromList ??
        json?.station ??
        stations[0] ??
        json;

      const elevationM = pickElevationMeters(station) ?? findElevationMeters(station);
      if (Number.isFinite(elevationM)) return { elevationM };
    } catch (err) {
      console.warn("Station metadata error:", err);
    }
  }

  return null;
}

function pickElevationMeters(station = {}) {
  const raw =
    station.elevation_m ??
    station.elevation ??
    station.station_elevation ??
    station.location?.elevation ??
    station.location?.elevation_m ??
    null;

  if (!Number.isFinite(raw)) return null;

  const units = String(
    station.elevation_units ??
    station.units?.elevation ??
    ""
  ).toLowerCase();

  if (units.includes("ft") || raw > 3000) return raw * 0.3048;
  return raw;
}

function findElevationMeters(value, seen = new Set()) {
  if (!value || typeof value !== "object" || seen.has(value)) return null;
  seen.add(value);

  for (const [key, raw] of Object.entries(value)) {
    const lowerKey = key.toLowerCase();

    if (
      Number.isFinite(raw) &&
      (lowerKey === "elevation" ||
       lowerKey === "elevation_m" ||
       lowerKey === "station_elevation" ||
       lowerKey === "elev")
    ) {
      return lowerKey.includes("_m") || raw < 3000 ? raw : raw * 0.3048;
    }

    const nested = findElevationMeters(raw, seen);
    if (Number.isFinite(nested)) return nested;
  }

  return null;
}

function toSeaLevelPressure(stationPressureMb, elevationM) {
  if (!Number.isFinite(stationPressureMb) || !Number.isFinite(elevationM)) {
    return null;
  }

  return stationPressureMb / Math.pow(1 - elevationM / 44330, 5.255);
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
