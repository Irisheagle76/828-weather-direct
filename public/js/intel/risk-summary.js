// /intel/risk-summary.js
// ============================================================
// RISK SUMMARY ENGINE — Converts numeric risks into narrative,
// Asheville-aware, human-friendly guidance.
// ============================================================

export function summarizeRisks(risks) {
  if (!risks) return {};

  const {
    frostRisk,
    freezeRisk,
    inversionRisk,
    blackIceRisk,
    valleyFogRisk,
    ridgeFogRisk
  } = risks;

  // ------------------------------------------------------------
  // Helper: turn a 0–1 risk into a qualitative label
  // ------------------------------------------------------------
  function label(r) {
    if (r >= 0.9) return "High";
    if (r >= 0.6) return "Moderate";
    if (r >= 0.3) return "Low";
    return "None";
  }

  // ------------------------------------------------------------
  // Frost
  // ------------------------------------------------------------
  let frost = null;
  if (frostRisk >= 0.9) frost = "Frost is likely overnight, especially in sheltered spots.";
  else if (frostRisk >= 0.6) frost = "Patchy frost is possible in cooler valleys.";
  else if (frostRisk >= 0.3) frost = "A light touch of frost can't be ruled out.";
  else frost = "No frost concerns.";

  // ------------------------------------------------------------
  // Freeze
  // ------------------------------------------------------------
  let freeze = null;
  if (freezeRisk >= 0.9) freeze = "A hard freeze is expected — protect sensitive plants.";
  else if (freezeRisk >= 0.6) freeze = "A light freeze is possible in colder pockets.";
  else if (freezeRisk >= 0.3) freeze = "Temperatures may flirt with freezing in low spots.";
  else freeze = "No freeze concerns.";

  // ------------------------------------------------------------
  // Black Ice
  // ------------------------------------------------------------
  let blackIce = null;
  if (blackIceRisk >= 0.9) blackIce = "Black ice is likely — use caution on bridges and shaded roads.";
  else if (blackIceRisk >= 0.6) blackIce = "Some slick spots are possible early, especially on bridges.";
  else if (blackIceRisk >= 0.3) blackIce = "A few isolated slick patches can't be ruled out.";
  else blackIce = "No black ice concerns.";

  // ------------------------------------------------------------
  // Valley Fog
  // ------------------------------------------------------------
  let valleyFog = null;
  if (valleyFogRisk >= 0.9) valleyFog = "Dense valley fog is likely — visibility may drop sharply near dawn.";
  else if (valleyFogRisk >= 0.6) valleyFog = "Patchy valley fog is possible in the early morning hours.";
  else if (valleyFogRisk >= 0.3) valleyFog = "A little valley fog may form in sheltered areas.";
  else valleyFog = "No valley fog concerns.";

  // ------------------------------------------------------------
  // Ridge Fog
  // ------------------------------------------------------------
  let ridgeFog = null;
  if (ridgeFogRisk >= 0.9) ridgeFog = "Thick ridge-top fog is likely — expect low visibility on higher roads.";
  else if (ridgeFogRisk >= 0.6) ridgeFog = "Some ridge-top fog is possible, especially near sunrise.";
  else if (ridgeFogRisk >= 0.3) ridgeFog = "A bit of ridge fog may develop on higher terrain.";
  else ridgeFog = "No ridge fog concerns.";

  // ------------------------------------------------------------
  // Inversion
  // ------------------------------------------------------------
  let inversion = null;
  if (inversionRisk >= 0.9) inversion = "A strong temperature inversion is likely — expect stagnant air.";
  else if (inversionRisk >= 0.6) inversion = "A temperature inversion may form, trapping cooler air in valleys.";
  else if (inversionRisk >= 0.3) inversion = "A weak inversion is possible in sheltered areas.";
  else inversion = "No inversion concerns.";

  // ------------------------------------------------------------
  // Return structured summary
  // ------------------------------------------------------------
  return {
    frost: { risk: frostRisk, label: label(frostRisk), summary: frost },
    freeze: { risk: freezeRisk, label: label(freezeRisk), summary: freeze },
    blackIce: { risk: blackIceRisk, label: label(blackIceRisk), summary: blackIce },
    valleyFog: { risk: valleyFogRisk, label: label(valleyFogRisk), summary: valleyFog },
    ridgeFog: { risk: ridgeFogRisk, label: label(ridgeFogRisk), summary: ridgeFog },
    inversion: { risk: inversionRisk, label: label(inversionRisk), summary: inversion }
  };
}