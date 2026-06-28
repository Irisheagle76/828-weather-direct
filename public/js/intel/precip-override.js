const ACTIVE_OBSERVATION_MAX_MS = 5 * 60 * 1000;
const RECENT_RAIN_MAX_MINUTES = 10;
const STORAGE_KEY = "avlweather.precipOverride.v1";

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

function activeCopy(type, severity) {
  if (type === "storm") {
    return {
      headline: "Storms are active around Asheville.",
      summary: "Rain and a thunderstorm signal are the main weather story right now. Keep an eye on the sky and radar before heading out.",
      skyPhrase: "Rain is falling under a stormy Asheville sky.",
      bullets: ["Rain is falling now", "A thunderstorm signal is nearby"]
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

  const rainRate = numberOrNull(
    current.rainRate ?? current.precipRate ?? current.precip_rate ?? current.rain_rate
  );
  const rainRateObservedAt = timestampOrNull(
    current.rainRateObservedAt ?? current.observedAt ?? current.timestamp ?? current.time
  );
  const observationAge = Number.isFinite(rainRateObservedAt) ? now - rainRateObservedAt : Infinity;
  const observationFresh = observationAge >= -60 * 1000 && observationAge <= ACTIVE_OBSERVATION_MAX_MS;

  const accumulation = numberOrNull(
    current.precipAccumLocalDay ?? current.precip_accum_local_day ?? current.rainAccum ?? current.precipAccum
  );
  const previousAccumulation = numberOrNull(previous.accumulation);
  const accumulationIncreased = observationFresh && Number.isFinite(accumulation) &&
    Number.isFinite(previousAccumulation) && accumulation > previousAccumulation + 0.0001;

  let lastRainDetectedAt = timestampOrNull(previous.lastRainDetectedAt);
  if (observationFresh && rainRate > 0) lastRainDetectedAt = rainRateObservedAt;
  else if (accumulationIncreased) lastRainDetectedAt = rainRateObservedAt;

  const minutesSinceRainDetected = Number.isFinite(lastRainDetectedAt)
    ? Math.max(0, (now - lastRainDetectedAt) / 60000)
    : null;
  const activeRainNow = observationFresh && rainRate > 0;
  const recentRainOnly = !activeRainNow && Number.isFinite(minutesSinceRainDetected) &&
    minutesSinceRainDetected <= RECENT_RAIN_MAX_MINUTES;

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
  const forecastActive = !activeRainNow && !recentRainOnly && tempestUnavailable && strongForecastRain;

  const lightning = Number(current.lightningStrikeCount ?? current.lightning_strike_count ?? 0) > 0 ||
    Number(forecastCode) >= 95;
  const severity = getSeverity(rainRate ?? (forecastAmount * 25.4));
  const type = getType({
    rate: rainRate ?? 0,
    precipType: current.precipType ?? current.precip_type,
    weatherCode: forecastCode,
    lightning
  });

  writeState(storage, {
    lastRainDetectedAt,
    accumulation: Number.isFinite(accumulation) ? accumulation : previousAccumulation,
    observedAt: rainRateObservedAt
  });

  const mode = activeRainNow || forecastActive ? "active" : recentRainOnly ? "recent" : "expired";
  const copy = mode === "active" ? activeCopy(type, severity) : mode === "recent" ? recentCopy() : {};
  const result = {
    active: mode !== "expired",
    mode,
    type,
    severity,
    headline: copy.headline ?? "",
    summary: copy.summary ?? "",
    skyPhrase: copy.skyPhrase ?? "",
    bullets: copy.bullets ?? [],
    confidence: activeRainNow ? "high" : mode === "recent" || forecastActive ? "medium" : "low",
    rainRate,
    rainRateObservedAt,
    lastRainDetectedAt,
    minutesSinceRainDetected,
    activeRainNow,
    recentRainOnly,
    overrideExpired: mode === "expired",
    source: activeRainNow || recentRainOnly ? "tempest" : forecastActive ? "current-hour" : null
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
