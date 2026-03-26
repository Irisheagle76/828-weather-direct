// /modules/human-action-2/human-action-2.js
// Human‑Action 2.0 — Output Layer (Warm Hybrid Bullets)
// This file handles ONLY the visible phrasing. No heavy logic yet.

import { evaluateHumanActionFactors } from "./core-engine.js?v=1.0.0";

// ---------------------------------------------------------
// 1. Emoji Selector
// ---------------------------------------------------------
export function getActionEmoji(dominantFactor) {
  const map = {
    heat: "🔥",
    cold: "🧊",
    wind: "🌬️",
    rain: "🌧️",
    storms: "⛈️",
    snow: "❄️",
    humidity: "💧",
    sun: "☀️",
    clouds: "🌤️",
    fog: "🌫️",
    default: "🌤️"
  };

  return map[dominantFactor] || map.default;
}

// ---------------------------------------------------------
// 2. Headline Generator
// ---------------------------------------------------------
export function getActionHeadline(dominantFactor, data) {
  switch (dominantFactor) {
    case "heat":
      return "Warm and energy‑draining";
    case "cold":
      return "Chilly with a bite";
    case "wind":
      return "Breezy and changeable";
    case "rain":
      return "Damp and unsettled";
    case "storms":
      return "Storm‑tilted and active";
    case "snow":
      return "Cold with wintry texture";
    case "humidity":
      return "Sticky and slow‑moving";
    case "sun":
      return "Bright and comfortable";
    case "clouds":
      return "Cloudy with soft light";
    case "fog":
      return "Muted and low‑visibility";
    default:
      return "A mixed‑feel kind of day";
  }
}

// ---------------------------------------------------------
// 3. Bullet Generator (Warm Hybrid Style)
// ---------------------------------------------------------
// Bullets carry the narrative weight now — descriptive, actionable,
// Asheville‑aware, and never redundant.

