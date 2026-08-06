import { ashevilleDailyNormals } from "./asheville-normals.js";

const DISPLAY_TIME_ZONE = "America/New_York";
const MIN_SLOT_LEAD_MS = 90 * 60 * 1000;
const RAPID_CHANGE_F = 8;
const RAPID_CHANGE_WINDOW_HOURS = 3;
const MAJOR_CHANGE_F = 12;
const MAJOR_CHANGE_WINDOW_HOURS = 6;
const SEASONAL_DEPARTURE_F = 10;

export function buildTemperaturePath(hourly = [], daily = [], currentHour = null, options = {}) {
  const now = finite(options.now) ?? Date.now();
  const rows = hourly.map(normalizeHour).filter(Boolean).sort((a, b) => a.timestamp - b.timestamp);
  const current = normalizeCurrent(currentHour, now) || closestTo(rows, now, 75 * 60 * 1000) || rows[0] || null;
  const slots = [
    ...(current ? [{ label: "Now", hour: current }] : []),
    ...selectFutureSlots(rows, now)
  ].slice(0, 3);

  return { slots, callout: buildContextCallout(rows, daily, current, now) };
}

function selectFutureSlots(rows, now) {
  const currentHour = easternParts(now).hour;
  const preferred = currentHour < 5
    ? [[0, 8], [0, 15]]
    : currentHour < 14
      ? [[0, 15], [0, 21]]
      : currentHour < 18
        ? [[0, 19], [0, 22]]
        : currentHour < 22
          ? [[0, 22], [1, 8]]
          : [[1, 8], [1, 15]];
  const anchors = [...preferred, [1, 8], [1, 15], [1, 21], [2, 8], [2, 15]];
  const used = new Set();
  const selected = [];

  for (const [dayOffset, targetHour] of anchors) {
    const key = `${dayOffset}:${targetHour}`;
    if (used.has(key)) continue;
    used.add(key);
    const hour = findForecastAnchor(rows, now, dayOffset, targetHour);
    if (!hour || selected.some((slot) => slot.hour.timestamp === hour.timestamp)) continue;
    selected.push({ label: formatSlotLabel(hour.timestamp, now), hour });
    if (selected.length === 2) break;
  }
  return selected;
}

function findForecastAnchor(rows, now, dayOffset, targetHour) {
  const targetDate = addDateKeyDays(easternDateKey(now), dayOffset);
  return rows
    .filter((hour) => (
      hour.timestamp >= now + MIN_SLOT_LEAD_MS &&
      easternDateKey(hour.timestamp) === targetDate &&
      Math.abs(easternParts(hour.timestamp).hour - targetHour) <= 1
    ))
    .sort((a, b) => {
      const distance = Math.abs(easternParts(a.timestamp).hour - targetHour) -
        Math.abs(easternParts(b.timestamp).hour - targetHour);
      return distance || a.timestamp - b.timestamp;
    })[0] || null;
}

function buildContextCallout(rows, daily, current, now) {
  const currentTemp = finite(current?.temperatureF);
  if (Number.isFinite(currentTemp)) {
    const inThreeHours = closestTo(rows, now + RAPID_CHANGE_WINDOW_HOURS * 3600000, 75 * 60 * 1000);
    const threeHourTemp = finite(inThreeHours?.temperatureF);
    const threeHourDelta = Number.isFinite(threeHourTemp) ? threeHourTemp - currentTemp : null;
    if (Number.isFinite(threeHourDelta) && Math.abs(threeHourDelta) >= RAPID_CHANGE_F) {
      return threeHourDelta > 0
        ? { emoji: "📈", text: `Warming quickly — about ${Math.round(Math.abs(threeHourDelta))}° over the next 3 hours.` }
        : { emoji: "📉", text: `Cooling quickly — about ${Math.round(Math.abs(threeHourDelta))}° over the next 3 hours.` };
    }

    const inSixHours = closestTo(rows, now + MAJOR_CHANGE_WINDOW_HOURS * 3600000, 90 * 60 * 1000);
    const sixHourTemp = finite(inSixHours?.temperatureF);
    const sixHourDelta = Number.isFinite(sixHourTemp) ? sixHourTemp - currentTemp : null;
    if (Number.isFinite(sixHourDelta) && Math.abs(sixHourDelta) >= MAJOR_CHANGE_F) {
      return sixHourDelta > 0
        ? { emoji: "🌡️", text: `A sharp ${Math.round(Math.abs(sixHourDelta))}° rise is ahead over the next 6 hours.` }
        : { emoji: "🌡️", text: `A sharp ${Math.round(Math.abs(sixHourDelta))}° drop is ahead over the next 6 hours.` };
    }
  }

  return seasonalCallout(rows, daily, now);
}

