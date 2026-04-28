export function computeImpact(hazards = {}) {
  let impact = 0;

  const lightning = hazards.lightning;

  if (lightning?.detected) {
    const d = lightning.distanceMiles ?? 10;

    if (d <= 3) impact += 70;
    else if (d <= 6) impact += 55;
    else if (d <= 10) impact += 40;
    else impact += 25;
  }

  if (hazards.thunder) impact += 15;

  const rainMap = {
    none: 0,
    mist: 5,
    light: 10,
    steady: 20,
    heavy: 30
  };

  impact += rainMap[hazards.rainContext] || 0;

  return Math.min(impact, 100);
}

export function getImpactLabel(impact) {
  if (impact >= 80) return "Hazardous";
  if (impact >= 60) return "Stormy";
  if (impact >= 40) return "Unsettled";
  if (impact >= 20) return "Active";
  return "Calm";
}