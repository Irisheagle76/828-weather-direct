// ============================================================
// NORMALIZE OPEN-METEO HOURLY → CANONICAL FORMAT (v7 CLEAN)
// - Consistent camelCase (windSpeed, windGust)
// - Preserves nulls (no fake zeros for gusts)
// - Enforces timestamp correctness
// ============================================================

// ------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------
const toNumber = v => {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const cToF = c => (c != null ? (c * 9) / 5 + 32 : null);
const mpsToMph = m => (m != null ? m * 2.23694 : null);
const metersToMiles = m => (m != null ? m / 1609.34 : null);
const normalizeCloud = c => (c != null ? (c > 1 ? c / 100 : c) : null);

// Force timestamp → epoch ms
function toTimestamp(t) {
  if (!t) return null;

  if (typeof t === "number") return t;

  const ts = new Date(t).getTime();
  return Number.isFinite(ts) ? ts : null;
}

const pick = (src, i, ...keys) => {
  for (const k of keys) {
    const val = src[k]?.[i];
    if (val != null) return val;
  }
  return null;
};

// ------------------------------------------------------------
// DEWPOINT FALLBACK (Magnus)
// ------------------------------------------------------------
function estimateDewPointF(tempF, rh) {
  if (tempF == null || rh == null) return null;

  const T = (tempF - 32) * 5 / 9;
  const a = 17.625;
  const b = 243.04;

  const alpha =
    Math.log(rh / 100) +
    (a * T) / (b + T);

  const dewC = (b * alpha) / (a - alpha);

  return cToF(dewC);
}

// ------------------------------------------------------------
// MAIN
// ------------------------------------------------------------
export function normalizeOpenMeteo(hourly) {
  if (!hourly) return [];

  // ============================================================
  // CASE 1: Already array-like input
  // ============================================================
  if (Array.isArray(hourly)) {
    return hourly
      .map(h => {
        const ts = toTimestamp(h.timestamp ?? h.ts ?? h.time);
        if (!ts) return null;

        const tempF =
          toNumber(h.temperatureF) ??
          cToF(toNumber(h.temperature_2m)) ??
          toNumber(h.temp);

        const humidity =
          toNumber(h.relative_humidity) ??
          toNumber(h.humidity);

        const dewF =
          toNumber(h.dewpointF) ??
          toNumber(h.dew_point) ??
          cToF(toNumber(h.dew_point_2m)) ??
          estimateDewPointF(tempF, humidity);

        return {
          timestamp: ts,

          temperatureF: tempF,
          dewpointF: dewF,
          apparentF:
            toNumber(h.apparentF) ??
            cToF(toNumber(h.apparent_temperature)) ??
            tempF,

          relativeHumidity: humidity,

          windSpeed:
            mpsToMph(toNumber(h.wind_speed)) ??
            toNumber(h.windSpeed) ??
            null,

          windGust:
            mpsToMph(toNumber(h.wind_gust)) ??
            toNumber(h.windGust) ??
            null,

          windDir: toNumber(h.wind_dir),

          precipitation: toNumber(h.precipitation) ?? 0,
          snowfall: toNumber(h.snowfall) ?? 0,

          precipType:
            h.precipType ??
            (h.snowfall > 0
              ? "snow"
              : h.precipitation > 0
              ? "rain"
              : "none"),

          uvIndex: toNumber(h.uv_index) ?? 0,

          visibility:
            h.visibility != null
              ? metersToMiles(toNumber(h.visibility))
              : null,

          cloudCover: normalizeCloud(toNumber(h.cloud_cover)),

          // passthrough risks
          smokeIndex: h.smoke_index ?? 0,
          frostRisk: h.frost_risk ?? 0,
          freezeRisk: h.freeze_risk ?? 0,
          blackIceRisk: h.black_ice_risk ?? 0,
          inversionRisk: h.inversion_risk ?? 0,
          valleyFogRisk: h.valley_fog_risk ?? 0,
          ridgeFogRisk: h.ridge_fog_risk ?? 0
        };
      })
      .filter(Boolean);
  }

  // ============================================================
  // CASE 2: Open-Meteo columnar input
  // ============================================================

  if (!hourly?.time?.length) return [];

  const out = [];
  const len = hourly.time.length;

  for (let i = 0; i < len; i++) {
    const ts = toTimestamp(hourly.time[i]);
    if (!ts) continue;

    const tempF = cToF(toNumber(pick(hourly, i, "temperature_2m")));
    const humidity = toNumber(pick(hourly, i, "relative_humidity_2m"));

    const dewF =
      cToF(toNumber(pick(hourly, i, "dew_point_2m", "dewpoint_2m"))) ??
      estimateDewPointF(tempF, humidity);

    const windSpeed = mpsToMph(
      toNumber(pick(hourly, i, "wind_speed_10m", "windspeed_10m"))
    );

    const windGust = mpsToMph(
      toNumber(pick(hourly, i, "wind_gusts_10m"))
    );

    const precipitation = toNumber(pick(hourly, i, "precipitation")) ?? 0;
    const snowfall = toNumber(pick(hourly, i, "snowfall")) ?? 0;

    out.push({
      timestamp: ts,

      temperatureF: tempF,
      dewpointF: dewF,
      apparentF:
        cToF(toNumber(pick(hourly, i, "apparent_temperature"))) ?? tempF,

      relativeHumidity: humidity,

      windSpeed,
      windGust,
      windDir: toNumber(pick(hourly, i, "winddirection_10m")),

      precipitation,
      snowfall,
      precipType:
        snowfall > 0 ? "snow" :
        precipitation > 0 ? "rain" : "none",

      uvIndex: toNumber(pick(hourly, i, "uv_index")) ?? 0,

      visibility: (() => {
        const v = toNumber(pick(hourly, i, "visibility"));
        return v != null ? metersToMiles(v) : null;
      })(),

      cloudCover: normalizeCloud(
        toNumber(pick(hourly, i, "cloudcover"))
      ),

      smokeIndex: 0,
      frostRisk: 0,
      freezeRisk: 0,
      blackIceRisk: 0,
      inversionRisk: 0,
      valleyFogRisk: 0,
      ridgeFogRisk: 0
    });
  }

  return out;
}