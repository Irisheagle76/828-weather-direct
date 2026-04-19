// ============================================================
// TEMPEST UNIFIED ENDPOINT — v3 (MULTI-STATION READY)
// Supports:
//   - Better Forecast (stationId)
//   - Device Observations (deviceId)
//   - Secondary Wind Station (144737)
//
// Always returns:
// {
//   current_conditions: {...} | null,
//   wind_station: {...} | null
// }
// ============================================================

export default async function handler(req, res) {
  try {
    const { deviceId, stationId } = req.query;
const token = process.env.TEMPEST_TOKEN;

    if (!token) {
      return res.status(400).json({ error: "Missing Tempest token" });
    }

    // ------------------------------------------------------------
    // 🆕 FETCH EXPOSED WIND STATION (144737)
    // ------------------------------------------------------------
    let windStation = null;

    try {
      const windUrl = `https://swd.weatherflow.com/swd/rest/observations/station/144737?token=${token}`;
      const r = await fetch(windUrl);

      if (r.ok) {
        const json = await r.json();
        const obs = json?.obs?.[0];

        if (obs) {
          windStation = {
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
    // 1. TRY BETTER FORECAST (station-level)
    // ------------------------------------------------------------
    if (stationId) {
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
            return res.status(200).json({
              current_conditions: normalizeCurrent(current),
              wind_station: windStation,
              source: "better_forecast"
            });
          }

          console.warn("⚠️ No current_conditions in better_forecast");
        } else {
          console.warn("⚠️ Better forecast failed:", r.status);
        }
      } catch (err) {
        console.warn("⚠️ Better forecast error:", err);
      }
    }

    // ------------------------------------------------------------
    // 2. FALL BACK TO DEVICE OBS
    // ------------------------------------------------------------
    if (deviceId) {
      try {
        const url = `https://swd.weatherflow.com/swd/rest/observations/device/${deviceId}?token=${token}`;
        const r = await fetch(url);

        if (r.ok) {
          const json = await r.json();
          const obs = json?.obs?.[0];

          if (obs) {
            return res.status(200).json({
              current_conditions: normalizeObsArray(obs),
              wind_station: windStation,
              source: "device_obs"
            });
          }

          console.warn("⚠️ No obs data");
        } else {
          console.warn("⚠️ Device obs failed:", r.status);
        }
      } catch (err) {
        console.warn("⚠️ Device obs error:", err);
      }
    }

    // ------------------------------------------------------------
    // 3. FINAL FALLBACK
    // ------------------------------------------------------------
    return res.status(200).json({
      current_conditions: null,
      wind_station: windStation,
      source: "none"
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

// ============================================================
// NORMALIZERS
// ============================================================

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
    pressure: c.pressure ?? null,
    feels_like: c.feels_like ?? c.air_temperature ?? null,
    uv: c.uv ?? null,
    solar_radiation: c.solar_radiation ?? null,
    timestamp: normalizeTs(c.timestamp)
  };
}

// ------------------------------------------------------------
// Device obs array → normalize
// ------------------------------------------------------------
function normalizeObsArray(obs) {
  return {
    air_temperature: obs[7] ?? null,
    relative_humidity: obs[8] ?? null,
    dew_point: obs[6] ?? null,
    wind_avg: obs[2] ?? null,
    wind_gust: obs[3] ?? null,
    wind_direction: obs[4] ?? null,
    pressure: obs[9] ?? null,
    uv: obs[10] ?? null,
    solar_radiation: obs[11] ?? null,
    feels_like: obs[7] ?? null,
    timestamp: normalizeTs(obs[0])
  };
}

// ------------------------------------------------------------
// TIMESTAMP NORMALIZER
// ------------------------------------------------------------
function normalizeTs(ts) {
  if (!ts) return Date.now();
  if (ts < 1e12) return ts * 1000;
  return ts;
}