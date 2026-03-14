// ------------------------------------------------------------
// MICRO‑ADVICE ENGINE
// ------------------------------------------------------------

export function getMicroAdvice({ wu, today, comfort }) {
  const temp = wu.temp;
  const dew = wu.dewPoint;
  const gust = wu.windGust ?? 0;
  const dominant = today.badge.text.toLowerCase(); // "Rain Gear", "Wind Alert", etc.

  // Normalize dominant driver
  const driver = today.badge.text.toLowerCase().includes("rain") ? "rain" :
                 today.badge.text.toLowerCase().includes("wind") ? "wind" :
                 today.badge.text.toLowerCase().includes("heat") ? "heat" :
                 today.badge.text.toLowerCase().includes("cold") ? "cold" :
                 today.badge.text.toLowerCase().includes("snow") ? "snow" :
                 today.badge.text.toLowerCase().includes("goldilocks") ? "goldilocks" :
                 "easy";

  // ------------------------------------------------------------
  // 1. Driver‑based micro advice
  // ------------------------------------------------------------
  const driverAdvice = {
    rain: "Might want to grab your rain jacket.",
    wind: "Mess your hair up type of day.",
    snow: "Allow extra travel time.",
    heat: "Drink your water!",
    cold: "Layer up — especially early.",
    goldilocks: "Perfect for a walk or windows down.",
    easy: "You're all good."
  }[driver];

  // ------------------------------------------------------------
  // 2. Dewpoint nuance
  // ------------------------------------------------------------
  let dewAdvice = "";
  if (dew >= 65) dewAdvice = "Expect some stickiness.";
  else if (dew <= 40) dewAdvice = "Air will feel crisp and clean.";

  // ------------------------------------------------------------
  // 3. Wind + temperature combo
  // ------------------------------------------------------------
  let windTempAdvice = "";
  if (gust >= 30 && temp <= 45) windTempAdvice = "Wind chill factor in effect. Bundle up.";
  else if (gust >= 30 && temp >= 80) windTempAdvice = "Hot but at least there's a breeze!";
  else if (gust >= 25 && temp >= 55 && temp <= 75) windTempAdvice = "Warm and breezy — great for being outside.";

  // ------------------------------------------------------------
  // 4. Time‑of‑day layering logic
  // ------------------------------------------------------------
  const hour = new Date().getHours();
  let timeAdvice = "";

  if (hour < 11 && wu.temp < 55 && today.headline.toLowerCase().includes("warm")) {
    timeAdvice = "Cool start, warmer later — dress in layers.";
  }

  if (hour >= 14 && wu.temp > 70 && comfort.text.toLowerCase().includes("cool")) {
    timeAdvice = "Warm now, but it cools off tonight — have a hoodie handy.";
  }

  // ------------------------------------------------------------
  // Combine all advice into one clean line
  // ------------------------------------------------------------
  const pieces = [driverAdvice, dewAdvice, windTempAdvice, timeAdvice]
    .filter(Boolean);

  return pieces.length ? pieces.join(" ") : driverAdvice;
}
