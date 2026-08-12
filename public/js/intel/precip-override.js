const ACTIVE_OBSERVATION_MAX_MS = 5 * 60 * 1000;
const DRY_CONFIRMATION_MINUTES = 3;
const RECENT_RAIN_MAX_MINUTES = 10;
const RECENT_LIGHTNING_MAX_MINUTES = 15;
const RADAR_MAX_AGE_MINUTES = 10;
const RADAR_OVERHEAD_MILES = 8;
const LOCAL_LIGHTNING_MAX_MILES = 20;
const STORAGE_KEY = "avlweather.precipOverride.v2";

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function timestampOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return numeric < 1e12 ? numeric * 1000 : numeric;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function getStorage(context = {}) {
  if (context.storage) return context.storage;
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

function readState(storage) {
  try {
    const state = JSON.parse(storage?.getItem(STORAGE_KEY) || "null");
    return state && typeof state === "object" ? state : {};
  } catch {
    return {};
  }
}

function writeState(storage, state) {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Weather copy should still render when storage is unavailable.
  }
}

function nearestCurrentHour(hourly = [], now = Date.now()) {
  return hourly
    .map((hour) => ({
      ...hour,
      _timestamp: timestampOrNull(hour?.timestamp ?? hour?.time ?? hour?.ts)
    }))
    .filter((hour) => Number.isFinite(hour._timestamp))
    .sort((a, b) => Math.abs(a._timestamp - now) - Math.abs(b._timestamp - now))[0] || null;
}

function isRainCode(code) {
  const value = Number(code);
  return (value >= 51 && value <= 67) || (value >= 80 && value <= 82) || value >= 95;
}

function isSnowCode(code) {
  const value = Number(code);
  return (value >= 71 && value <= 77) || (value >= 85 && value <= 86);
}

function normalizeProbability(value) {
  const number = numberOrNull(value);
  if (!Number.isFinite(number)) return null;
  return number > 1 ? number / 100 : number;
}

function getSeverity(rate) {
  if (rate >= 7.6) return "heavy";
  if (rate >= 2.5) return "moderate";
  return "light";
}

function getType({ rate, precipType, weatherCode, lightning }) {
  if (lightning) return "storm";
  if (isSnowCode(weatherCode) || /snow/i.test(String(precipType || ""))) return "snow";
  if (rate > 0 && rate <= 0.2) return "drizzle";
  if (Number(weatherCode) >= 80 && Number(weatherCode) <= 82) return "showers";
  return "rain";
}

function lightningSentence(lightningCount, lightningDistance) {
  const count = Math.max(0, Math.round(Number(lightningCount) || 0));
  const distance = Number(lightningDistance);
  const countPhrase = count === 1 ? "a lightning strike" : count > 1 ? `${count} lightning strikes` : "lightning";
  const distancePhrase = Number.isFinite(distance) ? ` within about ${Math.round(distance)} miles` : " nearby";
  return `Tempest has detected ${countPhrase}${distancePhrase}.`;
}

function activeCopy(type, severity, lightning = {}, evidence = {}) {
  if (type === "storm") {
    const lightningDetail = lightningSentence(lightning.count, lightning.distance);
    if (evidence.radarSupportedRain) {
      return {
        headline: "A thunderstorm is active over Asheville.",
        summary: `Radar shows precipitation over Asheville, and ${lightningDetail.charAt(0).toLowerCase()}${lightningDetail.slice(1)} Expect locally heavy rain and reduced visibility near the storm.`,
        skyPhrase: "A thunderstorm is producing rain over Asheville.",
        bullets: ["Radar shows precipitation over Asheville", lightningDetail]
      };
    }
    return {
      headline: "A thunderstorm is active around Asheville.",
      summary: `Rain is falling in Asheville, and ${lightningDetail.charAt(0).toLowerCase()}${lightningDetail.slice(1)} Keep an eye on the sky and radar before heading out.`,
      skyPhrase: "Rain is falling under a stormy Asheville sky.",
      bullets: ["Rain is falling now", lightningDetail]
    };
  }
  if (type === "snow") {
    return {
      headline: "Snow is falling in Asheville.",
      summary: "Wintry precipitation is the main weather story right now, so allow for slick or changing conditions.",
      skyPhrase: "Snow is falling under a cloudy Asheville sky.",
      bullets: ["Snow is falling now", "Watch for changing road conditions"]
    };
  }
  if (type === "drizzle") {
    return {
      headline: "Light rain is falling in Asheville.",
      summary: "A light drizzle is enough to make it damp outside, so keep a rain layer handy.",
      skyPhrase: "Light rain is falling under a cloudy sky.",
      bullets: ["Light rain is falling now", "Damp conditions are part of the FeelScore"]
    };
  }
  if (type === "showers") {
    return {
      headline: "Showers are moving through Asheville.",
      summary: "Showers are active in the area now. Keep rain in the plan for any outdoor time.",
      skyPhrase: "Showers are moving through a gray Asheville sky.",
      bullets: ["Showers are active now", "Keep rain in the outdoor plan"]
    };
  }
  if (severity === "heavy") {
    return {
      headline: "Heavier rain is falling in Asheville.",
      summary: "Heavier showers are the main weather story right now, with reduced visibility possible at times.",
      skyPhrase: "Heavier rain is falling under a gray Asheville sky.",
      bullets: ["Heavier rain is falling now", "Visibility may drop at times"]
    };
  }
  return {
    headline: "Rain is falling in Asheville.",
    summary: "Rain is the main weather story right now. Keep it in the plan for any outdoor time.",
    skyPhrase: "Rain is falling under a cloudy sky.",
    bullets: ["Rain is falling now", "Wet conditions are part of the FeelScore"]
  };
}

