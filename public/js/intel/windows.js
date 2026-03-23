// /intel/windows.js
// Modern time-window engine for Today + Tomorrow

export function getTodayWindow(hourly) {
  if (!hourly?.time?.length) return [];

  const now = new Date();

  const day = now.getDate();
  const month = now.getMonth();
  const year = now.getFullYear();

  const indices = [];

  for (let i = 0; i < hourly.time.length; i++) {
    const t = new Date(hourly.time[i]);

    if (
      t.getDate() === day &&
      t.getMonth() === month &&
      t.getFullYear() === year
    ) {
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

  const indices = [];

  for (let i = 0; i < hourly.time.length; i++) {
    const t = new Date(hourly.time[i]);

    if (
      t.getDate() === day &&
      t.getMonth() === month &&
      t.getFullYear() === year
    ) {
      indices.push(i);
    }
  }

  return indices;
}