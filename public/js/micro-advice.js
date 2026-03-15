// ------------------------------------------------------------
// UNIFIED MICRO‑ADVICE ENGINE (Today + Tomorrow)
// ------------------------------------------------------------

export function getUnifiedMicroAdvice({ wu, outlook, comfort }) {
  if (!outlook) return "";

  const temp = wu.temp;
  const dew = wu.dewPoint;
  const gust = wu.windGust ?? 0;

  // Unified intel dominant driver
  const dominant = outlook?.meta?.dominant ?? "easy";
  const driver = dominant.toLowerCase();

  // ------------------------------------------------------------
  // 1. Driver‑based micro advice
  // ------------------------------------------------------------
  const driverAdvice = {
    rain: "Rain gear might be a good idea.",
    wind: "Expect breezy conditions — secure loose items.",
    snow: "Allow extra travel time — slick spots possible.",
    heat: "Hydrate and dress light.",
    cold: "Layer up — especially early.",
    goldilocks: "Perfect for a walk or windows down.",
    easy: "You're all good."
  }[driver];

  // ------------------------------------------------------------
  // 2. Dewpoint nuance
  // ------------------------------------------------------------
  let dewAdvice = "";
  if (dew >= 65) dewAdvice = "Humidity may feel a bit sticky.";
  else if (dew <= 40) dewAdvice = "Air will feel crisp and comfortable.";

  // ------------------------------------------------------------
  // 3. Wind + temperature combo
  // ------------------------------------------------------------
  let windTempAdvice = "";
  if (gust >= 30 && temp <= 45) windTempAdvice = "Wind chill could be noticeable.";
  else if (gust >= 30 && temp >= 80) windTempAdvice = "Hot but at least there's a breeze.";
  else if (gust >= 25 && temp >= 55 && temp <= 75) windTempAdvice = "Warm and breezy — great for being outside.";

  // ------------------------------------------------------------
  // 4. Headline‑based nuance
  // ------------------------------------------------------------
  let headlineAdvice = "";
  const headline = outlook.headline?.toLowerCase() ?? "";

  if (headline.includes("warming")) headlineAdvice = "Cool start, warmer later — layer smart.";
  if (headline.includes("colder")) headlineAdvice = "Turning colder — consider a jacket.";
  if (headline.includes("showers")) headlineAdvice = "Showers possible — keep an umbrella handy.";
  if (headline.includes("snow")) headlineAdvice = "Snow showers could create slick spots.";

  // ------------------------------------------------------------
  // 5. Comfort‑based nuance
  // ------------------------------------------------------------
  let comfortAdvice = "";
  const comfortText = comfort?.summary?.toLowerCase() ?? "";

  if (comfortText.includes("humid")) comfortAdvice = "Humidity may make it feel warmer.";
  if (comfortText.includes("crisp")) comfortAdvice = "Crisp air — great visibility and feel.";

  // ------------------------------------------------------------
  // Combine all advice into one clean line
  // ------------------------------------------------------------
  const pieces = [
    driverAdvice,
    dewAdvice,
    windTempAdvice,
    headlineAdvice,
    comfortAdvice
  ].filter(Boolean);

  return pieces.length ? pieces.join(" ") : driverAdvice;
}