function recentCopy() {
  return {
    headline: "Rain has eased in Asheville.",
    summary: "Showers recently moved through. Wet pavement may linger, but the rain has eased for now.",
    skyPhrase: "Rain has eased, but the sky may still look gray.",
    bullets: ["Rain recently eased", "Wet surfaces may linger"]
  };
}

function nearbyStormCopy(lightning = {}) {
  const lightningDetail = lightningSentence(lightning.count, lightning.distance);
  return {
    headline: "Storms are nearby, but not over Asheville.",
    summary: `${lightningDetail} The latest local observations do not support an active thunderstorm over Asheville right now, but keep an eye on conditions nearby.`,
    skyPhrase: "Storms remain nearby while Asheville is outside the active core.",
    bullets: [lightningDetail, "No active thunderstorm is confirmed over Asheville"]
  };
}

function clearingCopy(lightning = {}) {
  const distance = Number(lightning.distance);
  const lightningContext = Number.isFinite(distance)
    ? ` Tempest's latest lightning was about ${Math.round(distance)} miles away.`
    : "";
  return {
    headline: "The sky is clearing after storms.",
    summary: `Rain has ended at the local station, radar is not showing an approaching storm, and brighter breaks are returning.${lightningContext}`,
    skyPhrase: "Brighter breaks are returning after the storms.",
    bullets: ["The local sky is clearing", "No approaching storm is indicated"]
  };
}

function debugOverride(payload) {
  try {
    const local = typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname);
    if (local) console.debug("[828 precip override]", payload);
  } catch {
    // Debug logging must never affect the weather readout.
  }
}

