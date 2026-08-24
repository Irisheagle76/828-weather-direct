const ASHEVILLE_TIME_ZONE = "America/New_York";
export const SUNSET_APPROACH_MS = 45 * 60 * 1000;
export const SUNSET_GRACE_MS = 10 * 60 * 1000;
export const AFTERGLOW_AFTER_SUNSET_MS = 60 * 60 * 1000;
export const SUNSET_PROMOTION_LEAD_MS = 2 * 60 * 60 * 1000;

function localDateKey(timestamp) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: ASHEVILLE_TIME_ZONE
  }).formatToParts(new Date(timestamp));
  const part = (type) => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function localMinutes(timestamp) {
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "numeric",
    hour12: false,
    timeZone: ASHEVILLE_TIME_ZONE
  }).formatToParts(new Date(timestamp));
  const part = (type) => Number(parts.find((item) => item.type === type)?.value);
  return part("hour") * 60 + part("minute");
}

function timestamp(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (Number.isFinite(n)) return n < 1e12 ? n * 1000 : n;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizedCloud(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(1, n > 1 ? n / 100 : n));
}

export function findTodaySolarTimes(daily = [], now = Date.now()) {
  const today = localDateKey(now);
  const entry = daily.find((day) => {
    const anchor = timestamp(day?.sunset ?? day?.sunrise ?? day?.timestamp);
    return Number.isFinite(anchor) && localDateKey(anchor) === today;
  });
  return {
    sunriseAt: timestamp(entry?.sunrise),
    sunsetAt: timestamp(entry?.sunset)
  };
}

export function getSkyTimePhase({ now = Date.now(), sunriseAt = null, sunsetAt = null } = {}) {
  const current = timestamp(now);
  const sunrise = timestamp(sunriseAt);
  const sunset = timestamp(sunsetAt);

  if (Number.isFinite(current) && Number.isFinite(sunrise) && current < sunrise) return "night";
  if (Number.isFinite(current) && Number.isFinite(sunset)) {
    if (current < sunset - SUNSET_APPROACH_MS) return "day";
    if (current < sunset + SUNSET_GRACE_MS) return "sunset";
    if (current < sunset + AFTERGLOW_AFTER_SUNSET_MS) return "afterglow";
    return "night";
  }

  const minutes = localMinutes(current ?? Date.now());
  if (minutes >= 19 * 60 + 15 && minutes < 20 * 60 + 15) return "sunset";
  if (minutes >= 20 * 60 + 15 && minutes < 21 * 60 + 15) return "afterglow";
  return minutes >= 6 * 60 && minutes < 20 * 60 ? "day" : "night";
}

function normalizedProbability(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(1, n > 1 ? n / 100 : n));
}

function isWetWeatherCode(code) {
  const value = Number(code);
  return (value >= 51 && value <= 67) ||
    (value >= 71 && value <= 77) ||
    (value >= 80 && value <= 86) ||
    value >= 95;
}

export function evaluateSunsetSky({
  cameraCloud = null,
  forecastCloud = null,
  obscured = false,
  precipActive = false,
  recentRain = false,
  precipAmount = 0,
  precipProbability = null,
  weatherCode = null,
  sunlightDetected = null,
  sunlightLevel = null
} = {}) {
  const cloudCandidates = [cameraCloud, forecastCloud]
    .map(normalizedCloud)
    .filter(Number.isFinite);
  const cloud = cloudCandidates.length ? Math.max(...cloudCandidates) : null;
  const rainChance = normalizedProbability(precipProbability);
  const wetSignal = precipActive || recentRain || Number(precipAmount) > 0 ||
    (Number.isFinite(rainChance) && rainChance >= 0.45) || isWetWeatherCode(weatherCode);
  const usefulLightSignal = sunlightDetected === true ||
    ["moderate", "strong", "bright"].includes(String(sunlightLevel || "").toLowerCase());
  const radianceVetted = !obscured && !wetSignal && Number.isFinite(cloud) &&
    cloud <= 0.55 && usefulLightSignal;

  return { cloud, wetSignal, usefulLightSignal, radianceVetted };
}

export function evaluateSunsetPromotion({
  now = Date.now(),
  sunsetAt = null,
  confidence = null,
  ...skyInputs
} = {}) {
  const current = timestamp(now);
  const sunset = timestamp(sunsetAt);
  const minutes = localMinutes(current ?? Date.now());
  const timeEligible = Number.isFinite(current) && Number.isFinite(sunset)
    ? current >= sunset - SUNSET_PROMOTION_LEAD_MS && current <= sunset + AFTERGLOW_AFTER_SUNSET_MS
    : minutes >= 17 * 60 && minutes <= 21 * 60 + 15;
  const sunsetSky = evaluateSunsetSky(skyInputs);
  const cloudTextureEligible = Number.isFinite(sunsetSky.cloud) &&
    sunsetSky.cloud >= 0.12 && sunsetSky.cloud <= 0.55;
  const confidenceValue = Number(confidence);
  const confidenceEligible = !Number.isFinite(confidenceValue) || confidenceValue >= 0.58;

  return {
    ...sunsetSky,
    timeEligible,
    cloudTextureEligible,
    confidenceEligible,
    active: timeEligible && sunsetSky.radianceVetted && cloudTextureEligible && confidenceEligible
  };
}

