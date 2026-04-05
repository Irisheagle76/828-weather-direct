// ============================================================
// NORMALIZE OPEN-METEO HOURLY PAYLOAD INTO CANONICAL FORMAT
// ============================================================

export function normalizeOpenMeteo(hourly) {
  if (!hourly?.time?.length) {
    console.error("normalizeOpenMeteo: invalid hourly payload", hourly);
    return [];
  }

  const out = [];
  const len = hourly.time.length;

  for (let i = 0; i < len; i++) {
    // ------------------------------------------------------------
    // HELPERS
    // ------------------------------------------------------------
    const pick = (...keys) => {
      for (const k of keys) {
        const val = hourly[k]?.[i];
        if (val != null) return val;
      }
      return null;
    };

    const num = v => {
      if (v == null) return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };

    const toMiles = m => (m != null ? m / 1609.34 : null);
    const normalizeCloud = c =>
      c != null ? (c > 1 ? c / 100 : c) : null;

    const toTimestamp = t => {
      const ts = new Date(t).getTime();
      return Number.isFinite(ts) ? ts : Date.now();
    };

    // ------------------------------------------------------------
    // CORE METEOROLOGICAL FIELDS
    // ------------------------------------------------------------
    const tempF = num(pick("temperature_2m"));
    const dewpointF = num(pick("dewpoint_2m"));
    const humidity = num(pick("relativehumidity_2m"));

    const apparentF_raw = num(pick("apparent_temperature"));
    const apparentF = apparentF_raw ?? tempF;

    // Convert to Celsius for internal logic
    const tempC = tempF != null ? fToC(tempF) : null;
    const dewC = dewpointF != null ? fToC(dewpointF) : null;
    const apparentC = apparentF != null ? fToC(apparentF) : null;

    // ------------------------------------------------------------
    // WIND (already mph from backend)
    // ------------------------------------------------------------
    const windSpeed = num(pick("wind_speed_10m", "windspeed_10m"));
    const windGust = num(pick("wind_gusts_10m", "windgusts_10m"));
    const windDir = num(pick("winddirection_10m", "wind_dir"));

    // ------------------------------------------------------------
    // PRECIP / CLOUD / VISIBILITY / UV
    // ------------------------------------------------------------
    const precip = num(pick("precipitation"));
    const snow = num(pick("snowfall"));
    const uv = num(pick("uv_index"));

    const cloud = normalizeCloud(num(pick("cloudcover")));
    const visibilityRaw = num(pick("visibility"));
    const visibility =
      visibilityRaw != null && visibilityRaw > 100
        ? toMiles(visibilityRaw)
        : visibilityRaw;

    // ------------------------------------------------------------
    // TIMESTAMP (CRITICAL FOR ALL DOWNSTREAM LOGIC)
    // ------------------------------------------------------------
    const ts = toTimestamp(hourly.time[i]);

    // ------------------------------------------------------------
    // RISK INDICES (UNCHANGED LOGIC, CLEANED STRUCTURE)
    // ------------------------------------------------------------
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
    // OUTPUT OBJECT (UNCHANGED STRUCTURE)
    // ------------------------------------------------------------
    out.push({
      // Celsius (internal logic)
      temperature: tempC,
      dewpoint: dewC,
      apparent_temperature: apparentC,

      // Fahrenheit (UI / comfort engine)
      temperatureF: tempF,
      dewpointF,
      apparentF,

      // Humidity
      relative_humidity: humidity,

      // Wind
      wind_speed: windSpeed,
      wind_gust: windGust,
      wind_dir: windDir,

      // Atmospherics
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

      // Timestamp (ms, guaranteed valid)
      timestamp: ts
    });
  }

  return out;
}

// ------------------------------------------------------------
// UNIT HELPERS
// ------------------------------------------------------------
function fToC(f) {
  return ((f - 32) * 5) / 9;
}

function cToF(c) {
  return (c * 9) / 5 + 32;
}