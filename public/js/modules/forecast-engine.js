import { getWeatherForUI } from '/js/adapters/weather-adapter.js';
import { analyzePattern, mapToInputs } from '/js/modules/analyzePattern.js';

export async function getSystemForecastForDate(dateStr) {

  const data = await getWeatherForUI({
    lat: 35.5951,
    lon: -82.5515
  });

  // normalize hourly
  const hourly = (data?.hourly || []).map(h => {
    const d = new Date(h.timestamp);
    return {
      ...h,
      localDate: d,
      localHour: d.getHours(),
      dayKey: d.toISOString().split('T')[0]
    };
  });

  // filter to requested day
  const hours = hourly.filter(h => h.dayKey === dateStr);

  if (!hours.length) {
    return null;
  }

  // map + analyze
  const inputs = mapToInputs({ ...data, hourly });
  const pattern = analyzePattern(inputs);

  // 🔥 simple human forecast builder
  const human = buildHumanForecast(pattern);

  return {
    headline: human.headline,
    narrative: human.narrative,
    tags: pattern.tension || [],
    confidence: pattern.confidence?.overall || 0.7
  };
}


// 🔥 SAME LOGIC YOU ALREADY BUILT
function buildHumanForecast(pattern) {

  let headline = "Quiet and steady conditions";

  if (pattern.dayType === "convective") {
    headline = "Warm with building clouds and storm risk";
  } else if (pattern.dayType === "nw_flow") {
    headline = "Clouds lingering with limited breaks";
  }

  const parts = [];

  if (pattern.skyBehavior?.trend === "increasing clouds") {
    parts.push("Sun early gives way to increasing cloud cover.");
  } else if (pattern.skyBehavior?.trend === "clearing") {
    parts.push("Clouds gradually break for more sun.");
  } else {
    parts.push("Conditions remain fairly steady.");
  }

  if (pattern.convection?.present) {
    parts.push("Scattered afternoon storms may develop.");
  }

  if (pattern.tension?.includes("sun vs clouds")) {
    parts.push("There’s a bit of a battle between sun and clouds.");
  }

  return {
    headline,
    narrative: parts.join(" ")
  };
}