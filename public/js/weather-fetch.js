// /js/weather-fetch.js
// ============================================================
// FETCH HELPERS — Weather Underground, Open-Meteo, Tempest, MRMS
// ============================================================

// ------------------------------------------------------------
// 1. WEATHER UNDERGROUND — NEAREST STATION
// ------------------------------------------------------------
export async function getNearestWUStation(lat, lon) {
  const url = `https://api.weather.com/v3/location/near?geocode=${lat},${lon}&product=pws&format=json&apiKey=09a5bd1deb4948caa5bd1deb4968cab8`;

  const res = await fetch(url);
  if (!res.ok) throw new Error("WU nearest station lookup failed");

  const data = await res.json();
  const stationId = data.location?.stationId?.[0] ?? null;

  if (!stationId) throw new Error("No nearby WU station found");

  return { stationId };
}


// ------------------------------------------------------------
// 2. WEATHER UNDERGROUND — CURRENT CONDITIONS
// ------------------------------------------------------------
export async function getWUCurrentConditions(stationId) {
  const url = `https://api.weather.com/v2/pws/observations/current?stationId=${stationId}&format=json&units=e&apiKey=09a5bd1deb4948caa5bd1deb4968cab8`;

  const res = await fetch(url);
  if (!res.ok) throw new Error("WU current conditions fetch failed");

  return await res.json();
}


// ------------------------------------------------------------
// 3. OPEN-METEO — SMART MODEL SELECTION + FALLBACK
// ------------------------------------------------------------

/*
  Smart model engine:
  - Try HRRR first (best for US, high resolution)
  - If HRRR returns no hourly block → fallback to GFS
  - If GFS also fails → fallback to ICON
  - Always return:
      { data, modelUsed }
*/

export async function getShortTermForecast(lat, lon) {
  const modelsToTry = ["hrrr", "gfs", "icon"];
  let lastError = null;

  for (const model of modelsToTry) {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&hourly=temperature_2m,dewpoint_2m,rain,snowfall,wind_speed_10m,wind_gusts_10m,uv_index,cloudcover` +
      `&forecast_days=2&timezone=auto&models=${model}`;

    console.log(`Trying Open-Meteo model: ${model}`);
    console.log("Open-Meteo URL:", url);

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Model ${model} fetch failed`);

      const data = await res.json();

      // Check if hourly block exists
      if (data?.hourly?.time && Array.isArray(data.hourly.time)) {
        console.log(`✔ Using model: ${model}`);
        return { data, modelUsed: model };
      }

      console.warn(`Model ${model} returned no hourly data. Trying next model…`);
      lastError = new Error(`Model ${model} missing hourly block`);

    } catch (err) {
      console.warn(`Model ${model} failed:`, err);
      lastError = err;
    }
  }

  // If all models fail:
  throw lastError ?? new Error("All Open-Meteo models failed");
}


// ------------------------------------------------------------
// 4. MRMS RADAR PIXEL
// ------------------------------------------------------------
export async function getMRMSPixel(lat, lon) {
  const url =
    `https://api.weather.com/v3/TileServer/tile/radar?` +
    `lat=${lat}&lon=${lon}&apiKey=09a5bd1deb4948caa5bd1deb4968cab8`;

  const res = await fetch(url);
  if (!res.ok) {
    console.warn("MRMS pixel fetch failed");
    return null;
  }

  return await res.json();
}


// ------------------------------------------------------------
// 5. TEMPEST — DEVICE OBSERVATIONS
// ------------------------------------------------------------
export async function getTempestDeviceObs(deviceId, token) {
  const url = `https://swd.weatherflow.com/swd/rest/observations/device/${deviceId}?token=${token}`;

  const res = await fetch(url);
  if (!res.ok) {
    console.warn("Tempest fetch failed");
    return null;
  }

  const data = await res.json();
  const obs = data?.obs?.[0] ?? null;
  if (!obs) return null;

  return {
    temp: obs[7] ?? null,
    humidity: obs[8] ?? null,
    windSpeed: obs[2] ?? null,
    windGust: obs[3] ?? null,
    windDir: obs[4] ?? null,
    uv: obs[10] ?? null,
    solar: obs[11] ?? null,
    tempHighToday: data?.summary?.temp?.max ?? null
  };
}
