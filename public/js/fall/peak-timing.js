const MODEL = Object.freeze({
  slopeDaysPerF: 1.9015,
  interceptOctoberDay: -106.42,
  septemberNormalF: 64.7,
  rSquared: 0.62,
  sampleYears: "2008–2025",
  excludedYears: [2024],
  elevationRange: "2,500–4,000 ft",
  referenceArea: "Boone–Grandfather region"
});

const DAY_MS = 24 * 60 * 60 * 1000;

export function estimatePeakTiming({ seasonYear = new Date().getFullYear(), septemberMeanF = null, source = null } = {}) {
  const measuredMean = Number(septemberMeanF);
  const hasSeasonInput = Number.isFinite(measuredMean) && measuredMean >= 45 && measuredMean <= 85;
  const effectiveMeanF = hasSeasonInput ? measuredMean : MODEL.septemberNormalF;
  const predictedOctoberDay = clamp(MODEL.slopeDaysPerF * effectiveMeanF + MODEL.interceptOctoberDay, 1, 31);
  const midpoint = dateFromOctoberDay(seasonYear, predictedOctoberDay);
  const shiftDays = MODEL.slopeDaysPerF * (effectiveMeanF - MODEL.septemberNormalF);

  return {
    seasonYear,
    midpoint: formatMonthDay(midpoint),
    midpointIso: isoDate(midpoint),
    planningWindow: `${formatMonthDay(new Date(midpoint.getTime() - 3 * DAY_MS))}–${formatMonthDay(new Date(midpoint.getTime() + 3 * DAY_MS))}`,
    shiftDays: Math.round(shiftDays * 10) / 10,
    septemberMeanF: Math.round(effectiveMeanF * 10) / 10,
    inputType: hasSeasonInput ? "seasonal" : "climatology",
    inputLabel: hasSeasonInput ? (source || "Supplied September mean") : "Long-term September baseline",
    confidence: hasSeasonInput ? "Experimental temperature-adjusted estimate" : "Historical baseline estimate",
    model: MODEL,
    caveat: "A planning signal, not a predictive confidence interval. The relationship is sensitive to the unusually warm 2018 and 2019 seasons and does not quantify an elevation adjustment outside the calibrated band."
  };
}

function dateFromOctoberDay(year, day) {
  return new Date(Date.UTC(year, 9, Math.round(day)));
}

function formatMonthDay(date) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric" }).format(date);
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export { MODEL as PEAK_TIMING_MODEL };
