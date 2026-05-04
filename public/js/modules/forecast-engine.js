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
const structured = buildStructuredForecast(pattern, hours);
const human = buildHumanForecast(structured, pattern);

return {
  human,
  meta: {
    tags: pattern.tension || [],
    confidence: pattern.confidence?.overall || 0.7
  },
  structured
};
}


// 🔥 SAME LOGIC YOU ALREADY BUILT
function buildHumanForecast(forecast, pattern) {

  // -------------------------
  // HEADLINE
  // -------------------------
  let headline = "Quiet and steady conditions";

  if (forecast.conditions.dominantType === "convective") {
    headline = "Warm, building clouds, afternoon storm risk";
  } else if (forecast.conditions.dominantType === "nw_flow") {
    headline = "Clouds holding with limited sun";
  }

  // -------------------------
  // TIMELINE (your strength)
  // -------------------------
  const t = forecast.timing;

  const timeline = [
    `Morning: ${t.morning}`,
    `Midday: ${t.midday}`,
    `Afternoon: ${t.afternoon}`,
    `Evening: ${t.evening}`
  ].filter(Boolean).join(" | ");

  // -------------------------
  // NARRATIVE (human feel)
  // -------------------------
  const parts = [];

  if (forecast.conditions.variability === "changing") {
    parts.push("Conditions evolve through the day rather than staying locked in.");
  } else {
    parts.push("Conditions stay fairly steady through the day.");
  }

  if (forecast.drivers.instability) {
    parts.push("Instability builds, allowing scattered storm development.");
  }

  if (pattern.tension?.includes("sun vs clouds")) {
    parts.push("There’s a push and pull between sun and clouds.");
  }

  const narrative = parts.join(" ");

  // -------------------------
  // LOCAL INSIGHT (your edge)
  // -------------------------
  let localInsight = null;

  if (forecast.localEffects.terrainInfluence === "upslope clouds") {
    localInsight = "Northwest flow may keep clouds locked along the ridges.";
  }

  if (forecast.localEffects.radiationalCooling) {
    localInsight = "Clearer pockets may allow temperatures to drop quickly overnight.";
  }

  // -------------------------
  // CONFIDENCE
  // -------------------------
  let confidenceNote = null;

  if (forecast.conditions.confidence < 0.6) {
    confidenceNote = "There’s some uncertainty in how this evolves.";
  }

  return {
    headline,
    narrative,
    timeline,
    confidenceNote,
    localInsight
  };
}

function buildStructuredForecast(pattern, hourly) {

  return {

    timing: {
      morning: describeWindow(hourly, 6, 11),
      midday: describeWindow(hourly, 11, 14),
      afternoon: describeWindow(hourly, 14, 18),
      evening: describeWindow(hourly, 18, 22),
      overnight: describeWindow(hourly, 22, 6)
    },

    conditions: {
      dominantType: pattern.dayType,
      confidence: pattern.confidence?.overall,
      variability: pattern.tension?.length ? "changing" : "steady"
    },

    drivers: {
      tempTrend: pattern.temperature?.trend,
      dewPoint: pattern.moistureProfile?.surface,
      wind: pattern.windProfile?.speed,
      skyCover: pattern.skyBehavior?.coverage,
      instability: pattern.convection?.intensity,
      moistureDepth: pattern.moistureProfile?.depth
    },

    hazards: {
      rainWindow: pattern.convection?.timing,
      stormRisk: pattern.convection?.present,
      severePotential: pattern.convection?.intensity === "strong",
      winterPrecipType: null
    },

    localEffects: {
      terrainInfluence: pattern.localEffects?.terrainInfluence,
      radiationalCooling: pattern.localEffects?.radiationalCooling,
      sunBreakPotential: pattern.skyBehavior?.trend === "clearing"
    }
  };
}

function describeWindow(hours, start, end) {
  const subset = hours.filter(h => {
    const hr = h.localHour;
    return start < end
      ? hr >= start && hr < end
      : hr >= start || hr < end;
  });

  if (!subset.length) return null;

  const rain = subset.some(h => h.precipProbability > 40);
  const clouds = subset.some(h => h.cloudCover > 60);

  if (rain) return "showers possible";
  if (clouds) return "mostly cloudy";
  return "partly sunny";
}