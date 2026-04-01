// /js/intel/normalize-hourly.js
// ============================================================
// NORMALIZE OPEN-METEO HOURLY PAYLOAD INTO CANONICAL FORMAT
// ============================================================

export function normalizeOpenMeteo(hourly) {
  if (!hourly?.time?.length) {
    console.error("normalizeOpenMeteo: invalid hourly payload", hourly);
    return [];
  }

  const out = [];

  for (let i = 0; i < hourly.time.length; i++) {
    const pick = (...keys) => {
      for (const k of keys) {
        const val = hourly[k]?.[i];
        if (val != null) return val;
      }
      return null;
    };

    const num = v => {
      const n = Number(v);
      return typeof n === "number" && !isNaN(n) ? n : null;
    };

    // ------------------------------------------------------------
    // CORE METEOROLOGICAL FIELDS
    // ------------------------------------------------------------
    // IMPORTANT:
    // temperature_2m and apparent_temperature are already Fahrenheit
    // dewpoint_2m is ALWAYS Celsius (Open-Meteo does not support dewpoint_unit)
    const tempF_raw = num(pick("temperature_2m"));
    const dewC_raw = num(pick("dewpoint_2m"));
    const humidity = num(pick("relativehumidity_2m"));

    // ------------------------------------------------------------
    // WIND (already normalized by backend to mph)
    // ------------------------------------------------------------
    const windSpeed = num(pick("wind_speed_10m", "windspeed_10m"));
    const windGust = num(pick("wind_gusts_10m", "windgusts_10m"));
    const windDir = num(pick("winddirection_10m", "wind_dir"));

    // ------------------------------------------------------------
    // PRECIP, CLOUD, VISIBILITY, UV
    // ------------------------------------------------------------
    const precip = num(pick("precipitation"));
    const snow = num(pick("snowfall"));
    const uv = num(pick("uv_index"));

    // Cloud cover normalization (0–100 → 0–1)
    let cloud = num(pick("cloudcover"));
    if (cloud != null && cloud > 1) cloud = cloud / 100;

    // Visibility normalization (meters → miles)
    let visibility = num(pick("visibility"));
    if (visibility != null && visibility > 100) {
      visibility = visibility / 1609.34;
    }

    // Apparent temperature (already Fahrenheit)
    const apparentF_raw = num(pick("apparent_temperature"));
    const apparentF = apparentF_raw != null ? apparentF_raw : tempF_raw;

    // Timestamp
    const rawTs = new Date(hourly.time[i]).getTime();
    const ts = !isNaN(rawTs) ? rawTs : Date.now();

    // ------------------------------------------------------------
    // RISK INDICES (computed in Celsius)
    // ------------------------------------------------------------
    // Convert tempF_raw back to C for risk logic
    const tempC = tempF_raw != null ? fToC(tempF_raw) : null;
    const dewC = dewC_raw;

    const frostRisk =
      tempC != null && dewC != null && tempC <= 37 && dewC <= 36
        ? 0.6
        : tempC != null && tempC <= 34
        ? 1
        : 0;

    const freezeRisk =
      tempC != null && tempC <= 32
        ? 1
        : tempC != null && tempC <= 34
        ? 0.5
        : 0;

    const blackIceRisk =
      tempC != null && tempC <= 32 && (precip ?? 0) > 0 ? 1 : 0;

    const inversionRisk =
      tempC != null && tempC <= 40 && (windSpeed ?? 0) < 3 ? 0.5 : 0;

    const valleyFogRisk =
      humidity != null &&
      humidity >= 95 &&
      windSpeed != null &&
      windSpeed < 3
        ? 0.6
        : 0;

    const ridgeFogRisk =
      humidity != null &&
      humidity >= 98 &&
      windSpeed != null &&
      windSpeed < 5
        ? 0.5
        : 0;

    // ------------------------------------------------------------
    // SAFE DEWPOINT FIX (NO DRIFT)
    // ------------------------------------------------------------
    // dewpoint_2m is ALWAYS Celsius from Open-Meteo.
    // Convert ONLY if value is clearly Celsius (< 60°F).
    let dewpointF = null;
    if (dewC_raw != null) {
      dewpointF = dewC_raw < 60 ? cToF(dewC_raw) : dewC_raw;
    }

    // ------------------------------------------------------------
    // CANONICAL NORMALIZED OBJECT
    // ------------------------------------------------------------
    out.push({
      // Raw Celsius values (for risk logic)
      temperature: tempC,
      dewpoint: dewC,
      apparent_temperature: fToC(apparentF),

      // Canonical Fahrenheit (for comfort engine)
      temperatureF: tempF_raw,
      dewpointF,
      apparentF,

      // Humidity
      relative_humidity: humidity,

      // Wind
      wind_speed: windSpeed,
      wind_gust: windGust,
      wind_dir: windDir,

      // Precip / cloud / visibility / UV
      precipitation: precip,
      snowfall: snow,
      uv_index: uv,
      visibility,
      cloud_cover: cloud,

      // Risk indices
      smoke_index: 0,
      frost_risk: frostRisk,
      freeze_risk: freezeRisk,
      black_ice_risk: blackIceRisk,
      inversion_risk: inversionRisk,
      valley_fog_risk: valleyFogRisk,
      ridge_fog_risk: ridgeFogRisk,

      // Timestamp
      timestamp: ts
    });
  }

  return out;
}

// Celsius → Fahrenheit
function cToF(c) {
  return (c * 9) / 5 + 32;
}

// Fahrenheit → Celsius
function fToC(f) {
  return ((f - 32) * 5) / 9;
}
