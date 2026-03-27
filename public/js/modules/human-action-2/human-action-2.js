// /modules/human-action-2/human-action-2.js
// Human‑Action 2.0 — Output Layer (Clean Production Build)

import { evaluateHumanActionFactors } from "./core-engine.js?v=1.0.20260327";

// ---------------------------------------------------------
// 1. Emoji Selector
// ---------------------------------------------------------
export function getActionEmoji(dominantFactor) {
  const map = {
    heat: "🔥",
    cold: "🧊",
    wind: "🌬️",
    mountainWind: "🌬️",
    rain: "🌧️",
    coldRain: "🌧️",
    warmRain: "🌦️",
    storms: "⛈️",
    snow: "❄️",
    humidity: "💧",
    muggy: "💧",
    sun: "☀️",
    clouds: "🌤️",
    fog: "🌫️",
    valleyFog: "🌫️",
    ridgeFog: "🌫️",
    freezingFog: "❄️",
    frost: "❄️",
    freeze: "❄️",
    blackIce: "🧊",
    goldilocks: "🌟",
    default: "🙂"
  };

  return map[dominantFactor] || map.default;
}

// ---------------------------------------------------------
// 2. Headline Generator
// ---------------------------------------------------------
export function getActionHeadline(dominantFactor, data) {
  switch (dominantFactor) {
    case "heat": return "Warm and energy‑draining";
    case "cold": return "Chilly with a bite";
    case "wind": return "Breezy and changeable";
    case "mountainWind": return "Gusty ridgetop winds";
    case "rain": return "Damp and unsettled";
    case "coldRain": return "Cold rain with a deep chill";
    case "warmRain": return "Warm, tropical‑feeling rain";
    case "storms": return "Storm‑tilted and active";
    case "snow": return "Cold with wintry texture";
    case "humidity": return "Sticky and slow‑moving";
    case "muggy": return "Heavy, muggy air";
    case "sun": return "Bright and comfortable";
    case "clouds": return "Cloudy with soft light";
    case "fog": return "Muted and low‑visibility";
    case "valleyFog": return "Fog settled in the valleys";
    case "ridgeFog": return "Fog clinging to the ridges";
    case "freezingFog": return "Freezing fog and slick spots";
    case "frost": return "Frosty and slow to warm";
    case "freeze": return "Hard freeze early on";
    case "blackIce": return "Patchy black ice early";
    case "goldilocks": return "🌟 Goldilocks Day — just right!";
    default: return "Easygoing conditions";
  }
}

// ---------------------------------------------------------
// 3. Bullet Generator (Warm Hybrid Style)
// ---------------------------------------------------------
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

    case "blackIce":
      bullets.push(
        "🧊 Melt‑freeze cycles create patchy black ice, especially early.",
        "Bridges and shaded spots freeze first — take it slow.",
        "Temps improve by late morning, but pockets of ice linger in low areas."
      );
      break;

    case "freezingFog":
      bullets.push(
        "❄️ Freezing fog creates thin, sneaky ice on bridges and elevated surfaces.",
        "Drive gently — traction can change quickly in shaded areas.",
        "A warm layer helps until temps climb above freezing."
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

    case "mountainWind":
      bullets.push(
        "🌬️ Gusty ridgetop winds create sudden, sharp bursts of movement.",
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

    case "cold":
      bullets.push(
        "🧊 A chilly start means a warmer layer is your friend early on.",
        "Light wind makes it feel a touch colder than the thermometer shows.",
        "Hands and ears appreciate a bit of extra coverage."
      );
      break;

    case "heat":
      bullets.push(
        "🔥 Warm temps may feel heavier this afternoon, especially in the sun.",
        "Light, breathable layers keep you comfortable on the move.",
        "Hydration helps more than you think on days like this."
      );
      break;

    case "humidity":
      bullets.push(
        "💧 Humidity adds a slow, heavy feel to the air.",
        "Breathable fabrics help keep things comfortable.",
        "Expect surfaces and hair to hold moisture longer than usual."
      );
      break;

    case "muggy":
      bullets.push(
        "💧 High dew points make the air feel heavy and slow‑moving.",
        "Breathable fabrics help keep things comfortable on the move.",
        "Expect surfaces and hair to hold moisture longer than usual."
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

    case "warmRain":
      bullets.push(
        "🌦️ Warm, tropical‑feeling rain adds a slow, heavy feel to the air.",
        "A light rain shell keeps you comfortable without overheating.",
        "Expect quick downpours and fast‑changing conditions through the day."
      );
      break;

    case "storms":
      bullets.push(
        "⛈️ Storm energy builds, especially in the afternoon hours.",
        "Have a quick indoor backup plan if you're timing outdoor errands.",
        "Wind and lightning may spike briefly as cells pass."
      );
      break;

    case "snow":
      bullets.push(
        "❄️ Light snow adds texture and reduces visibility at times.",
        "A warm layer and good footing make outdoor time easier.",
        "Roads may stay damp or slick in shaded spots."
      );
      break;

    case "sun":
      bullets.push(
        "☀️ Bright sun keeps the day feeling clean and comfortable.",
        "A light layer early gives way to easy warmth by midday.",
        "Great visibility for outdoor plans or mountain views."
      );
      break;

    case "clouds":
      bullets.push(
        "🌤️ Soft cloud cover keeps temps steady and mild.",
        "A light layer helps early, especially in shaded areas.",
        "Low‑contrast light makes outdoor tasks easy on the eyes."
      );
      break;

    case "fog":
      bullets.push(
        "🌫️ Fog reduces visibility and softens the morning light.",
        "Give yourself a little extra time on the road.",
        "Layers help until the fog lifts and temps rebound."
      );
      break;

    case "goldilocks":
      bullets.push(
        "🌟 A beautifully balanced day with no major weather drivers.",
        "Windows‑open comfort — perfect for errands, walks, or a slow afternoon.",
        "Light layers are optional, and outdoor plans feel effortless."
      );
      break;

    default:
      bullets.push(
        "🙂 A mild, steady feel with no major weather drivers.",
        "Light layers work well from morning through afternoon.",
        "Outdoor plans are smooth and flexible throughout the day."
      );
      break;
  }

  return bullets;
}

// ---------------------------------------------------------
// 4. Final Assembler
// ---------------------------------------------------------
export function assembleHumanActionOutput(emoji, headline, bullets, dominantFactor) {
  return { emoji, headline, bullets, dominantFactor };
}

// ---------------------------------------------------------
// 5. Main Generator
// ---------------------------------------------------------
export function generateHumanAction(data) {
  const result = evaluateHumanActionFactors(data);

  const emoji = getActionEmoji(result.dominantFactor);
  const headline = getActionHeadline(result.dominantFactor, data);
  const bullets = getActionBullets(result.dominantFactor, data);

  return assembleHumanActionOutput(
    emoji,
    headline,
    bullets,
    result.dominantFactor
  );
}