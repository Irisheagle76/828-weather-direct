// /intel/windows.js
// Modern time-window engine for Today + Tomorrow

export function getTodayWindow(hourly) {
  if (!hourly?.time?.length) return [];

  const now = new Date();
  const today = now.getDate();
  const month = now.getMonth();
  const year = now.getFullYear();

  const start = new Date(year, month, today, 0, 0, 0);
  const end = new Date(year, month, today, 23, 59, 59);

  const indices = [];

 if (
  t.getDate() === day &&
  t.getMonth() === month &&
  t.getFullYear() === year
) {
  const hour = t.getHours();

  // 🔥 UPDATED WINDOW (this is the fix)
  if (hour >= 9 && hour <= 22) {
    indices.push(i);
  }
}

  return indices;
}

export function getTomorrowWindow(hourly) {
  if (!hourly?.time?.length) return [];

  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);

  const day = tomorrow.getDate();
  const month = tomorrow.getMonth();
  const year = tomorrow.getFullYear();

  const start = new Date(year, month, day, 0, 0, 0);
  const end = new Date(year, month, day, 23, 59, 59);

  const indices = [];

  for (let i = 0; i < hourly.time.length; i++) {
    const t = new Date(hourly.time[i]);
    if (t >= start && t <= end) {
      indices.push(i);
    }
  }

  return indices;
}
