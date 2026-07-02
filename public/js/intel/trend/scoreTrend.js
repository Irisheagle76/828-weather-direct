export function calculatePeriodScoreTrend(scores = [], label = "today") {
  const validScores = scores.filter(Number.isFinite);
  if (validScores.length < 2) return 0;

  const trendScores = label === "tomorrow"
    ? validScores
    : validScores.slice(0, Math.min(6, validScores.length));

  return trendScores.at(-1) - trendScores[0];
}
