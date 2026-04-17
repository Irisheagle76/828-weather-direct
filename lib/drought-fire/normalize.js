import { clamp } from "./utils.js";

export function normalizeInputs(input) {
  const {
    precipDeficit90d_in,
    soilPercentile,
    tempAnomalyF,
    daysSinceRain,
    rh,
    windGust,
    tempF
  } = input;

  // -----------------------------
  // Normalize drought inputs
  // -----------------------------
  const precipScore = clamp(precipDeficit90d_in / 12, 0, 1);
  const soilScore   = clamp(1 - soilPercentile / 100, 0, 1);
  const heatScore   = clamp(tempAnomalyF / 15, 0, 1);
  const daysScore   = clamp(daysSinceRain / 30, 0, 1);

  let DSS_raw =
    precipScore * 0.40 +
    soilScore   * 0.30 +
    heatScore   * 0.15 +
    daysScore   * 0.15;

  // resistance when soils are extremely dry
  if (soilPercentile < 5) {
    DSS_raw *= 1.1;
  }

  const DSS = Math.round(clamp(DSS_raw, 0, 1) * 100);

  // -----------------------------
  // Weather → fire behavior
  // -----------------------------
  const rhScore   = clamp((40 - rh) / 25, 0, 1);
  const windScore = clamp(windGust / 30, 0, 1);
  const tempScore = clamp((tempF - 60) / 30, 0, 1);

  const weatherComponent =
    rhScore * 0.40 +
    windScore * 0.35 +
    tempScore * 0.25;

  let FRI_raw =
    DSS_raw * 0.65 +
    weatherComponent * 0.35;

  // Red flag style boost
  if (rh < 25 && windGust > 20) {
    FRI_raw += 0.05;
  }

  const FRI = Math.round(clamp(FRI_raw, 0, 1) * 100);

  return {
    DSS,
    FRI,
    components: {
      precipScore,
      soilScore,
      heatScore,
      rhScore,
      windScore
    }
  };
}