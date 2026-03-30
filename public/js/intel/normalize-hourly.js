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

    // Core meteorological fields
    const temp = num(pick("temperature_2m"));
    const dew = num(pick("dewpoint_2m"));
    const humidity = num(pick("relativehumidity_2m"));

    // Canonical wind fields
  const windSpeed = num(pick("wind_speed_10m", "windspeed_10m"));
const windGust = num(pick("wind_gusts_10m", "windgusts_10m"));

    // NEW: Canonical wind direction
    const windDir = num(pick("winddirection_10m", "wind_dir"));

 // Precipitation & visibility (HARDENED)

// Raw numeric extraction (no fake defaults)
const precip = num(pick("precipitation"));
const snow = num(pick("snowfall"));
const uv = num(pick("uv_index"));

// Cloud cover normalization (handle 0–100 vs 0–1)
let cloud = num(pick("cloudcover"));
if (cloud != null && cloud > 1) {
  cloud = cloud / 100;
}

// Visibility normalization (meters → miles if needed)
let visibility = num(pick("visibility"));
if (visibility != null && visibility > 100) {
  visibility = visibility / 1609.34;
}

    // Apparent temperature fallback
    const apparentRaw = num(pick("apparent_temperature"));
const apparent = apparentRaw != null ? apparentRaw : temp;

    // Timestamp
   const rawTs = new Date(hourly.time[i]).getTime();
const ts = !isNaN(rawTs) ? rawTs : Date.now();

// Risk indices

const frostRisk =
  temp != null && dew != null && temp <= 37 && dew <= 36
    ? 0.6
    : temp != null && temp <= 34
    ? 1
    : 0;

const freezeRisk =
  temp != null && temp <= 32
    ? 1
    : temp != null && temp <= 34
    ? 0.5
    : 0;

const blackIceRisk =
  temp != null && temp <= 32 && (precip ?? 0) > 0 ? 1 : 0;

const inversionRisk =
  temp != null && temp <= 40 && (windSpeed ?? 0) < 3 ? 0.5 : 0;

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

    // Canonical normalized object
    out.push({
      temperature: temp,
      apparent_temperature: apparent,
      dewpoint: dew,
      relative_humidity: humidity,

      wind_speed: windSpeed,
      wind_gust: windGust,
      wind_dir: windDir,

      precipitation: precip,
      snowfall: snow,
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

