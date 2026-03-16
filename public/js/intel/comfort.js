// /intel/comfort.js
// Modern comfort engine (Hybrid H1 tone + emoji)

export function buildComfort(wu, hourlyNow) {
  // Prefer WU data when available
  const temp = wu?.temp ?? hourlyNow.temperature_2m;
  const dew = wu?.dewPoint ?? hourlyNow.dewpoint_2m;
  const wind = wu?.windSpeed ?? hourlyNow.wind_speed_10m;
  const gust = wu?.windGust ?? hourlyNow.wind_gusts_10m;

  // -----------------------------
  // Temperature Feel
  // -----------------------------
  let tempFeel = "";
  if (temp < 40) tempFeel = "cold";
  else if (temp < 50) tempFeel = "chilly";
  else if (temp < 62) tempFeel = "cool";
  else if (temp < 74) tempFeel = "mild";
  else if (temp < 82) tempFeel = "warm";
  else tempFeel = "hot";

  // -----------------------------
  // Humidity Feel (dewpoint-based)
  // -----------------------------
  let humidityFeel = "";
  if (dew < 45) humidityFeel = "dry";
  else if (dew < 60) humidityFeel = "comfortable";
  else if (dew < 70) humidityFeel = "humid";
  else humidityFeel = "sticky";

  // -----------------------------
  // Wind Feel
  // -----------------------------
  let windFeel = "";
  if (wind < 5) windFeel = "calm";
  else if (wind < 12) windFeel = "a light breeze";
  else if (wind < 20) windFeel = "breezy";
  else if (wind < 30) windFeel = "windy";
  else windFeel = "very windy";

  // -----------------------------
  // Emoji selection
  // -----------------------------
  let emoji = "🌤️";
  if (tempFeel === "cold") emoji = "❄️";
  if (tempFeel === "hot") emoji = "🔥";
  if (humidityFeel === "sticky") emoji = "💦";
  if (windFeel === "windy" || windFeel === "very windy") emoji = "🍃";

  // -----------------------------
  // Hybrid H1 Summary
  // -----------------------------
  const summary = `${capitalize(tempFeel)} and ${humidityFeel} — ${windFeel} ${emoji}`;

  return {
    summary,
    emoji,
    tempFeel,
    humidityFeel,
    windFeel
  };
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
