const DISPLAY_TIME_ZONE = "America/New_York";

export function publishedTomorrowDay(forecast = {}, now = Date.now()) {
  const tomorrowKey = addCalendarDays(easternDateKey(now), 1);
  if (!tomorrowKey) return null;

  const day = forecast?.days?.[tomorrowKey];
  if (!day || (day.date && day.date !== tomorrowKey)) return null;
  return day;
}

export function mergePublishedTomorrowSummary(summary = {}, forecast = {}, now = Date.now()) {
  const published = publishedTomorrowDay(forecast, now);
  if (!published) return summary;

  const usePublishedNarrative = forecast?.global?.overrideNarrative !== false;
  const publishedFields = [];
  const merged = { ...summary };

  applyNumber(merged, publishedFields, published, "high");
  applyNumber(merged, publishedFields, published, "low");
  applyNumber(merged, publishedFields, published, "feelScore", "score");

  const rainChance = normalizeProbability(published.rainChance);
  if (Number.isFinite(rainChance)) {
    merged.rainChance = rainChance;
    publishedFields.push("rainChance");
  }

  if (usePublishedNarrative) {
    applyText(merged, publishedFields, published, "headline");
    applyText(merged, publishedFields, published, "narrative");
  }

  return {
    ...merged,
    diagnostics: {
      ...(summary.diagnostics || {}),
      publishedOverride: true,
      publishedFields,
      publishedAt: forecast?.metadata?.publishedAt || forecast?.lastUpdated || null,
      publicationSource: forecast?.metadata?.publicationSource || forecast?.source || null
    }
  };
}

function applyNumber(target, fields, source, sourceKey, targetKey = sourceKey) {
  const value = finite(source?.[sourceKey]);
  if (!Number.isFinite(value)) return;
  target[targetKey] = value;
  fields.push(sourceKey);
}

function applyText(target, fields, source, key) {
  const value = String(source?.[key] ?? "").trim();
  if (!value) return;
  target[key] = value;
  fields.push(key);
}

function normalizeProbability(value) {
  const number = finite(value);
  if (!Number.isFinite(number) || number < 0 || number > 100) return null;
  return number > 1 ? number / 100 : number;
}

function easternDateKey(value) {
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp)) return null;

  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: DISPLAY_TIME_ZONE
  }).formatToParts(new Date(timestamp));
  const part = (type) => parts.find((item) => item.type === type)?.value;
  const year = part("year");
  const month = part("month");
  const day = part("day");
  return year && month && day ? `${year}-${month}-${day}` : null;
}

function addCalendarDays(dateKey, offset) {
  const match = String(dateKey || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + offset));
  return date.toISOString().slice(0, 10);
}

function finite(value) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
