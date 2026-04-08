function buildHumanSummary({ dominantFactor, signals }) {
  const { temp, dewPoint, windSpeed, humidity } = signals;

  // ------------------------------------------------------------
  // CLASSIFY
  // ------------------------------------------------------------
  const tempLevel =
    temp >= 86 ? "hot" :
    temp >= 75 ? "warm" :
    temp >= 60 ? "mild" :
    temp >= 45 ? "cool" :
    "cold";

  const humidityLevel =
    dewPoint >= 70 ? "oppressive" :
    dewPoint >= 65 ? "humid" :
    dewPoint >= 55 ? "comfortable" :
    "dry";

  const windLevel =
    windSpeed < 1 ? "calm" :
    windSpeed < 5 ? "light" :
    windSpeed < 12 ? "breezy" :
    "windy";

  // ------------------------------------------------------------
  // SUMMARY (NO VAGUE LANGUAGE)
  // ------------------------------------------------------------
  let summary;

  if (tempLevel === "hot" && humidityLevel !== "dry")
    summary = "Hot and uncomfortable";

  else if (tempLevel === "hot")
    summary = "Hot";

  else if (tempLevel === "warm" && humidityLevel !== "dry")
    summary = "Warm and slightly sticky";

  else if (tempLevel === "warm")
    summary = "Warm";

  else if (tempLevel === "mild")
    summary = "Comfortable";

  else if (tempLevel === "cool" && windLevel !== "calm")
    summary = "Cool with a breeze";

  else if (tempLevel === "cool")
    summary = "Cool";

  else
    summary = "Chilly";

  // ------------------------------------------------------------
  // DETAIL (ONE CLEAR DRIVER)
  // ------------------------------------------------------------
  let detail;

  switch (dominantFactor) {
    case "heat":
      detail = "Feels warm in the sun";
      break;

    case "cold":
      detail = "Cool air is noticeable";
      break;

    case "humidity":
      detail = "Humidity makes it feel heavier";
      break;

    case "wind":
      detail =
        windLevel === "calm"
          ? "Calm conditions"
          : `Breeze around ${Math.round(windSpeed)} mph`;
      break;

    default:
      detail = "";
  }

  // ------------------------------------------------------------
  // FEELS LIKE LABEL
  // ------------------------------------------------------------
  const feels =
    temp >= 95 ? "Oppressive heat" :
    temp >= 85 ? "Very warm" :
    temp >= 75 ? "T-shirt weather" :
    temp >= 65 ? "Comfortable" :
    temp >= 55 ? "Light jacket weather" :
    temp >= 45 ? "Jacket recommended" :
    "Cold";

  return { summary, detail, feelsLike: feels };
}