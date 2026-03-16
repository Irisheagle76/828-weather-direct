// ============================================================
// EXPRESSIVE SYNTHESIZER (Style 2B — Conversational + Punchy)
// Builds: headline, narrative, bullets, micro-advice
// This is the voice of your weather app.
// ============================================================

import { cleanJoin, mergePhrases, degToCompass, to12Hour } from "./core.js";

// ------------------------------------------------------------
// HEADLINE BUILDER
// ------------------------------------------------------------
export function buildHeadline(events, comfort, stats) {
  const { driver, phase, front } = events;
  const { tempFeel, humidityFeel, windFeel, goldilocks } = comfort;

  // Goldilocks overrides everything
  if (goldilocks) return "A just-right kind of day";

  // Driver-based headlines
  switch (driver) {
    case "rain":
      return phase === "snow"
        ? "Snowy vibes ahead"
        : "Rain sets the tone";
    case "snow":
      return "Snow takes the spotlight";
    case "windy":
      return "Wind is the main character today";
    case "hot":
      return "Heat takes over";
    case "cold":
      return "Cold air in charge";
    case "humid":
      return "Humidity steals the show";
    default:
      break;
  }

  // Frontal passage
  if (front) return "A front shakes things up";

  // Comfort-driven fallback
  if (tempFeel === "very hot") return "A scorcher of a day";
  if (tempFeel === "very cold") return "A bitter cold day";

  return "A quiet, easygoing day";
}

// ------------------------------------------------------------
// NARRATIVE BUILDER
// ------------------------------------------------------------
export function buildNarrative(events, comfort, stats) {
  const parts = [];

  // Temperature feel
  parts.push(
    {
      "very hot": "It’ll feel downright hot out there.",
      hot: "Warm and summery vibes.",
      warm: "Comfortably warm overall.",
      mild: "Mild and pleasant.",
      cool: "Cool but manageable.",
      chilly: "A bit on the chilly side.",
      cold: "Cold enough to notice.",
      "very cold": "Bundle-up cold."
    }[comfort.tempFeel]
  );

  // Humidity feel
  parts.push(
    {
      tropical: "Humidity will be thick and tropical.",
      humid: "It’ll feel humid and heavy.",
      sticky: "A sticky feel at times.",
      comfortable: "Humidity stays comfortable.",
      dry: "Dry air keeps things crisp.",
      "very dry": "Very dry air in place."
    }[comfort.humidityFeel]
  );

  // Wind feel
  parts.push(
    {
      "very windy": "Gusty winds will be noticeable.",
      windy: "A breezy, wind-forward day.",
      breezy: "A light, refreshing breeze.",
      "light wind": "Winds stay light and easy."
    }[comfort.windFeel]
  );

  // Phase / precip
  if (events.phase === "rain") {
    parts.push("Expect periods of rain.");
  } else if (events.phase === "snow") {
    parts.push("Snow will make an appearance.");
  }

  // Frontal passage
  if (events.front) {
    parts.push("A front moves through, shifting temps and winds.");
  }

  return mergePhrases(parts);
}

// ------------------------------------------------------------
// BULLET BUILDER
// ------------------------------------------------------------
export function buildBullets(events, comfort, stats, window, hourly, indices) {
  const bullets = [];

  // Temperature range
  bullets.push(
    `Temps: ${Math.round(stats.temp.min)}–${Math.round(stats.temp.max)}°`
  );

  // Wind
  bullets.push(
    `Wind: ${Math.round(stats.wind.avg)} mph, gusts to ${Math.round(
      stats.wind.gustMax || 0
    )} mph (${degToCompass(stats.wind.dirAvg)})`
  );

  // Precip
  if (stats.precip.rainTotal > 0.05) {
    bullets.push(`Rain: ${stats.precip.rainTotal.toFixed(2)}" total`);
  }
  if (stats.precip.snowTotal > 0.05) {
    bullets.push(`Snow: ${stats.precip.snowTotal.toFixed(2)}" total`);
  }

  // Cloud cover
  bullets.push(`Clouds: ${Math.round(stats.clouds.avg)}% avg`);

  // Commute impact
  if (events.commute.am) bullets.push("AM commute: possible delays");
  if (events.commute.pm) bullets.push("PM commute: possible delays");

  return bullets;
}

// ------------------------------------------------------------
// MICRO-ADVICE BUILDER
// ------------------------------------------------------------
export function buildMicroAdvice(events, comfort, stats) {
  const out = [];

  // Rain / snow
  if (events.phase === "rain") out.push("Bring rain protection.");
  if (events.phase === "snow") out.push("Plan for slick spots.");

  // Heat / cold
  if (comfort.tempFeel === "very hot") out.push("Hydrate and take it slow.");
  if (comfort.tempFeel === "very cold") out.push("Bundle up and limit time outside.");

  // Humidity
  if (comfort.humidityFeel === "tropical") out.push("Expect that 'air you can wear' feel.");

  // Wind
  if (comfort.windFeel === "windy" || comfort.windFeel === "very windy") {
    out.push("Secure loose outdoor items.");
  }

  // Commute
  if (events.commute.am) out.push("Leave a little extra time for the morning drive.");
  if (events.commute.pm) out.push("Evening commute may be slower.");

  return out;
}

// ------------------------------------------------------------
// UNIFIED SYNTHESIS
// ------------------------------------------------------------
export function synthesizeOutlook(events, comfort, stats, window, hourly, indices) {
  return {
    headline: buildHeadline(events, comfort, stats),
    narrative: buildNarrative(events, comfort, stats),
    bullets: buildBullets(events, comfort, stats, window, hourly, indices),
    microAdvice: buildMicroAdvice(events, comfort, stats)
  };
}
