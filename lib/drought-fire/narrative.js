export function buildNarrative(ctx) {
  const bullets = [];

  if (ctx.soilScore > 0.85) {
    bullets.push("Soils are critically dry");
  } else if (ctx.precipScore > 0.7) {
    bullets.push("Significant rainfall deficit");
  }

  if (ctx.heatScore > 0.6) {
    bullets.push("Warm temperatures accelerating drying");
  }

  if (ctx.rhScore > 0.6) {
    bullets.push("Very low humidity increasing fire risk");
  }

  if (ctx.windScore > 0.6) {
    bullets.push("Gusty winds could spread fire quickly");
  }

  return {
    headline: buildHeadline(ctx),
    bullets: bullets.slice(0, 3)
  };
}

function buildHeadline({ FRI, DSS }) {
  if (FRI >= 80) return "Extreme fire danger";
  if (FRI >= 60) return "High fire risk today";
  if (DSS >= 70) return "Severe drought stress ongoing";
  return "Dry conditions in place";
}