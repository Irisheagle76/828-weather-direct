// /intel/windows.js
// Robust local‑time window engine for Today + Tomorrow (UTC‑safe)

/**
 * Convert an Open‑Meteo UTC timestamp into a local Date object.
 */
function toLocal(t) {
  return new Date(t); // JS automatically converts UTC → local
}

/**
 * Build a window of hourly indices for the current local day.
 */
export function getTodayWindow(hourly) {
  if (!hourly?.time?.length) return [];

  const now = new Date();
  const targetYear = now.getFullYear();
  const targetMonth = now.getMonth();
  const targetDay = now.getDate();

  const indices = [];

  for (let i = 0; i < hourly.time.length; i++) {
    const t = toLocal(hourly.time[i]);

    if (
      t.getFullYear() === targetYear &&
      t.getMonth() === targetMonth &&
      t.getDate() === targetDay
    ) {
      indices.push(i);
    }
  }

  return indices;
}

/**
 * Build a window of hourly indices for the next local calendar day.
 */
export function getTomorrowWindow(hourly) {
  if (!hourly?.time?.length) return [];

  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);

  const targetYear = tomorrow.getFullYear();
  const targetMonth = tomorrow.getMonth();
  const targetDay = tomorrow.getDate();

  const indices = [];

  for (let i = 0; i < hourly.time.length; i++) {
    const t = toLocal(hourly.time[i]);

    if (
      t.getFullYear() === targetYear &&
      t.getMonth() === targetMonth &&
      t.getDate() === targetDay
    ) {
      indices.push(i);
    }
  }

  return indices;
}