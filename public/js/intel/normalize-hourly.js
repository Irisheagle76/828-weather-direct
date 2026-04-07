// ============================================================
// NORMALIZE OPEN-METEO HOURLY → CANONICAL FORMAT (v5)
// - Supports array OR columnar input
// - Never throws
// - Never returns malformed objects
// - Logs once per issue type (no spam)
// - Correct unit handling
//   - Array input: may be Celsius → uses cToF if needed
//   - Columnar Open-Meteo: already Fahrenheit → NO conversion
// ============================================================

let warned = new Set();
const warnOnce = (msg, data) => {
  if (!warned.has(msg)) {
    console.warn(msg, data ?? "");
    warned.add(msg);
  }
};

// ------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------
const toNumber = v => {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const cToF = c => (c != null ? (c * 9) / 5 + 32 : null);

const toMiles = m => (m != null ? m / 1609.34 : null);

const normalizeCloud = c =>
  c != null ? (c > 1 ? c / 100 : c) : null;

const toTimestamp = t => {
  const ts = new Date(t).getTime();
  return Number.isFinite(ts) ? ts : null;
};

const pick = (src, i, ...keys) => {
  for (const k of keys) {
    const val = src[k]?.[i];
    if (val != null) return val;
  }
  return null;
};

// ------------------------------------------------------------
// MAIN
// ------------------------------------------------------------
export function normalizeOpenMeteo(hourly) {
  if (!hourly) {
    warnOnce("normalizeOpenMeteo: missing hourly input");
    return [];
  }

  // ============================================================
  // CASE 1: ARRAY INPUT (already object-based, canonical-ish)
  // ============================================================
  if (Array.isArray(hourly)) {
    return hourly
      .map(h => {
        const ts =
          h.timestamp ??
          (h.time ? toTimestamp(h.time) : null);

        if (ts == null) return null;

        const tempC = toNumber(h.temperature);
        const dewC  = toNumber(h.dewpoint);
        const appC  = toNumber(h.apparent_temperature);

        // For array input we still allow Celsius → Fahrenheit
        const temperatureF = h.temperatureF ?? cToF(tempC);
        const dewpointF    = h.dewpointF ?? cToF(dewC);
        const apparentF    = h.apparentF ?? cToF(appC);

        const humidity = toNumber(h.relative_humidity);

        const wind_speed = toNumber(h.wind_speed ?? h.wind) ?? 0;
        const wind_gust  = toNumber(h.wind_gust) ?? 0;
        const wind_dir   = toNumber(h.wind_dir);

        const precipitation = toNumber(h.precipitation) ?? 0;
        const snowfall      = toNumber(h.snowfall) ?? 0;

        const precipType =
          h.precipType ??
          (snowfall > 0
            ? "snow"
            : precipitation > 0
            ? "rain"
            : "none");

        const uv_index  = toNumber(h.uv_index) ?? 0;
        const visibility = h.visibility ?? null;
        const cloud_cover = h.cloud_cover ?? null;

        return {
          temperatureF,
          dewpointF,
          apparentF,

          relative_humidity: humidity,

          wind_speed,
          wind_gust,
          wind_dir,

          precipitation,
          snowfall,
          precipType,

          uv_index,
          visibility,
          cloud_cover,

          smoke_index: h.smoke_index ?? 0,
          frost_risk: h.frost_risk ?? 0,
          freeze_risk: h.freeze_risk ?? 0,
          black_ice_risk: h.black_ice_risk ?? 0,
          inversion_risk: h.inversion_risk ?? 0,
          valley_fog_risk: h.valley_fog_risk ?? 0,
          ridge_fog_risk: h.ridge_fog_risk ?? 0,

          timestamp: ts
        };
      })
      .filter(Boolean);
  }

  // ============================================================
  // CASE 2: COLUMNAR (RAW OPEN-METEO, NOW FAHRENHEIT INPUTS)
  // ============================================================
  if (!hourly?.time?.length) {
    warnOnce("normalizeOpenMeteo: invalid hourly payload", hourly);
    return [];
  }

  const out = [];
  const len = hourly.time.length;

  for (let i = 0; i < len; i++) {
    const ts = toTimestamp(hourly.time[i]);
    if (ts == null) continue;

    const hour = new Date(ts).getHours();
    const isNight = hour >= 18 || hour <= 6;

    // -------------------------
    // METEOROLOGY (Open-Meteo = Fahrenheit now)
    // -------------------------
    const tempF = toNumber(pick(hourly, i, "temperature_2m"));
    const dewF  = toNumber(pick(hourly, i, "dew_point_2m", "dewpoint_2m"));
    const appF_raw = toNumber(pick(hourly, i, "apparent_temperature"));

    const apparentF = appF_raw ?? tempF;

    const temperatureF = tempF;
    const dewpointF    = dewF;

    const humidity = toNumber(pick(hourly, i, "relative_humidity_2m"));

    // sanity check (physics only, still valid in °F)
    if (temperatureF != null && dewpointF != null && dewpointF > temperatureF) {
      warnOnce("🔥 UNIT BUG DETECTED (dewpoint > temp)", {
        temperatureF,
        dewpointF
      });
    }

    // -------------------------
    // WIND
    // -------------------------
    const wind_speed =
      toNumber(pick(hourly, i, "wind_speed_10m", "windspeed_10m")) ?? 0;

    const wind_gust =
      toNumber(pick(hourly, i, "wind_gusts_10m")) ?? 0;

    const wind_dir = toNumber(pick(hourly, i, "winddirection_10m"));

    // -------------------------
    // PRECIP
    // -------------------------
    const precipitation = toNumber(pick(hourly, i, "precipitation")) ?? 0;
    const snowfall      = toNumber(pick(hourly, i, "snowfall")) ?? 0;

    let precipType = "none";
    if (snowfall > 0) precipType = "snow";
    else if (precipitation > 0) precipType = "rain";

    // -------------------------
    // UV
    // -------------------------
    const uvRaw = toNumber(pick(hourly, i, "uv_index"));
    const uv_index = isNight ? 0 : uvRaw ?? 0;

    // -------------------------
    // CLOUD / VISIBILITY
    // -------------------------
    const cloud_cover = normalizeCloud(
      toNumber(pick(hourly, i, "cloudcover"))
    );

    const visibilityRaw = toNumber(pick(hourly, i, "visibility"));
    const visibility =
      visibilityRaw != null ? toMiles(visibilityRaw) : null;

    // -------------------------
    // RISKS (still using thresholds, now on °F inputs)
    // -------------------------
    // You can later convert to °C internally if you want,
    // but this keeps behavior simple and avoids unit guessing.
    const frost_risk =
      temperatureF != null && dewpointF != null && temperatureF <= 38 && dewpointF <= 36
        ? 0.6
        : temperatureF != null && temperatureF <= 34
        ? 1
        : 0;

    const freeze_risk =
      temperatureF != null && temperatureF <= 32
        ? 1
        : temperatureF != null && temperatureF <= 34
        ? 0.5
        : 0;

    const black_ice_risk =
      temperatureF != null && temperatureF <= 32 && precipitation > 0 ? 1 : 0;

    const inversion_risk =
      temperatureF != null && temperatureF <= 40 && wind_speed < 3 ? 0.5 : 0;

    const valley_fog_risk =
      humidity != null && humidity >= 95 && wind_speed < 3 ? 0.6 : 0;

    const ridge_fog_risk =
      humidity != null && humidity >= 98 && wind_speed < 5 ? 0.5 : 0;

    // -------------------------
    // OUTPUT
    // -------------------------
    out.push({
      temperatureF,
      dewpointF,
      apparentF,

      relative_humidity: humidity,

      wind_speed,
      wind_gust,
      wind_dir,

      precipitation,
      snowfall,
      precipType,

      uv_index,
      visibility,
      cloud_cover,

      smoke_index: 0,
      frost_risk,
      freeze_risk,
      black_ice_risk,
      inversion_risk,
      valley_fog_risk,
      ridge_fog_risk,

      timestamp: ts
    });
  }

  return out;
}