// /intel/human-action-outlook.js
// ============================================================
// Human‑Action Outlook Engine (Today + Tomorrow)
// Scannable • Warm • Actionable • Asheville‑Aware
// ============================================================

export function getTodayHumanActionOutlook(intel) {
  const wx = intel.wu;
  const precip = intel.mrms?.type;
  const wind = wx.windSpeed ?? 0;
  const drop = intel.comfort?.summary.includes("drop");
  const snowing = precip === "snow";
  const raining = precip === "rain";

  // ------------------------------------------------------------
  // 1. HEADLINE
  // ------------------------------------------------------------
  let headline = "";

  if (snowing) headline = "Cold, wintry, and breezy today.";
  else if (raining) headline = "Cool, damp, and breezy today.";
  else if (drop) headline = "Colder and breezy this afternoon.";
  else if (wind >= 15) headline = "Breezy and cool today.";
  else headline = "A cool, manageable day overall.";

  // ------------------------------------------------------------
  // 2. WHY IT MATTERS
  // ------------------------------------------------------------
  let context = "";

  if (snowing) context = "Light snow and a steady breeze will make it feel raw at times.";
  else if (raining) context = "Intermittent rain and a light breeze may add a damp edge.";
  else if (drop) context = "A noticeable temperature drop will make the afternoon feel colder.";
  else if (wind >= 15) context = "Gusts will add a bit of edge, especially in open areas.";
  else context = "Conditions stay steady with no major surprises.";

  // ------------------------------------------------------------
  // 3. ACTIONABLE BULLETS (2–3 max)
  // ------------------------------------------------------------
  const bullets = [];

  if (snowing) {
    bullets.push("Dress warm and wind‑proof");
    bullets.push("Watch for slick spots on shaded roads");
    bullets.push("Give yourself a little extra travel time");
  } else if (raining) {
    bullets.push("Carry a light rain layer");
    bullets.push("Expect damp roads and slower travel");
  } else if (drop) {
    bullets.push("Layer up for the colder afternoon");
    bullets.push("Expect a brisk feel in open areas");
  } else if (wind >= 15) {
    bullets.push("Secure loose outdoor items");
    bullets.push("Expect a cooler feel than the thermometer shows");
  } else {
    bullets.push("Light layers work well");
    bullets.push("No major weather impacts expected");
  }

  return { headline, context, bullets };
}


// ============================================================
// TOMORROW
// ============================================================

export function getTomorrowHumanActionOutlook(intel) {
  const tmr = intel.tomorrow;
  const precip = tmr?.precipType;
  const wind = tmr?.windSpeed ?? 0;
  const tempTrend = tmr?.tempTrend ?? 0;

  const snowing = precip === "snow";
  const raining = precip === "rain";

  // ------------------------------------------------------------
  // 1. HEADLINE
  // ------------------------------------------------------------
  let headline = "";

  if (snowing) headline = "A chilly, wintry day ahead.";
  else if (raining) headline = "A cool, damp day tomorrow.";
  else if (wind >= 15) headline = "A breezy, cool day ahead.";
  else if (tempTrend > 0) headline = "A milder day on the way.";
  else headline = "A steady, seasonable day tomorrow.";

  // ------------------------------------------------------------
  // 2. WHY IT MATTERS
  // ------------------------------------------------------------
  let context = "";

  if (snowing) context = "Light snow and a steady breeze may create a raw feel at times.";
  else if (raining) context = "On‑and‑off rain may slow travel and keep things damp.";
  else if (wind >= 15) context = "Gusts may add a cooler feel, especially in open areas.";
  else if (tempTrend > 0) context = "Temperatures trend slightly milder through the afternoon.";
  else context = "Conditions stay stable with no major weather impacts expected.";

  // ------------------------------------------------------------
  // 3. ACTIONABLE BULLETS
  // ------------------------------------------------------------
  const bullets = [];

  if (snowing) {
    bullets.push("Dress warm and wind‑proof");
    bullets.push("Watch for slick spots early");
    bullets.push("Plan for slower travel in the morning");
  } else if (raining) {
    bullets.push("Carry a rain layer");
    bullets.push("Expect damp roads and slower commutes");
  } else if (wind >= 15) {
    bullets.push("Secure loose outdoor items");
    bullets.push("Expect a cooler feel than the thermometer shows");
  } else if (tempTrend > 0) {
    bullets.push("Light layers should work well");
    bullets.push("A mild afternoon is likely");
  } else {
    bullets.push("Standard layers are fine");
    bullets.push("No major adjustments needed");
  }

  return { headline, context, bullets };
}
