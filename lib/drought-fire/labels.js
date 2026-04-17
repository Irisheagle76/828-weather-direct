export function labelDSS(score) {
  if (score < 20) return "Normal";
  if (score < 40) return "Dry";
  if (score < 60) return "Moderate";
  if (score < 80) return "Severe";
  return "Extreme";
}

export function labelFRI(score) {
  if (score < 20) return "Low";
  if (score < 40) return "Moderate";
  if (score < 60) return "Elevated";
  if (score < 80) return "High";
  return "Extreme";
}