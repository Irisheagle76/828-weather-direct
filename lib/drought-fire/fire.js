export function buildFireDriver({
  droughtScore,
  wind,
  humidity,
  rainTodayIn = 0,
  rainRateInHr = 0,
  rainNext6hIn = 0,
  precipProbabilityToday = 0
}) {
  const d = droughtScore / 100;
  const wetToday = rainTodayIn >= 0.1 || rainNext6hIn >= 0.1 || rainRateInHr >= 0.01;
  const veryWetToday = rainTodayIn >= 0.25 || rainNext6hIn >= 0.25 || rainRateInHr >= 0.03;
  const showerySetup = precipProbabilityToday >= 0.35 && humidity >= 80;

  if (veryWetToday) {
    return "Fire behavior is limited by wet weather today; drought stress remains in the background";
  }

  if (wetToday || showerySetup) {
    return "Wet, humid weather is holding today's fire threat down despite dry fuels";
  }

  const isVeryDryFuel = d >= 0.75;
  const isDryFuel     = d >= 0.60;

  const isWindy  = wind >= 15;
  const isBreezy = wind >= 10;

  const dryAir     = humidity <= 25;
  const veryDryAir = humidity <= 20;

  // -----------------------------
  // Highest concern
  // -----------------------------
  if (isVeryDryFuel && veryDryAir && isWindy) {
    return "Critical fire conditions due to very dry fuels, low humidity, and strong wind";
  }

  if (isVeryDryFuel && dryAir && isWindy) {
    return "Very high fire risk driven by dry fuels and gusty wind";
  }

  // -----------------------------
  // Drought-driven
  // -----------------------------
  if (isVeryDryFuel && isBreezy) {
    return "Elevated due to very dry fuels and increasing wind";
  }

  if (isVeryDryFuel) {
    return "Elevated due to very dry fuels";
  }

  // -----------------------------
  // Mixed drivers
  // -----------------------------
  if (isDryFuel && dryAir && isBreezy) {
    return "Elevated due to dry fuels, low humidity, and light wind";
  }

  if (isDryFuel && isBreezy) {
    return "Elevated due to dry fuels and light wind";
  }

  if (isDryFuel && dryAir) {
    return "Elevated due to dry fuels and low humidity";
  }

  if (isDryFuel) {
    return "Moderate fire risk with gradually drying fuels";
  }

  // -----------------------------
  // Weather-driven only
  // -----------------------------
  if (dryAir && isWindy) {
    return "Driven by low humidity and gusty wind despite limited dryness";
  }

  if (dryAir) {
    return "Low humidity is increasing fire potential";
  }

  if (isWindy) {
    return "Wind could allow fires to spread if ignition occurs";
  }

  // -----------------------------
  // Moist conditions
  // -----------------------------
  if (d < 0.35) {
    return "Limited by recent moisture";
  }

  return "Moderate conditions overall";
}
