// /js/app.js

import {
  getNearestWUStation,
  getWUCurrentConditions,
  getShortTermForecast,
  getMRMSPixel
} from './weather-fetch.js';

import { buildWeatherIntel } from './forecast-intel-plus.js';

import {
  setWUStatus,
  showWUError,
  updateUI
} from './weather-render.js';

import { degToCompass } from "./js/weather-render.js";

// ⭐ Entry point
document.addEventListener("DOMContentLoaded", initApp);


async function initApp() {
  if (!navigator.geolocation) {
    showWUError("Geolocation is not supported by this browser.");
    return;
  }

  setWUStatus("pending", "Requesting Location", "Waiting for permission…");

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;

      try {
        // ⭐ 1. WU Station + Current Conditions
        const nearest = await getNearestWUStation(lat, lon);
        const wuCurrent = await getWUCurrentConditions(nearest.stationId);

        setWUStatus("ok", "WU Connected", "Weather Underground data loaded.");

        // ⭐ 2. Hourly Forecast
        const hourly = await getShortTermForecast(lat, lon);

        // ⭐ 3. MRMS Radar Pixel
        const mrmsPixel = await getMRMSPixel(lat, lon);

        // ⭐ 4. Build Unified Intelligence
        const intel = buildWeatherIntel({
          wuCurrent,
          hourly,
          mrmsPixel
        });

        // ⭐ 5. Update UI
        updateUI(intel);

      } catch (err) {
        console.error("Weather init error:", err);
        setWUStatus("error", "Data Error", "Unable to load weather data.");
        showWUError("Unable to load weather data. Please try again later.");
      }
    },

    (err) => {
      console.error("Geolocation error:", err);
      setWUStatus("error", "Location Error", "Location permission denied.");
      showWUError("We couldn’t access your location. Please enable location services and reload.");
    }
  );
}
