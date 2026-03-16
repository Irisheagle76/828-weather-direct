// /intel/forecast-intel.js
import { buildComfort } from "./comfort.js";
import { synthesizeOutlook } from "./synthesizer.js";
import { computeStats } from "./stats.js";
import { computeEvents } from "./events.js";
import { getTodayWindow, getTomorrowWindow } from "./windows.js";

export function buildWeatherIntel(hourly) {
  const nowIndex = 0; // assume first hour is "now"
  const hourlyNow = {
    temperature_2m: hourly.temperature_2m[nowIndex],
    dewpoint_2m: hourly.dewpoint_2m[nowIndex],
    wind_speed_10m: hourly.wind_speed_10m[nowIndex],
    wind_gusts_10m: hourly.wind_gusts_10m[nowIndex]
  };

  // Windows
  const todayHours = getTodayWindow(hourly);
  const tomorrowHours = getTomorrowWindow(hourly);

  // Stats + Events
  const statsToday = computeStats(hourly, todayHours);
  const statsTomorrow = computeStats(hourly, tomorrowHours);

  const eventsToday = computeEvents(hourly, todayHours, statsToday);
  const eventsTomorrow = computeEvents(hourly, tomorrowHours, statsTomorrow);

  // Synthesized Outlooks
  const todayOutlook = synthesizeOutlook(statsToday, eventsToday, todayHours);
  const tomorrowOutlook = synthesizeOutlook(statsTomorrow, eventsTomorrow, tomorrowHours);

  return {
    today: {
      available: todayHours.length > 0,
      ...todayOutlook,
      stats: statsToday,
      events: eventsToday
    },
    tomorrow: {
      available: tomorrowHours.length > 0,
      ...tomorrowOutlook,
      stats: statsTomorrow,
      events: eventsTomorrow
    },
    comfort: null, // filled in by app.js after WU data arrives
    wu: null,
    mrms: null
  };
}
