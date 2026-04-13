// ============================================================
// NORMALIZE OPEN-METEO HOURLY → CANONICAL FORMAT (v5)
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
const normalizeCloud = c => (c != null ? (c > 1 ? c / 100 : c) : null);

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

  // 🔴 TRACE: RAW INPUT SAMPLE
  if (hourly?.temperature_2m?.length) {
    console.log("🟡 RAW OPEN-METEO SAMPLE", {
      temp: hourly.temperature_2m[12],
      dew: hourly.dew_point_2m?.[12] ?? hourly.dewpoint_2m?.[12],
      time: hourly.time?.[12]
    });
  }

// ============================================================
// CASE 1: ARRAY INPUT (with Magnus dew point equation)
// ============================================================
if (Array.isArray(hourly)) {
  return hourly
    .map((h, i) => {

      // 🧪 TRACE RAW ARRAY INPUT
      if (i === 12) {
        console.log("🧪 RAW ARRAY HOUR", h);
      }

      const ts =
        h.timestamp ??
        (h.time ? toTimestamp(h.time) : null);

      if (ts == null) return null;

      const temperatureF =
        toNumber(h.temperatureF) ??
        toNumber(h.temp);

      const humidity =
        toNumber(h.relative_humidity) ??
        toNumber(h.humidity);

      // ------------------------------------------------------------
      // 🌡️ Magnus Dew Point Fallback (accurate, meteorologist-grade)
      // ------------------------------------------------------------
      const estimateDewPoint = (tempF, rh) => {
        if (tempF == null || rh == null) return null;

        const T = (tempF - 32) * 5/9; // °C
        const RH = rh;

        // Magnus constants (over water)
        const a = 17.625;
        const b = 243.04;

        const alpha =
          Math.log(RH / 100) +
          (a * T) / (b + T);

        const dewC =
          (b * alpha) /
          (a - alpha);

        return (dewC * 9/5) + 32; // back to °F
      };

      const dewpointF =
        toNumber(h.dewpointF) ??
        toNumber(h.dewPoint) ??
        toNumber(h.dew_point) ??
        estimateDewPoint(temperatureF, humidity);

      const apparentF =
        toNumber(h.apparentF) ??
        toNumber(h.apparent_temperature) ??
        temperatureF;

      // 🟢 TRACE NORMALIZED
      if (i === 12) {
        console.log("🟢 NORMALIZED HOUR (ARRAY)", {
          temperatureF,
          dewpointF,
          apparentF,
          humidity
        });
      }

      return {
        temperatureF,
        dewpointF,
        apparentF,

        relative_humidity: humidity,

        wind_speed: toNumber(h.wind_speed ?? h.wind) ?? 0,
        wind_gust: toNumber(h.wind_gust) ?? 0,
        wind_dir: toNumber(h.wind_dir),

        precipitation: toNumber(h.precipitation) ?? 0,
        snowfall: toNumber(h.snowfall) ?? 0,

        precipType:
          h.precipType ??
          (h.snowfall > 0
            ? "snow"
            : h.precipitation > 0
            ? "rain"
            : "none"),

        uv_index: toNumber(h.uv_index) ?? 0,
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
// CASE 2: COLUMNAR INPUT (UNCHANGED, just cleaned slightly)
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

  const temperatureF = toNumber(pick(hourly, i, "temperature_2m"));
  const dewpointF    = toNumber(pick(hourly, i, "dew_point_2m", "dewpoint_2m"));
  const apparentF    = toNumber(pick(hourly, i, "apparent_temperature")) ?? temperatureF;

  const humidity = toNumber(pick(hourly, i, "relative_humidity_2m"));

  // 🟢 TRACE
  if (i === 12) {
    console.log("🟢 NORMALIZED HOUR", {
      temperatureF,
      dewpointF,
      apparentF
    });
  }

  const wind_speed =
    toNumber(pick(hourly, i, "wind_speed_10m", "windspeed_10m")) ?? 0;

  const wind_gust =
    toNumber(pick(hourly, i, "wind_gusts_10m")) ?? 0;

  const wind_dir = toNumber(pick(hourly, i, "winddirection_10m"));

  const precipitation = toNumber(pick(hourly, i, "precipitation")) ?? 0;
  const snowfall      = toNumber(pick(hourly, i, "snowfall")) ?? 0;

  const precipType =
    snowfall > 0 ? "snow" :
    precipitation > 0 ? "rain" : "none";

  const uv_index = toNumber(pick(hourly, i, "uv_index")) ?? 0;

  const cloud_cover = normalizeCloud(
    toNumber(pick(hourly, i, "cloudcover"))
  );

  const visibilityRaw = toNumber(pick(hourly, i, "visibility"));
  const visibility =
    visibilityRaw != null ? toMiles(visibilityRaw) : null;

  // 🔵 TRACE FINAL OBJECT
  if (i === 12) {
    console.log("🔵 FINAL NORMALIZED OBJECT", {
      temperatureF,
      dewpointF,
      apparentF,
      humidity,
      wind_speed
    });
  }

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
    frost_risk: 0,
    freeze_risk: 0,
    black_ice_risk: 0,
    inversion_risk: 0,
    valley_fog_risk: 0,
    ridge_fog_risk: 0,

    timestamp: ts
  });
}

return out;
}