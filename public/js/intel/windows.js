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

  // 1) Collect ALL hours that belong to tomorrow
  const allTomorrow = [];

  for (let i = 0; i < hourly.time.length; i++) {
    const t = new Date(hourly.time[i]);

    if (
      t.getDate() === day &&
      t.getMonth() === month &&
      t.getFullYear() === year
    ) {
      allTomorrow.push(i);
    }
  }

  // 2) If nothing found, bail safely
  if (allTomorrow.length === 0) return [];

  // 3) Sort those hours by temperature (warmest first)
  const sortedByTemp = allTomorrow.sort(
    (a, b) => hourly.temperature_2m[b] - hourly.temperature_2m[a]
  );

  // 4) Take top N warmest hours (captures true daytime peak)
  const TOP_HOURS = 8;
  const selected = sortedByTemp.slice(0, TOP_HOURS);

  return selected;
}