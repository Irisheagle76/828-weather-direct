import { clamp } from "./utils.js";

export function normalizeInputs(input) {
  const {
    precipDeficit90d_in,
    precipDeficitSeasonal_in = 0,
    soilPercentile,
    tempAnomalyF,
    daysSinceRain,
    rh,
    windGust,
    tempF,
    rainTodayIn,
    rainRateInHr,
    rainNext6hIn,
    precipProbabilityToday
  } = input;

  const safePrecipDeficit90d = numberOr(precipDeficit90d_in, 0);
  const safeSeasonalDeficit = numberOr(precipDeficitSeasonal_in, 0);
  const safeSoilPercentile = numberOr(soilPercentile, 50);
  const safeTempAnomalyF = numberOr(tempAnomalyF, 0);
  const safeDaysSinceRain = numberOr(daysSinceRain, 0);
  const safeRh = numberOr(rh, 40);
  const safeWindGust = numberOr(windGust, 0);
  const safeTempF = numberOr(tempF, 60);
  const safeRainTodayIn = numberOr(rainTodayIn, 0);
  const safeRainRateInHr = numberOr(rainRateInHr, 0);
  const safeRainNext6hIn = numberOr(rainNext6hIn, 0);
  const safePrecipProbabilityToday = numberOr(precipProbabilityToday, 0);

  // -----------------------------
  // Normalize drought inputs
  // -----------------------------
  const precipScore = clamp(safePrecipDeficit90d / 12, 0, 1);
  const seasonalPrecipScore = clamp(safeSeasonalDeficit / 16, 0, 1);
  const soilScore   = clamp(1 - safeSoilPercentile / 100, 0, 1);
  const heatScore   = clamp(safeTempAnomalyF / 15, 0, 1);
  const daysScore   = clamp(safeDaysSinceRain / 30, 0, 1);

  let DSS_raw =
    precipScore * 0.25 +
    seasonalPrecipScore * 0.25 +
    soilScore   * 0.30 +
    daysScore   * 0.15 +
    heatScore   * 0.05;

  // resistance when soils are extremely dry
  if (safeSoilPercentile < 5) {
    DSS_raw *= 1.1;
  }

  const DSS = Math.round(clamp(DSS_raw, 0, 1) * 100);

  // -----------------------------
  // Weather → fire behavior
  // -----------------------------
  const rhScore   = clamp((40 - safeRh) / 25, 0, 1);
  const windScore = clamp(safeWindGust / 30, 0, 1);
  const tempScore = clamp((safeTempF - 60) / 30, 0, 1);

  const weatherComponent =
    rhScore * 0.40 +
    windScore * 0.35 +
    tempScore * 0.25;

  let FRI_raw =
    DSS_raw * 0.70 + weatherComponent * 0.30;

    if (DSS_raw > 0.7 && safeWindGust > 10) {
  FRI_raw += 0.05;
}

  // Red flag style boost
  if (safeRh < 25 && safeWindGust > 20) {
    FRI_raw += 0.05;
  }

  const wetWeatherScore = Math.max(
    safeRainRateInHr >= 0.01 ? 1 : 0,
    clamp(safeRainTodayIn / 0.35, 0, 1),
    clamp(safeRainNext6hIn / 0.35, 0, 1),
    safeRh >= 90 ? 0.55 : safeRh >= 80 ? 0.35 : 0,
    safePrecipProbabilityToday >= 0.6 ? 0.45 : safePrecipProbabilityToday >= 0.35 ? 0.25 : 0
  );

  if (wetWeatherScore >= 0.9) {
    FRI_raw = Math.min(FRI_raw, 0.28);
  } else if (wetWeatherScore >= 0.65) {
    FRI_raw = Math.min(FRI_raw, 0.35);
  } else if (wetWeatherScore >= 0.4) {
    FRI_raw = Math.min(FRI_raw, 0.38);
  }

  const FRI = Math.round(clamp(FRI_raw, 0, 1) * 100);

  return {
    DSS,
    FRI,
    DSS_raw, 
  FRI_raw,
    components: {
      precipScore,
      seasonalPrecipScore,
      soilScore,
      heatScore,
      rhScore,
      windScore,
      wetWeatherScore
    }
  };
}

function numberOr(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}
