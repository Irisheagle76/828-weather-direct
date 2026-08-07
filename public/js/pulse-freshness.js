export const PULSE_SHELF_LIFE_MS = 3 * 60 * 60 * 1000;
const ALLOWED_CLOCK_SKEW_MS = 5 * 60 * 1000;

export function pulseTimestamp(value) {
  if (value === null || value === undefined || value === "") return NaN;

  const numeric = typeof value === "number" ? value : Number(value);
  if (Number.isFinite(numeric)) {
    return numeric < 1e12 ? numeric * 1000 : numeric;
  }

  return new Date(value).getTime();
}

export function pulseExpiresAt(value) {
  const timestamp = pulseTimestamp(value);
  return Number.isFinite(timestamp) ? timestamp + PULSE_SHELF_LIFE_MS : NaN;
}

export function isPulseFresh(value, now = Date.now()) {
  const timestamp = pulseTimestamp(value);
  if (!Number.isFinite(timestamp) || !Number.isFinite(now)) return false;

  const age = now - timestamp;
  return age >= -ALLOWED_CLOCK_SKEW_MS && age < PULSE_SHELF_LIFE_MS;
}