export function buildDuskSkyFallback({
  cloudCover = null,
  cameraCloud = null,
  phase = "afterglow",
  now = Date.now(),
  sunsetAt = null,
  precipActive = false,
  recentRain = false,
  precipAmount = 0,
  precipProbability = null,
  weatherCode = null,
  sunlightDetected = null,
  sunlightLevel = null,
  obscured = false
} = {}) {
  const current = timestamp(now);
  const sunset = timestamp(sunsetAt);
  const sunStillUp = phase === "sunset" && Number.isFinite(current) &&
    Number.isFinite(sunset) && current < sunset;
  const sunsetSky = evaluateSunsetSky({
    cameraCloud,
    forecastCloud: cloudCover,
    obscured,
    precipActive,
    recentRain,
    precipAmount,
    precipProbability,
    weatherCode,
    sunlightDetected,
    sunlightLevel
  });
  const { cloud, wetSignal, radianceVetted } = sunsetSky;

  let label = phase === "sunset" ? "Sunset Period" : "Evening Twilight";
  let headline = sunStillUp
    ? "Daylight is fading as the sun nears the horizon."
    : "Twilight is fading over Asheville.";
  let detail = "The clock is near sunset, but the sky does not have enough verified color or glow for a stronger claim.";
  let lightLabel = phase === "sunset" ? "Fading Daylight" : "Twilight";

  if (obscured) {
    label = "Obscured Evening";
    headline = "Fog or low cloud is obscuring the evening sky.";
    detail = "The live view is obscured, so the page is avoiding a sunset-color claim until the camera has a reliable western-sky view.";
    lightLabel = "Muted Light";
  } else if (wetSignal) {
    label = precipActive ? "Wet Evening" : "Cloudy Evening";
    headline = precipActive
      ? "Rain and clouds are taking over as daylight fades."
      : "Clouds and recent rain are muting the evening sky.";
    detail = "Sunset timing is nearby, but wet weather and cloud cover are the more reliable sky story right now.";
    lightLabel = "Fading Light";
  } else if (!Number.isFinite(cloud)) {
    headline = sunStillUp
      ? "The sun is nearing the horizon, but the sky read is limited."
      : "Twilight is fading, but the sky read is limited.";
    detail = "Cloud and camera evidence are incomplete, so the page is avoiding an unsupported sunset-color description.";
  } else if (phase === "sunset") {
    if (cloud >= 0.85) {
      label = "Overcast Evening";
      headline = "The sun is setting behind a solid overcast.";
      detail = "Daylight is fading beneath the cloud deck, with little evidence of meaningful sunset color.";
      lightLabel = "Fading Daylight";
    } else if (cloud >= 0.65) {
      label = "Cloudy Evening";
      headline = "The sun is setting behind a mostly cloudy western sky.";
      detail = "Clouds are dominating the view, so any sunset color is likely limited to small breaks.";
      lightLabel = "Filtered Evening Light";
    } else if (radianceVetted && cloud >= 0.3) {
      label = "Sunset Color";
      headline = "The setting sun is lighting breaks in the western clouds.";
      detail = "Dry conditions, manageable cloud cover, and a positive light signal support visible sunset color.";
      lightLabel = "Sunset Color";
    } else if (radianceVetted) {
      label = "Clear Sunset";
      headline = "Warm sunset light is showing near the Blue Ridge horizon.";
      detail = "A mostly open, dry sky and a positive light signal support the brighter sunset read.";
      lightLabel = "Warm Sunset Light";
    } else {
      label = cloud >= 0.3 ? "Partly Cloudy Evening" : "Mostly Clear Evening";
      headline = sunStillUp
        ? "The sun is setting through the western sky."
        : "The sun has slipped below the western horizon.";
      detail = "The timing is right for sunset, but the camera has not confirmed enough color for a stronger description.";
      lightLabel = "Setting Sun";
    }
  } else if (cloud >= 0.85) {
    label = "Overcast Twilight";
    headline = "Twilight is fading beneath a solid overcast.";
    detail = "The sun is down, and the cloud deck is limiting any remaining western light.";
    lightLabel = "Low Twilight";
  } else if (cloud >= 0.65) {
    label = "Cloudy Twilight";
    headline = "The remaining twilight is fading behind mostly cloudy skies.";
    detail = "Cloud cover is too extensive for the page to claim a meaningful post-sunset glow.";
    lightLabel = "Filtered Twilight";
  } else if (radianceVetted) {
    label = cloud >= 0.3 ? "Visible Afterglow" : "Clear Afterglow";
    headline = cloud >= 0.3
      ? "A verified afterglow is lingering around breaks in the western clouds."
      : "A clear afterglow is lingering along the Blue Ridge horizon.";
    detail = "Dry conditions, manageable cloud cover, and the camera light signal support the post-sunset glow.";
    lightLabel = "Afterglow";
  } else {
    label = cloud >= 0.3 ? "Partly Cloudy Twilight" : "Mostly Clear Twilight";
    headline = "The western sky is moving from twilight into night.";
    detail = "The sun is down, and the available camera signal does not support a stronger color description.";
    lightLabel = "Fading Twilight";
  }

  return {
    label,
    cloud,
    confidence: Number.isFinite(cloud) ? 0.7 : 0.55,
    headline,
    detail,
    lightLabel,
    type: phase,
    radianceVetted,
    wetSignal,
    usefulLightSignal: sunsetSky.usefulLightSignal
  };
}
