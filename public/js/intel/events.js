// /intel/events.js
// Modern event detection for Today/Tomorrow windows

export function computeEvents(hourly, windowHours, stats) {
  if (!windowHours || windowHours.length === 0) {
    return {
      pmCommuteRisk: false,
      windNotable: false,
      precipNotable: false,
      snowNotable: false,
      cloudNotable: false
    };
  }

  const { windGustMax, rainTotal, snowTotal, cloudAvg } = stats;

  // -----------------------------
  // PM Commute Risk (3–7 PM local)
  // -----------------------------
  let pmCommuteRisk = false;
  for (const i of windowHours) {
    const t = new Date(hourly.time[i]);
    const hour = t.getHours();
    if (hour >= 15 && hour <= 19) {
      if (hourly.rain[i] > 0.03 || hourly.snowfall[i] > 0.03 || hourly.wind_gusts_10m[i] > 25) {
        pmCommuteRisk = true;
        break;
      }
    }
  }

  // -----------------------------
  // Notable Events
  // -----------------------------
  const windNotable = windGustMax > 30;
  const precipNotable = rainTotal > 0.25;
  const snowNotable = snowTotal > 0.25;
  const cloudNotable = cloudAvg > 80;

  return {
    pmCommuteRisk,
    windNotable,
    precipNotable,
    snowNotable,
    cloudNotable
  };
}
