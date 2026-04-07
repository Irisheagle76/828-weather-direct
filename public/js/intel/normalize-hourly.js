// ============================================================
// NORMALIZE OPEN-METEO HOURLY → CANONICAL FORMAT (v4)
// - Supports array OR columnar input
// - Never throws
// - Never returns malformed objects
// - Logs once per issue type (no spam)
// - Correct unit handling (Open-Meteo = Celsius)
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
  // CASE 1: ARRAY INPUT (already object-based)
  // ============================================================
  if (Array.isArray(hourly)) {
    return hourly
      .map(h => {
        const ts =
          h.timestamp ??
          (h.time ? toTimestamp(h.time) : null);

        if (ts == null) return null;

        return {
          temperature: h.temperature ?? null,
          dewpoint: h.dewpoint ?? null,
          apparent_temperature: h.apparent_temperature ?? null,

          temperatureF: h.temperatureF ?? cToF(h.temperature),
          dewpointF: h.dewpointF ?? cToF(h.dewpoint),
          apparentF: h.apparentF ?? cToF(h.apparent_temperature),

          relative_humidity: h.relative_humidity ?? null,

          wind_speed: h.wind_speed ?? h.wind ?? 0,
          wind_gust: h.wind_gust ?? 0,
          wind_dir: h.wind_dir ?? null,

          precipitation: h.precipitation ?? 0,
          snowfall: h.snowfall ?? 0,
          precipType:
            h.precipType ??
            (h.snowfall > 0
              ? "snow"
              : h.precipitation > 0
              ? "rain"
              : "none"),

          uv_index: h.uv_index ?? 0,
          visibility: h.visibility ?? null,
          cloud_cover: h.cloud_cover ?? null,

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
  // CASE 2: COLUMNAR (RAW OPEN-METEO)
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
    // METEOROLOGY (Celsius native)
    // -------------------------
    const tempF = toNumber(pick(hourly, i, "temperature_2m"));
const dewpointF = toNumber(pick(hourly, i, "dew_point_2m", "dewpoint_2m"));
const humidity = toNumber(pick(hourly, i, "relative_humidity_2m"));

const apparentF_raw = toNumber(pick(hourly, i, "apparent_temperature"));
const apparentF = apparentF_raw ?? tempF;

// derive Celsius ONLY if needed
const tempC = tempF != null ? (tempF - 32) * 5 / 9 : null;
const dewC = dewpointF != null ? (dewpointF - 32) * 5 / 9 : null;
const apparentC = apparentF != null ? (apparentF - 32) * 5 / 9 : null;

    // -------------------------
    // WIND
    // -------------------------
    const windSpeed =
      toNumber(pick(hourly, i, "wind_speed_10m", "windspeed_10m")) ?? 0;

  const windGust =
  toNumber(pick(hourly, i, "wind_gusts_10m")) ?? 0;

    const windDir = toNumber(pick(hourly, i, "winddirection_10m"));

    // -------------------------
    // PRECIP
    // -------------------------
    const precip = toNumber(pick(hourly, i, "precipitation")) ?? 0;
    const snow = toNumber(pick(hourly, i, "snowfall")) ?? 0;

    let precipType = "none";
    if (snow > 0) precipType = "snow";
    else if (precip > 0) precipType = "rain";

    // -------------------------
    // UV
    // -------------------------
    const uvRaw = toNumber(pick(hourly, i, "uv_index"));
    const uv = isNight ? 0 : uvRaw ?? 0;

    // -------------------------
    // CLOUD / VISIBILITY
    // -------------------------
    const cloud = normalizeCloud(
      toNumber(pick(hourly, i, "cloudcover"))
    );

    const visibilityRaw = toNumber(pick(hourly, i, "visibility"));
    const visibility =
      visibilityRaw != null ? toMiles(visibilityRaw) : null;

    // -------------------------
    // RISKS
    // -------------------------
    const frostRisk =
      tempC != null && dewC != null && tempC <= 3 && dewC <= 2
        ? 0.6
        : tempC != null && tempC <= 1
        ? 1
        : 0;

    const freezeRisk =
      tempC != null && tempC <= 0
        ? 1
        : tempC != null && tempC <= 1
        ? 0.5
        : 0;

    const blackIceRisk =
      tempC != null && tempC <= 0 && precip > 0 ? 1 : 0;

    const inversionRisk =
      tempC != null && tempC <= 4 && windSpeed < 3 ? 0.5 : 0;

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