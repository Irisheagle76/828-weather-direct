// ============================================================
// TEMPEST UNIFIED ENDPOINT — v2 (STABLE + NORMALIZED)
// Supports:
//   - Better Forecast (stationId)
//   - Device Observations (deviceId)
// Always returns:
//   { current_conditions: {...} | null }
// ============================================================

export default async function handler(req, res) {
  try {
    const { deviceId, stationId, token } = req.query;

    if (!token) {
      return res.status(400).json({ error: "Missing Tempest token" });
    }

    let data = null;

    // ------------------------------------------------------------
    // 1. TRY BETTER FORECAST (station-level)
    // ------------------------------------------------------------
    if (stationId) {
      try {
        const url = `https://swd.weatherflow.com/swd/rest/better_forecast?station_id=${stationId}&token=${token}`;
        const r = await fetch(url);

        if (r.ok) {
          const json = await r.json();

          // normalize possible shapes
          const current =
            json?.current_conditions ||
            json?.forecast?.current_conditions ||
            null;

          if (current) {
            return res.status(200).json({
              current_conditions: normalizeCurrent(current),
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

          const obs = json?.obs?.[0]; // latest observation row

          if (obs) {
            return res.status(200).json({
              current_conditions: normalizeObsArray(obs),
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
      source: "none"
    });

  } catch (err) {
    console.error("🚨 Tempest handler crash:", err);

    return res.status(200).json({
      current_conditions: null,
      source: "exception"
    });
  }
}

//
// ============================================================
// NORMALIZERS
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