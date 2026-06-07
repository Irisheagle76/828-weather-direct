export function cleanHikingText(value = "") {
  return String(value || "")
    .replace(/degF/g, "\u00b0F")
    .replace(/\s+/g, " ")
    .trim();
}

export function homeHikingScore(guidance = {}) {
  const uv = Number(guidance.maxUv ?? 0);
  const gust = Number(guidance.maxGust ?? 0);
  const fogPenalty = guidance.fogRisk === "Elevated" ? 8 : 0;
  const gustPenalty = gust >= 20 ? 8 : gust >= 14 ? 4 : 0;
  const spreadPenalty = Number(guidance.localTempSpread ?? 0) > 12 ? 5 : 0;
  const uvPenalty = uv >= 6 ? 8 : uv >= 3 ? 3 : 0;
  return Math.max(45, Math.min(96, Math.round(82 - fogPenalty - gustPenalty - spreadPenalty - uvPenalty)));
}

const headlineRules = [
  {
    matches: ({ lightning }) => lightning.active || Number(lightning.strikeCount1h) > 0,
    text: "Thunder nearby? Let the trail read choose your window."
  },
  {
    matches: ({ gust }) => gust >= 20,
    text: "Ridge winds are writing the trail story right now."
  },
  {
    matches: ({ guidance }) => guidance.fogRisk === "Elevated",
    text: "Fog in the high peaks, friendlier hundreds of feet below."
  },
  {
    matches: ({ mitchellDrop }) => mitchellDrop >= 14,
    text: "Asheville feels warm; Mitchell is asking for a layer."
  },
  {
    matches: ({ uv }) => uv >= 6,
    text: "Shade is the smart trail choice today."
  },
  {
    matches: ({ score }) => score >= 86,
    text: "Trail weather is giving Asheville the green light."
  },
  {
    matches: ({ score }) => score >= 70,
    text: "Good trail weather, with a high-peak catch."
  }
];

export function homeHikingHeadline(guidance = {}) {
  const context = {
    guidance,
    score: homeHikingScore(guidance),
    mitchellDrop: Number(guidance.mitchellDrop),
    gust: Number(guidance.maxGust),
    uv: Number(guidance.maxUv),
    lightning: guidance.lightning || {}
  };
  return headlineRules.find((rule) => rule.matches(context))?.text || "Pick the trail by the mountain mood.";
}

export function homeHikingSummary(guidance = {}) {
  const mitchellDrop = Number(guidance.mitchellDrop);
  const localSpread = Number(guidance.localTempSpread);
  const gust = Number(guidance.maxGust);
  const pieces = [];

  if (Number.isFinite(localSpread)) {
    pieces.push(`Asheville-area trailheads are running within about ${Math.round(localSpread)}\u00b0F of each other`);
  }
  if (Number.isFinite(mitchellDrop)) {
    pieces.push(`Mount Mitchell is about ${Math.round(mitchellDrop)}\u00b0F cooler`);
  }
  if (guidance.fogRisk === "Elevated") {
    pieces.push("damp pockets or low cloud may linger in sheltered spots");
  } else if (Number.isFinite(gust) && gust >= 14) {
    pieces.push(`gusts near ${Math.round(gust)} mph make exposed ridges worth checking`);
  }

  if (pieces.length) {
    return `${pieces.join(", ")}. Use the full guide to match the hike to the elevation.`;
  }
  return cleanHikingText(guidance.hikerNarrative || "Lower and mid-elevation trails look manageable, while high peaks still deserve a separate wind, cloud, and layer check.");
}

export function homeHikingBestBet(guidance = {}) {
  return cleanHikingText(guidance.bestWindow || "Forest shade and lower-to-mid elevation trails look like the friendliest lane.");
}

export function homeHikingUseCare(guidance = {}) {
  if (guidance.fogRisk === "Elevated") {
    return "Watch for slick shaded stretches, damp leaves, and low cloud near the higher gaps.";
  }
  if (Number(guidance.mitchellDrop) >= 10) {
    return "High peaks can run much cooler than town, so keep a layer handy.";
  }
  return "Exposed ridges still deserve a quick wind and sky check.";
}
