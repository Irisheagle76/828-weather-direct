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
    tempF
  } = input;

  const safePrecipDeficit90d = numberOr(precipDeficit90d_in, 0);
  const safeSeasonalDeficit = numberOr(precipDeficitSeasonal_in, 0);
  const safeSoilPercentile = numberOr(soilPercentile, 50);
  const safeTempAnomalyF = numberOr(tempAnomalyF, 0);
  const safeDaysSinceRain = numberOr(daysSinceRain, 0);
  const safeRh = numberOr(rh, 40);
  const safeWindGust = numberOr(windGust, 0);
  const safeTempF = numberOr(tempF, 60);

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
      windScore
    }
  };
}

function numberOr(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}
