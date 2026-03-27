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

// PM Commute Risk (3–7 PM local)
let pmCommuteRisk = false;
for (const i of windowHours) {
  const t = new Date(hourly.time[i]);
  const hour = t.getHours();

  if (hour >= 15 && hour <= 19) {
    const rain = hourly.rain[i];
    const snow = hourly.snowfall[i];
    const gust = hourly.wind_gusts_10m[i];

    // More realistic thresholds:
    // - Rain ≥ 0.1 mm/hr (light but meaningful)
    // - Snow ≥ 0.1 mm/hr (light accumulation possible)
    // - Gusts > 25 mph (wind handling issues)
    if (rain >= 0.1 || snow >= 0.1 || gust > 25) {
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