export function getActionBullets(dominantFactor, data) {
  const bullets = [];

  switch (dominantFactor) {
    case "frost":
  bullets.push(
    "❄️ Patchy frost makes early travel slower — give yourself a few extra minutes.",
    "A warm layer helps until the sun lifts the chill out of the valleys.",
    "Shaded spots stay icy longer, especially near creeks and low pockets."
  );
  break;

case "freeze":
  bullets.push(
    "❄️ A hard freeze keeps surfaces slick and brittle early on.",
    "Protect sensitive plants and outdoor faucets if you haven’t already.",
    "Sun helps by late morning, but shaded areas stay frozen longer."
  );
  break;

  case "smoke":
  bullets.push(
    "🌫️ Regional smoke lowers visibility and adds a muted, hazy feel.",
    "Sensitive groups may feel the air quality more — take it easy outdoors.",
    "Windows closed and indoor air circulation help keep things comfortable."
  );
  break;

case "haze":
  bullets.push(
    "🌫️ Haze softens the light and trims visibility across the mountains.",
    "Expect distant ridges to look washed out through the afternoon.",
    "Outdoor plans are fine, but breathing may feel heavier during exertion."
  );
  break;

    case "heat":
      bullets.push(
        "🔥 Warm temps may feel heavier this afternoon, especially in the sun.",
        "Light, breathable layers keep you comfortable on the move.",
        "Hydration helps more than you think on days like this."
      );
      break;

    case "cold":
      bullets.push(
        "🧊 A chilly start means a warmer layer is your friend early on.",
        "Light wind makes it feel a touch colder than the thermometer shows.",
        "Hands and ears appreciate a bit of extra coverage."
      );
      break;

case "inversion":
  bullets.push(
    "🌫️ A valley inversion traps cooler air low while ridges warm quickly.",
    "Expect a noticeable temperature split between neighborhoods and elevations.",
    "Fog or haze may linger in low spots longer than usual."
  );
  break;

case "uv":
  bullets.push(
    "☀️ Strong sun makes the day feel warmer than the thermometer suggests.",
    "Early‑season UV can surprise you — light protection goes a long way.",
    "Great visibility for mountain views, but glare may be sharp at midday."
  );
  break;

case "mountainWind":
  bullets.push(
    "🌬️ Mountain winds funnel through gaps and ridges, creating sudden gusts.",
    "Secure lightweight outdoor items — gusts may spike unexpectedly.",
    "A wind‑blocking layer helps if you're out on exposed terrain."
  );
  break;

    case "wind":
      bullets.push(
        "🌬️ A steady breeze keeps the air feeling crisp and clean.",
        "Secure lightweight items outdoors — gusts pick up midday.",
        "A light layer helps if you're sensitive to moving air."
      );
      break;

    case "rain":
      bullets.push(
        "🌧️ Intermittent showers make a light rain shell a smart grab‑and‑go.",
        "Surfaces stay slick longer today — take corners with care.",
        "Humidity rises through the day, adding a mild heaviness."
      );
      break;

case "coldRain":
  bullets.push(
    "🌧️ Cold rain adds a bone‑deep chill that cuts through light layers.",
    "A waterproof shell and warm under‑layer make a big difference.",
    "Surfaces stay slick longer, especially in shaded or leaf‑covered areas."
  );
  break;

    case "storms":
      bullets.push(
        "⛈️ Storm energy builds, especially in the afternoon hours.",
        "Have a quick indoor backup plan if you're timing outdoor errands.",
        "Wind and lightning may spike briefly as cells pass."
      );
      break;

case "warmRain":
  bullets.push(
    "🌦️ Warm, tropical‑feeling rain adds a slow, heavy feel to the air.",
    "A light rain shell keeps you comfortable without overheating.",
    "Expect quick downpours and fast‑changing conditions through the day."
  );
  break;

case "valleyFog":
  bullets.push(
    "🌫️ Valley fog reduces visibility and keeps temps cooler early on.",
    "Give yourself extra time on the road — conditions vary by neighborhood.",
    "Fog lifts slowly, but sunshine breaks through by late morning."
  );
  break;
case "ridgeFog":

  bullets.push(
    "🌫️ Ridge‑top fog brings low visibility and a damp, muted feel.",
    "Expect rapid changes in visibility as you move along elevation lines.",
    "A light layer helps with the cool, moist air."
  );
  break;

    case "snow":
      bullets.push(
        "❄️ Light snow adds texture and reduces visibility at times.",
        "A warm layer and good footing make outdoor time easier.",
        "Roads may stay damp or slick in shaded spots."
      );
      break;

    case "humidity":
      bullets.push(
        "💧 Humidity adds a slow, heavy feel to the air.",
        "Breathable fabrics help keep things comfortable.",
        "Expect surfaces and hair to hold moisture longer than usual."
      );
      break;

    case "sun":
      bullets.push(
        "☀️ Bright sun keeps the day feeling clean and comfortable.",
        "A light layer early gives way to easy warmth by midday.",
        "Great visibility for outdoor plans or mountain views."
      );
      break;

case "freezingFog":
  bullets.push(
    "❄️ Freezing fog creates thin, sneaky ice on bridges and elevated surfaces.",
    "Drive gently — traction can change quickly in shaded areas.",
    "A warm layer helps until temps climb above freezing."
  );
  break;

case "blackIce":
  bullets.push(
    "🧊 Melt‑freeze cycles create patchy black ice, especially early.",
    "Bridges and shaded spots freeze first — take it slow.",
    "Temps improve by late morning, but pockets of ice linger in low areas."
  );
  break;

    case "clouds":
      bullets.push(
        "🌤️ Soft cloud cover keeps temps steady and mild.",
        "A light layer helps early, especially in shaded areas.",
        "Low contrast light makes outdoor tasks easy on the eyes."
      );
      break;

case "muggy":
  bullets.push(
    "💧 High dew points make the air feel heavy and slow‑moving.",
    "Breathable fabrics help keep things comfortable on the move.",
    "Expect surfaces and hair to hold moisture longer than usual."
  );
  break;

    case "fog":
      bullets.push(
        "🌫️ Fog reduces visibility and softens the morning light.",
        "Give yourself a little extra time on the road.",
        "Layers help until the fog lifts and temps rebound."
      );
      break;

    default:
      bullets.push(
        "A little bit of everything today — layers help you adapt.",
        "Light wind and shifting clouds keep things interesting.",
        "Outdoor plans look good with minor adjustments."
      );
  }

  return bullets;
}

// ---------------------------------------------------------
// 4. Final Assembler
// ---------------------------------------------------------
export function assembleHumanActionOutput(emoji, headline, bullets) {
  return {
    emoji,
    headline,
    bullets
  };
}

// ---------------------------------------------------------
// 5. Main Generator — ties everything together
// ---------------------------------------------------------
export function generateHumanAction(data) {
  // 1. Run the core engine
  const result = evaluateHumanActionFactors(data);

  const { dominantFactor } = result;

  // 2. Build the phrasing
  const emoji = getActionEmoji(dominantFactor);
  const headline = getActionHeadline(dominantFactor, data);
  const bullets = getActionBullets(dominantFactor, data);

  // 3. Assemble final output
  return assembleHumanActionOutput(emoji, headline, bullets);
}