export function getCurrentPrecipOverride(context = {}) {
  const now = timestampOrNull(context.now) ?? Date.now();
  const current = context.current || context.tempest || context.current_conditions || {};
  const hourly = Array.isArray(context.hourly) ? context.hourly : [];
  const currentHour = nearestCurrentHour(hourly, now);
  const storage = getStorage(context);
  const previous = readState(storage);
  const radar = context.radar || {};

  const rainRate = numberOrNull(
    current.rainRate ?? current.precipRate ?? current.precip_rate ?? current.rain_rate
  );
  const rainRateObservedAt = timestampOrNull(
    current.rainRateObservedAt ?? current.observedAt ?? current.timestamp ?? current.time
  );
  const observationAge = Number.isFinite(rainRateObservedAt) ? now - rainRateObservedAt : Infinity;
  const observationFresh = observationAge >= -60 * 1000 && observationAge <= ACTIVE_OBSERVATION_MAX_MS;

  let lastRainDetectedAt = timestampOrNull(previous.lastRainDetectedAt);
  if (observationFresh && rainRate > 0) lastRainDetectedAt = rainRateObservedAt;
  const activeRainNow = observationFresh && rainRate > 0;
  let dryObservationStartedAt = timestampOrNull(previous.dryObservationStartedAt);
  if (activeRainNow) {
    dryObservationStartedAt = null;
  } else if (observationFresh && rainRate === 0 && !Number.isFinite(dryObservationStartedAt)) {
    dryObservationStartedAt = rainRateObservedAt;
  }
  const dryObservationMinutes = Number.isFinite(dryObservationStartedAt)
    ? Math.max(0, (now - dryObservationStartedAt) / 60000)
    : null;
  const dryConfirmed = observationFresh && rainRate === 0 &&
    Number.isFinite(dryObservationMinutes) && dryObservationMinutes >= DRY_CONFIRMATION_MINUTES;

  const forecastTimestamp = timestampOrNull(currentHour?._timestamp);
  const forecastFresh = Number.isFinite(forecastTimestamp) && Math.abs(forecastTimestamp - now) <= 90 * 60 * 1000;
  const forecastAmount = numberOrNull(
    currentHour?.precipAmount ?? currentHour?.precipitation ?? currentHour?.rain
  ) ?? 0;
  const forecastProbability = normalizeProbability(
    currentHour?.precipProbability ?? currentHour?.precipitation_probability
  );
  const forecastCode = currentHour?.weatherCode ?? currentHour?.weather_code;
  const strongForecastRain = forecastFresh && forecastAmount >= 0.005 &&
    ((forecastProbability ?? 0) >= 0.6 || isRainCode(forecastCode) || isSnowCode(forecastCode));
  const tempestUnavailable = !Number.isFinite(rainRate) || !observationFresh;
  const radarFresh = radar.available === true && Number(radar.ageMinutes) <= RADAR_MAX_AGE_MINUTES;
  const radarOverhead = radarFresh && Number(radar.nearestEchoMiles) <= RADAR_OVERHEAD_MILES &&
    (Number(radar.echoPixels) > 0 || Number(radar.echoCoverage) > 0);

  const observedLightningCount = Math.max(0, Number(
    context.lightningCount ?? current.lightningStrikeCount ?? current.lightning_strike_count ?? 0
  ) || 0);
  const lightningDistance = numberOrNull(
    context.lightningDistance ?? current.lightningStrikeDistance ?? current.lightning_strike_last_distance
  );
  const lightningObservedAt = timestampOrNull(
    context.lightningObservedAt ?? current.lightningStrikeLastAt ?? current.lightning_strike_last_epoch
  );
  let lastLightningDetectedAt = timestampOrNull(previous.lastLightningDetectedAt);
  let recentLightningCount = Math.max(0, Number(previous.lightningCount) || 0);
  let recentLightningDistance = numberOrNull(previous.lightningDistance);
  if (observationFresh && observedLightningCount > 0) {
    lastLightningDetectedAt = rainRateObservedAt;
    recentLightningCount = observedLightningCount;
    recentLightningDistance = lightningDistance;
  } else if (Number.isFinite(lightningObservedAt) && now - lightningObservedAt >= -60 * 1000 &&
    now - lightningObservedAt <= RECENT_LIGHTNING_MAX_MINUTES * 60 * 1000) {
    lastLightningDetectedAt = lightningObservedAt;
    recentLightningDistance = lightningDistance;
  }
  const minutesSinceLightning = Number.isFinite(lastLightningDetectedAt)
    ? Math.max(0, (now - lastLightningDetectedAt) / 60000)
    : null;
  const tempestLightning = Number.isFinite(minutesSinceLightning) && minutesSinceLightning <= RECENT_LIGHTNING_MAX_MINUTES;
  const effectiveLightningDistance = recentLightningDistance ?? lightningDistance;
  const lightningLocal = tempestLightning && (
    Number.isFinite(effectiveLightningDistance)
      ? effectiveLightningDistance <= LOCAL_LIGHTNING_MAX_MILES
      : activeRainNow && radarOverhead
  );
  const lightning = lightningLocal || Number(forecastCode) >= 95;
  // A point rain gauge can read zero beneath a convective cell because of siting,
  // wind, or the reporting interval. Fresh overhead radar plus recent, observed
  // Tempest lightning is stronger evidence than the dry-transition timer.
  const radarConfirmedThunderstorm = radarOverhead && lightningLocal;
  const radarSupportedRain = !activeRainNow && radarOverhead && (
    radarConfirmedThunderstorm || (!dryConfirmed && (
      strongForecastRain ||
      current.isRainingNow === true ||
      Number(current.relative_humidity ?? current.relativeHumidity) >= 90
    ))
  );
  if (radarSupportedRain) lastRainDetectedAt = now;
  const minutesSinceRainDetected = Number.isFinite(lastRainDetectedAt)
    ? Math.max(0, (now - lastRainDetectedAt) / 60000)
    : null;
  const recentRainOnly = !activeRainNow && !radarSupportedRain && Number.isFinite(minutesSinceRainDetected) &&
    minutesSinceRainDetected <= RECENT_RAIN_MAX_MINUTES;
  const forecastActive = !activeRainNow && !recentRainOnly && !radarSupportedRain && tempestUnavailable && strongForecastRain;
  const clearingAfterStorm = context.skyClearing === true && dryConfirmed && radar.approaching !== true &&
    recentRainOnly;
  const nearbyStormOnly = tempestLightning && !activeRainNow && !radarConfirmedThunderstorm && !clearingAfterStorm;
  const severity = getSeverity(rainRate ?? (forecastAmount * 25.4));
  const type = getType({
    rate: rainRate ?? 0,
    precipType: current.precipType ?? current.precip_type,
    weatherCode: forecastCode,
    lightning
  });

  writeState(storage, {
    lastRainDetectedAt,
    dryObservationStartedAt,
    observedAt: rainRateObservedAt,
    lastLightningDetectedAt,
    lightningCount: recentLightningCount,
    lightningDistance: recentLightningDistance
  });

  const mode = activeRainNow || radarSupportedRain || forecastActive
    ? "active"
    : clearingAfterStorm
      ? "clearing"
      : nearbyStormOnly
        ? "nearby"
        : recentRainOnly
          ? "recent"
          : "expired";
  const copyLightning = {
    count: recentLightningCount || observedLightningCount,
    distance: effectiveLightningDistance
  };
  const copy = mode === "active"
    ? activeCopy(
        type,
        severity,
        copyLightning,
        { radarSupportedRain, radarConfirmedThunderstorm }
      )
    : mode === "clearing" ? clearingCopy(copyLightning)
    : mode === "nearby" ? nearbyStormCopy(copyLightning)
    : mode === "recent" ? recentCopy() : {};
  const result = {
    active: mode !== "expired",
    mode,
    type,
    severity,
    headline: copy.headline ?? "",
    summary: copy.summary ?? "",
    skyPhrase: copy.skyPhrase ?? "",
    bullets: copy.bullets ?? [],
    confidence: activeRainNow ? "high" : mode !== "expired" || radarSupportedRain || forecastActive ? "medium" : "low",
    rainRate,
    rainRateObservedAt,
    lastRainDetectedAt,
    minutesSinceRainDetected,
    activeRainNow,
    dryConfirmed,
    dryObservationMinutes,
    radarSupportedRain,
    radarConfirmedThunderstorm,
    radarFresh,
    radarOverhead,
    recentRainOnly,
    clearingAfterStorm,
    nearbyStormOnly,
    lightningActive: tempestLightning,
    lightningLocal,
    lightningCount: recentLightningCount || observedLightningCount,
    lightningDistance: effectiveLightningDistance,
    minutesSinceLightning,
    overrideExpired: mode === "expired",
    source: activeRainNow || recentRainOnly ? "tempest"
      : radarSupportedRain ? "noaa-radar"
      : clearingAfterStorm ? "camera+tempest"
      : nearbyStormOnly ? "tempest"
      : forecastActive ? "current-hour"
      : null
  };

  debugOverride(result);
  return result;
}

export function applyPrecipOverrideToNarrative(narrative = {}, precipOverride = null) {
  if (!precipOverride?.active) return narrative;
  return {
    ...narrative,
    headline: precipOverride.headline || narrative?.headline || "",
    subHeadline: precipOverride.summary || narrative?.subHeadline || "",
    narrative: precipOverride.summary || narrative?.narrative || "",
    detail: precipOverride.summary || narrative?.detail || "",
    bullets: [
      ...(precipOverride.bullets || []),
      ...(Array.isArray(narrative?.bullets) ? narrative.bullets : [])
    ].slice(0, 3),
    precipOverride: true,
    precipMode: precipOverride.mode
  };
}

export function getPrecipSkyLabel(precipOverride = null) {
  if (!precipOverride?.active) return null;
  if (precipOverride.mode === "clearing") return "Clearing After Storms";
  if (precipOverride.mode === "nearby") return "Storms Nearby";
  if (precipOverride.mode === "recent") return "Rain Easing";
  return {
    storm: "Thunderstorm",
    snow: "Snow",
    drizzle: "Light Rain",
    showers: "Showers",
    rain: "Rain"
  }[precipOverride.type] || "Rain";
}