function seasonalCallout(rows, daily, now) {
  const localHour = easternParts(now).hour;
  if (localHour < 18) {
    const dateKey = easternDateKey(now);
    const day = findDaily(daily, dateKey);
    const projectedHigh = finite(day?.tempMax) ?? maximum(rows
      .filter((hour) => easternDateKey(hour.timestamp) === dateKey)
      .map((hour) => hour.temperatureF));
    const normalHigh = finite(ashevilleDailyNormals(now)?.high);
    const departure = Number.isFinite(projectedHigh) && Number.isFinite(normalHigh)
      ? projectedHigh - normalHigh
      : null;
    if (!Number.isFinite(departure) || Math.abs(departure) < SEASONAL_DEPARTURE_F) return null;
    return departure > 0
      ? { emoji: "🔥", text: `This afternoon runs about ${Math.round(Math.abs(departure))}° warmer than normal.` }
      : { emoji: "🧊", text: `This afternoon runs about ${Math.round(Math.abs(departure))}° cooler than normal.` };
  }

  const tomorrowKey = addDateKeyDays(easternDateKey(now), 1);
  const overnightLow = minimum(rows
    .filter((hour) => (
      hour.timestamp > now &&
      easternDateKey(hour.timestamp) === tomorrowKey &&
      easternParts(hour.timestamp).hour <= 9
    ))
    .map((hour) => hour.temperatureF));
  const normalLow = finite(ashevilleDailyNormals(`${tomorrowKey}T12:00:00`)?.low);
  const departure = Number.isFinite(overnightLow) && Number.isFinite(normalLow)
    ? overnightLow - normalLow
    : null;
  if (!Number.isFinite(departure) || Math.abs(departure) < SEASONAL_DEPARTURE_F) return null;
  return departure > 0
    ? { emoji: "🌙", text: `Tonight stays about ${Math.round(Math.abs(departure))}° milder than normal.` }
    : { emoji: "🧥", text: `Tonight turns about ${Math.round(Math.abs(departure))}° colder than normal.` };
}

function findDaily(daily, dateKey) {
  return daily.find((day) => dailyDateKey(day) === dateKey) || null;
}

function dailyDateKey(day) {
  const value = day?.date ?? day?.timestamp ?? day?.time;
  if (typeof value === "string") {
    const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
  }
  const timestamp = normalizeTimestamp(value);
  return Number.isFinite(timestamp) ? easternDateKey(timestamp) : null;
}

function formatSlotLabel(timestamp, now) {
  const dateKey = easternDateKey(timestamp);
  const todayKey = easternDateKey(now);
  const tomorrowKey = addDateKeyDays(todayKey, 1);
  const time = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    hour12: true,
    timeZone: DISPLAY_TIME_ZONE
  }).format(new Date(timestamp));
  if (dateKey === todayKey) return time;
  if (dateKey === tomorrowKey) return `Tomorrow ${time}`;
  const weekday = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: DISPLAY_TIME_ZONE
  }).format(new Date(timestamp));
  return `${weekday} ${time}`;
}

function normalizeHour(hour) {
  const timestamp = normalizeTimestamp(hour?.timestamp ?? hour?.time ?? hour?.ts);
  const temperatureF = finite(hour?.temperatureF ?? hour?.temp ?? hour?.temperature);
  return Number.isFinite(timestamp) && Number.isFinite(temperatureF)
    ? { ...hour, timestamp, temperatureF }
    : null;
}

function normalizeCurrent(hour, now) {
  const temperatureF = finite(hour?.temperatureF ?? hour?.temp ?? hour?.temperature);
  if (!Number.isFinite(temperatureF)) return null;
  const timestamp = normalizeTimestamp(hour?.timestamp ?? hour?.time ?? hour?.ts);
  return { ...hour, temperatureF, timestamp: Number.isFinite(timestamp) ? timestamp : now };
}

function normalizeTimestamp(value) {
  if (Number.isFinite(value)) return value < 1e12 ? value * 1000 : value;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function easternParts(timestamp) {
  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    hourCycle: "h23",
    timeZone: DISPLAY_TIME_ZONE
  }).formatToParts(new Date(timestamp));
  const fields = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(fields.year),
    month: Number(fields.month),
    day: Number(fields.day),
    hour: Number(fields.hour)
  };
}

function easternDateKey(timestamp) {
  const parts = easternParts(timestamp);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function addDateKeyDays(dateKey, offset) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + offset, 12)).toISOString().slice(0, 10);
}

function closestTo(rows, target, tolerance) {
  return rows
    .map((hour) => ({ hour, distance: Math.abs(hour.timestamp - target) }))
    .filter((item) => item.distance <= tolerance)
    .sort((a, b) => a.distance - b.distance)[0]?.hour || null;
}

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function maximum(values) {
  const valid = values.map(finite).filter(Number.isFinite);
  return valid.length ? Math.max(...valid) : null;
}

function minimum(values) {
  const valid = values.map(finite).filter(Number.isFinite);
  return valid.length ? Math.min(...valid) : null;
}
