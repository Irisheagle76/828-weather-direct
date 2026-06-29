const ASHEVILLE_TIME_ZONE = "America/New_York";
export const TWILIGHT_AFTER_SUNSET_MS = 35 * 60 * 1000;

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
    if (current < sunset) return "day";
    if (current < sunset + TWILIGHT_AFTER_SUNSET_MS) return "dusk";
    return "night";
  }

  const minutes = localMinutes(current ?? Date.now());
  if (minutes >= 20 * 60 && minutes < 21 * 60 + 15) return "dusk";
  return minutes >= 6 * 60 && minutes < 20 * 60 ? "day" : "night";
}

export function buildDuskSkyFallback({ cloudCover = null } = {}) {
  const cloud = normalizedCloud(cloudCover);
  let label = "Dusk";
  let headline = "Twilight is settling in over Asheville.";

  if (Number.isFinite(cloud)) {
    if (cloud >= 0.85) {
      label = "Overcast Dusk";
      headline = "Overcast skies as dusk settles in.";
    } else if (cloud >= 0.65) {
      label = "Mostly Cloudy Dusk";
      headline = "Mostly cloudy skies as dusk settles in.";
    } else if (cloud >= 0.3) {
      label = "Partly Cloudy Dusk";
      headline = "Partly cloudy skies as dusk settles in.";
    } else if (cloud >= 0.12) {
      label = "Mostly Clear Dusk";
      headline = "Mostly clear skies as dusk settles in.";
    } else {
      label = "Clear Dusk";
      headline = "Clear skies as dusk settles in.";
    }
  }

  return {
    label,
    cloud,
    confidence: Number.isFinite(cloud) ? 0.7 : 0.55,
    headline,
    detail: "The sun is below the horizon, but twilight is still lighting the western sky.",
    type: "dusk"
  };
}
