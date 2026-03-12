// forecast-intel-plus.js

import {
  getHumanActionOutlook,
  getTodayActionOutlook,
  getForecastAlerts,
  getComfortCategory
} from './forecast-intel.js';

// Unified falling precip signal (WU + MRMS)
function getFallingPrecipSignal(wu, mrms) {
  const fromWU = wu && wu.precipRate > 0;
  const fromMRMS = mrms && mrms.rate > 0;

  if (!fromWU && !fromMRMS) {
    return {
      isFalling: false,
      type: "none",
      intensity: "none",
      source: "none"
    };
  }

  if (fromMRMS) {
    return {
      isFalling: true,
      type: mrms.type,
      intensity: mrms.intensity,
      source: fromWU ? "both" : "mrms"
    };
  }

  return {
    isFalling: true,
    type: "rain",
    intensity: wu.precipRate > 0.2 ? "moderate" : "light",
    source: "wu"
  };
}

// Comfort override that respects falling precip
function getComfortWithPrecip(wuCurrent, precipSignal) {
  if (precipSignal.isFalling) {
    const { type, intensity } = precipSignal;

    if (type === "rain") {
      if (intensity === "heavy") {
        return {
          text: "A soaking rain — comfort takes a back seat today.",
          emoji: "🌧️"
        };
      }
      if (intensity === "moderate") {
        return {
          text: "Steady rain falling — damp and messy.",
          emoji: "🌧️"
        };
      }
      return {
        text: "Light rain falling — a bit messy out there.",
        emoji: "🌦️"
      };
    }

    if (type === "snow") {
      if (intensity === "heavy") {
        return {
          text: "Snow falling — cold, quiet, and wintry.",
          emoji: "❄️"
        };
      }
      return {
        text: "Light snow — a soft, chilly kind of day.",
        emoji: "❄️"
      };
    }

    if (type === "mix") {
      return {
        text: "Wintry mix falling — slippery and raw.",
        emoji: "🌨️"
      };
    }

    if (type === "hail") {
      return {
        text: "Hail in the area — stay sheltered.",
        emoji: "🌩️"
      };
    }
  }

  // No falling precip → use your existing Comfort 2.3 personality
  return getComfortCategory(
    wuCurrent.temp,
    wuCurrent.dewPoint,
    wuCurrent.windGust ?? 0,
    0
  );
}

// Master builder: combines everything into one intel object
export function buildWeatherIntel({ wuCurrent, hourly, mrmsPixel }) {
  const precipSignal = getFallingPrecipSignal(
    {
      precipRate: wuCurrent?.precipRate ?? 0,
      precip1hr: wuCurrent?.precip1hr ?? 0,
      conditionIcon: wuCurrent?.icon ?? "",
      gust: wuCurrent?.windGust ?? 0
    },
    {
      rate: mrmsPixel?.rate ?? 0,
      type: mrmsPixel?.type ?? "none",
      intensity: mrmsPixel?.intensity ?? "none"
    }
  );

  const comfort = getComfortWithPrecip(wuCurrent, precipSignal);
  const tomorrow = getHumanActionOutlook(hourly);
  const today = getTodayActionOutlook(hourly);
  const alerts = getForecastAlerts(hourly);

  return {
    precipSignal,
    comfort,
    today,
    tomorrow,
    alerts
  };
}
