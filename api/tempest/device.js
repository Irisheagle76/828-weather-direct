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
    pressure: c.pressure ?? null,
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