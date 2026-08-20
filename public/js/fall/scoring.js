const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const mean = (values) => {
  const usable = values.filter(Number.isFinite);
  return usable.length ? usable.reduce((sum, value) => sum + value, 0) / usable.length : null;
};
const easternHour = (timestamp) => Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", hour12: false }).format(new Date(timestamp))) % 24;

export const FALL_SCORE_WEIGHTS = Object.freeze({
  dry: 0.27,
  visibility: 0.23,
  wind: 0.18,
  comfort: 0.17,
  light: 0.15
});

export function ratingForScore(score) {
  if (score >= 90) return "Exceptional";
  if (score >= 80) return "Excellent";
  if (score >= 70) return "Very Good";
  if (score >= 60) return "Good";
  if (score >= 45) return "Fair";
  return "Poor";
}

export function scoreFallHours(hours = []) {
  const daylight = hours.filter((hour) => {
    const localHour = easternHour(hour.timestamp);
    return localHour >= 8 && localHour <= 19;
  });
  const sample = daylight.length ? daylight : hours;
  const usable = sample.filter((hour) => Number.isFinite(hour.temperatureF) && Number.isFinite(hour.cloudCover) && Number.isFinite(hour.windSpeed));
  const minimumHours = daylight.length ? 1 : 3;
  if (usable.length < minimumHours) return unavailableScore(usable.length);
  const pop = mean(usable.map((h) => h.precipProbability)) ?? 0;
  const rain = usable.reduce((sum, h) => sum + (Number(h.precipAmount ?? h.precipitation) || 0), 0);
  const clouds = mean(usable.map((h) => h.cloudCover)) ?? 0.5;
  const wind = mean(usable.map((h) => h.windSpeed)) ?? 7;
  const gust = Math.max(0, ...usable.map((h) => Number(h.windGust) || 0));
  const temperature = mean(usable.map((h) => h.temperatureF)) ?? 60;
  const visibilityMiles = mean(usable.map((h) => h.visibilityMiles));
  const cloudVisibility = clamp(100 - clouds * 68 - Math.max(0, pop - 0.35) * 25);
  const modeledVisibility = Number.isFinite(visibilityMiles) ? clamp((visibilityMiles / 10) * 100) : null;

  const factors = {
    dry: clamp(100 - pop * 60 - Math.min(rain, 0.35) * 145),
    visibility: Number.isFinite(modeledVisibility) ? cloudVisibility * 0.68 + modeledVisibility * 0.32 : cloudVisibility,
    wind: clamp(100 - Math.max(0, wind - 7) * 3.1 - Math.max(0, gust - 18) * 2.1),
    comfort: clamp(100 - Math.abs(temperature - 61) * 2.15),
    light: clamp(100 - Math.abs(clouds - 0.3) * 82 - pop * 20)
  };
  const score = Math.round(Object.entries(FALL_SCORE_WEIGHTS).reduce((sum, [key, weight]) => sum + factors[key] * weight, 0));
  return { available: true, sampleHours: usable.length, score, rating: ratingForScore(score), factors, metrics: { pop, rain, clouds, wind, gust, temperature, visibilityMiles } };
}

export function leafDropRisk(hours = []) {
  const usable = hours.filter((hour) => Number.isFinite(hour.windSpeed) || Number.isFinite(hour.windGust) || Number.isFinite(hour.temperatureF));
  if (usable.length < 3) return { available: false, category: "Unavailable", points: null, gust: null, rain: null, minimum: null };
  const gust = Math.max(0, ...usable.map((h) => Number(h.windGust) || 0));
  const wind = Math.max(0, ...usable.map((h) => Number(h.windSpeed) || 0));
  const rain = usable.reduce((sum, h) => sum + (Number(h.precipAmount ?? h.precipitation) || 0), 0);
  const minimum = Math.min(99, ...usable.map((h) => Number(h.temperatureF)).filter(Number.isFinite));
  const points = Math.max(0, gust - 18) * 2.4 + Math.max(0, wind - 14) * 1.5 + Math.min(rain, 1) * 38 + Math.max(0, 29 - minimum) * 2;
  const category = points >= 70 ? "Very High" : points >= 42 ? "High" : points >= 20 ? "Moderate" : "Low";
  return { available: true, category, points: Math.round(points), gust, rain, minimum };
}

export function viewScore(hours = [], liveScore = null) {
  const scored = scoreFallHours(hours);
  if (!scored.available) return null;
  const chartScore = Math.round(scored.factors.visibility * 0.72 + scored.factors.wind * 0.28);
  return Number.isFinite(liveScore) ? Math.round(chartScore * 0.65 + liveScore * 0.35) : chartScore;
}

function unavailableScore(sampleHours) {
  return {
    available: false,
    sampleHours,
    score: null,
    rating: "Unavailable",
    factors: { dry: null, visibility: null, wind: null, comfort: null, light: null },
    metrics: { pop: null, rain: null, clouds: null, wind: null, gust: null, temperature: null, visibilityMiles: null }
  };
}
