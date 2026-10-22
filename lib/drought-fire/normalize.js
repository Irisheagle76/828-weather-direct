import { clamp } from "./utils.js";
import { seasonalFireComponents } from "./seasonal.js";

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

  const seasonal = seasonalFireComponents({ timestamp: input.timestamp, seasonMode: input.seasonMode, rhScore, windScore, tempScore,
    daysSinceRain, rainTodayIn: safeRainTodayIn, rainRateInHr: safeRainRateInHr });
  const weatherComponent = seasonal.weatherComponent;

  // Dry fuels establish potential, but today's weather has to activate them.
  // Keeping most of DSS as a direct contribution created an unrealistically
  // high floor on humid, calm days (DSS 80 alone contributed 56 FRI points).
  let FRI_raw =
    DSS_raw * 0.35 +
    weatherComponent * 0.30 +
    DSS_raw * weatherComponent * 0.35 + seasonal.fineFuelProxy;

    if (DSS_raw > 0.7 && safeWindGust > 10) {
  FRI_raw += 0.05;
}

  // Red flag style boost
  if (safeRh < 25 && safeWindGust > 20) {
    FRI_raw += 0.05;
  }

  // Only observed rain can damp the current score. Forecast rain is supplied
  // as accumulated rain in the separate six-hour outlook calculation.
  const wetWeatherScore = Math.max(
    safeRainRateInHr >= 0.01 ? 1 : 0,
    clamp(safeRainTodayIn / 0.35, 0, 1),
    safeRh >= 90 ? 0.55 : safeRh >= 80 ? 0.35 : 0
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
      season: { mode: seasonal.mode, profile: seasonal.profile, weight: seasonal.weight },
      seasonalFineFuelPoints: seasonal.fineFuelProxy * 100,
      autumnWeight: seasonal.profile === 'fall' ? seasonal.weight : 0,
      autumnFineFuelPoints: seasonal.profile === 'fall' ? seasonal.fineFuelProxy * 100 : 0,
      weatherWeights: seasonal.weatherWeights,
      wetWeatherScore
    }
  };
}

function numberOr(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}
