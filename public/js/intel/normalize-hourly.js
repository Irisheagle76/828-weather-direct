// ============================================================
// NORMALIZE OPEN-METEO HOURLY PAYLOAD INTO CANONICAL FORMAT (v3)
// Supports BOTH:
//   1) Open-Meteo column format (API raw)
//   2) Array-of-objects format (already processed)
// Never returns null — always safe for downstream use
// ============================================================

export function normalizeOpenMeteo(hourly) {
  if (!hourly) {
    console.error("normalizeOpenMeteo: missing hourly input");
    return [];
  }

  // ============================================================
  // ✅ CASE 1: ARRAY INPUT (already object-based)
  // ============================================================
if (Array.isArray(hourly)) {
  return hourly
    .map(h => {
      const ts =
        h.timestamp ??
        (h.time ? new Date(h.time).getTime() : null);

      return {
        // Temps
        temperature: h.temperature ?? null,
        dewpoint: h.dewpoint ?? null,
        apparent_temperature: h.apparent_temperature ?? null,

        temperatureF: h.temperatureF ?? h.temperature ?? null,
        dewpointF: h.dewpointF ?? null,
        apparentF: h.apparentF ?? null,

        // Atmosphere
        relative_humidity: h.relative_humidity ?? null,

        // Wind
        wind_speed: h.wind_speed ?? h.wind ?? 0,
        wind_gust: h.wind_gust ?? 0,
        wind_dir: h.wind_dir ?? null,

        // Precip
        precipitation: h.precipitation ?? 0,
        snowfall: h.snowfall ?? 0,
        precipType:
          h.precipType ??
          (h.snowfall > 0
            ? "snow"
            : h.precipitation > 0
            ? "rain"
            : "none"),

        // Environment
        uv_index: h.uv_index ?? 0,
        visibility: h.visibility ?? null,
        cloud_cover: h.cloud_cover ?? null,

        // Risks
        smoke_index: h.smoke_index ?? 0,
        frost_risk: h.frost_risk ?? 0,
        freeze_risk: h.freeze_risk ?? 0,
        black_ice_risk: h.black_ice_risk ?? 0,
        inversion_risk: h.inversion_risk ?? 0,
        valley_fog_risk: h.valley_fog_risk ?? 0,
        ridge_fog_risk: h.ridge_fog_risk ?? 0,

        // ✅ FIXED
        timestamp: Number.isFinite(ts) ? ts : null
      };
    })
    .filter(h => h.timestamp && h.temperatureF != null);
}

  // ============================================================
  // ❌ INVALID INPUT
  // ============================================================
  if (!hourly?.time?.length) {
    console.error("normalizeOpenMeteo: invalid hourly payload", hourly);
    return [];
  }

  // ============================================================
  // ✅ CASE 2: COLUMNAR OPEN-METEO FORMAT (API RAW)
  // ============================================================
  const out = [];
  const len = hourly.time.length;

  for (let i = 0; i < len; i++) {
    // -------------------------
    // HELPERS
    // -------------------------
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

    const fToC = f => (f != null ? ((f - 32) * 5) / 9 : null);

    // -------------------------
    // TIME
    // -------------------------
    const ts = toTimestamp(hourly.time[i]);
    const hour = new Date(ts).getHours();
    const isNight = hour >= 18 || hour <= 6;

    // -------------------------
    // METEOROLOGY
    // -------------------------
    const tempF = num(pick("temperature_2m"));
   const dewpointF = num(pick("dew_point_2m", "dewpoint_2m"));
    const humidity = num(pick("relativehumidity_2m"));

    const apparentF_raw = num(pick("apparent_temperature"));
    const apparentF = apparentF_raw ?? tempF;

    const tempC = fToC(tempF);
    const dewC = fToC(dewpointF);
    const apparentC = fToC(apparentF);

    // -------------------------
    // WIND
    // -------------------------
    const windSpeed = num(pick("wind_speed_10m", "windspeed_10m")) ?? 0;
    const windGust = num(pick("wind_gusts_10m", "windgusts_10m")) ?? 0;
    const windDir = num(pick("winddirection_10m", "wind_dir"));

    // -------------------------
    // PRECIP
    // -------------------------
    const precip = num(pick("precipitation")) ?? 0;
    const snow = num(pick("snowfall")) ?? 0;

    let precipType = "none";
    if (snow > 0) precipType = "snow";
    else if (precip > 0) precipType = "rain";

    // -------------------------
    // UV
    // -------------------------
    const uvRaw = num(pick("uv_index"));
    const uv = isNight ? 0 : uvRaw;

    // -------------------------
    // CLOUD / VISIBILITY
    // -------------------------
    const cloud = normalizeCloud(num(pick("cloudcover")));

    const visibilityRaw = num(pick("visibility"));
    const visibility =
      visibilityRaw != null
        ? visibilityRaw > 1000
          ? toMiles(visibilityRaw)
          : visibilityRaw
        : null;

    // -------------------------
    // RISKS
    // -------------------------
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
      tempC != null && tempC <= 32 && precip > 0 ? 1 : 0;

    const inversionRisk =
      tempC != null && tempC <= 40 && windSpeed < 3 ? 0.5 : 0;

    const valleyFogRisk =
      humidity != null && humidity >= 95 && windSpeed < 3 ? 0.6 : 0;

    const ridgeFogRisk =
      humidity != null && humidity >= 98 && windSpeed < 5 ? 0.5 : 0;

    // -------------------------
    // OUTPUT
    // -------------------------
    out.push({
      temperature: tempC,
      dewpoint: dewC,
      apparent_temperature: apparentC,

      temperatureF: tempF,
      dewpointF,
      apparentF,

      relative_humidity: humidity,

      wind_speed: windSpeed,
      wind_gust: windGust,
      wind_dir: windDir,

      precipitation: precip,
      snowfall: snow,
      precipType,

      uv_index: uv,
      visibility,
      cloud_cover: cloud,

      smoke_index: 0,
      frost_risk: frostRisk,
      freeze_risk: freezeRisk,
      black_ice_risk: blackIceRisk,
      inversion_risk: inversionRisk,
      valley_fog_risk: valleyFogRisk,
      ridge_fog_risk: ridgeFogRisk,

      timestamp: ts
    });
  }

  return out;
}