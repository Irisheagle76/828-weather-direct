// /intel/synthesizer.js
// Window-aware outlook generator (Hybrid H1 tone + emoji)

export function synthesizeOutlook(stats, events, windowHours) {
  const { tempMin, tempMax, windAvg, windGustMax, rainTotal, snowTotal, cloudAvg } = stats;

  // -----------------------------
  // Headline Logic
  // -----------------------------
  let headline = "";
  let emoji = "🌤️";

  if (snowTotal > 0.5) {
    headline = "Snowy vibes ahead";
    emoji = "❄️";
  } else if (rainTotal > 0.25) {
    headline = "A soggy stretch on the way";
    emoji = "🌧️";
  } else if (windGustMax > 30) {
    headline = "A breezy, jacket‑friendly day";
    emoji = "🍃";
  } else if (tempMax >= 80) {
    headline = "Warm and sticky at times";
    emoji = "💦";
  } else if (tempMax <= 45) {
    headline = "A crisp, chilly day";
    emoji = "❄️";
  } else {
    headline = "Mild and comfortable overall";
    emoji = "🌤️";
  }

  // -----------------------------
  // Narrative (Hybrid H1 tone)
  // -----------------------------
  const narrative = [
    `Temps run ${Math.round(tempMin)}–${Math.round(tempMax)}°F.`,
    windGustMax > 25
      ? `Winds stay active with gusts near ${Math.round(windGustMax)} mph.`
      : `Winds stay manageable with a ${Math.round(windAvg)} mph breeze.`,
    rainTotal > 0.1 ? `Rain totals reach ${rainTotal.toFixed(2)}".` : "",
    snowTotal > 0.1 ? `Snow totals reach ${snowTotal.toFixed(2)}".` : "",
    cloudAvg > 70 ? `Skies trend mostly cloudy.` : `Skies offer some breaks of sun.`
  ]
    .filter(Boolean)
    .join(" ");

  // -----------------------------
  // Bullets
  // -----------------------------
  const bullets = [];

  bullets.push(`Temps: ${Math.round(tempMin)}–${Math.round(tempMax)}°F`);
  bullets.push(`Wind: ${Math.round(windAvg)} mph, gusts to ${Math.round(windGustMax)} mph`);
  if (rainTotal > 0.01) bullets.push(`Rain: ${rainTotal.toFixed(2)}" total`);
  if (snowTotal > 0.01) bullets.push(`Snow: ${snowTotal.toFixed(2)}" total`);
  bullets.push(`Clouds: ${Math.round(cloudAvg)}% average`);

  // Commute logic
  if (events?.pmCommuteRisk) {
    bullets.push("PM commute: possible delays");
  }

  return {
    headline: `${headline} ${emoji}`,
    narrative,
    bullets
  };
}
