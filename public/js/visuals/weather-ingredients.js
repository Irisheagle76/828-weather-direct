import { FEELSCORE_CALIBRATION } from "../intel/comfort.js";

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function percent(value, min, max) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(clamp((value - min) / (max - min), 0, 1) * 100);
}

function cloudFraction(value) {
  if (!Number.isFinite(value)) return null;
  return clamp(value > 1 ? value / 100 : value, 0, 1);
}

function temperatureRead(value) {
  if (!Number.isFinite(value)) return "Temperature signal unavailable";
  const { idealMinF, idealMaxF } = FEELSCORE_CALIBRATION.temperature;
  if (value < 45) return "Cold is driving the feel";
  if (value < idealMinF) return "Cooler than the comfort sweet spot";
  if (value <= idealMaxF) return "In the comfort sweet spot";
  if (value < 85) return "Warmth is becoming noticeable";
  return "Heat is adding friction";
}

function dewPointRead(value) {
  if (!Number.isFinite(value)) return "Moisture signal unavailable";
  const dew = FEELSCORE_CALIBRATION.dewpoint;
  if (value < 45) return "Crisp, dry air";
  if (value < dew.noticeableF) return "Humidity stays manageable";
  if (value < dew.muggyF) return "Humidity is noticeable";
  if (value < dew.veryMuggyF) return "Getting muggy";
  return "Muggy air is a major factor";
}

function windRead(value, gust) {
  if (!Number.isFinite(value)) return "Wind signal unavailable";
  if (Number.isFinite(gust) && gust >= 25) return "Strong gusts add exposure";
  if (value < 4) return "Very little breeze";
  if (value < 10) return "A light breeze helps";
  if (value < 18) return "Breeze is noticeable";
  return "Wind is affecting comfort";
}

function skyRead(value) {
  if (!Number.isFinite(value)) return "Sky cover is still resolving";
  if (value < 0.2) return "Open, bright sky";
  if (value < 0.5) return "Sun and clouds sharing the sky";
  if (value < 0.8) return "Filtered brightness";
  return "Thick cloud cover";
}

const ICONS = {
  temperature: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14.8V5a2 2 0 1 1 4 0v9.8a4.5 4.5 0 1 1-4 0Z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 8v8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
  moisture: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3s6 6.5 6 11a6 6 0 1 1-12 0c0-4.5 6-11 6-11Z" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>`,
  wind: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8h11.5a2.5 2.5 0 1 0-2.3-3.5M3 12h16a2.5 2.5 0 1 1-2.3 3.5M3 16h7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
  sky: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 17h9a4 4 0 0 0 .2-8A5.5 5.5 0 0 0 7 10.5 3.3 3.3 0 0 0 8 17Z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M5 5.5 3.5 4M9 3V1" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`
};

export function buildWeatherIngredients({ currentHour = {}, forecastHour = {} } = {}) {
  const temperature = finite(currentHour.temperatureF ?? currentHour.temp ?? forecastHour.temperatureF);
  const dewPoint = finite(currentHour.dewpointF ?? currentHour.dewPoint ?? forecastHour.dewpointF);
  const wind = finite(currentHour.windSpeed ?? currentHour.wind ?? forecastHour.windSpeed);
  const gust = finite(currentHour.windGust ?? forecastHour.windGust);
  const cloud = cloudFraction(finite(forecastHour.cloudCover ?? currentHour.cloudCover));

  return [
    {
      key: "temperature",
      label: "Temperature",
      value: Number.isFinite(temperature) ? `${Math.round(temperature)}°` : "--",
      interpretation: temperatureRead(temperature),
      level: percent(temperature, 30, 100)
    },
    {
      key: "moisture",
      label: "Dew point",
      value: Number.isFinite(dewPoint) ? `${Math.round(dewPoint)}°` : "--",
      interpretation: dewPointRead(dewPoint),
      level: percent(dewPoint, 35, 75)
    },
    {
      key: "wind",
      label: "Wind",
      value: Number.isFinite(wind) ? `${Math.round(wind)} mph` : "--",
      interpretation: windRead(wind, gust),
      level: percent(wind, 0, 30)
    },
    {
      key: "sky",
      label: "Sky cover",
      value: Number.isFinite(cloud) ? `${Math.round(cloud * 100)}%` : "--",
      interpretation: skyRead(cloud),
      level: Number.isFinite(cloud) ? Math.round(cloud * 100) : 0
    }
  ];
}

export function renderWeatherIngredients(target, options = {}) {
  const container = typeof target === "string" ? document.querySelector(target) : target;
  if (!container) return [];
  const ingredients = buildWeatherIngredients(options);
  const available = ingredients.filter((ingredient) => ingredient.value !== "--");
  if (!available.length) {
    container.hidden = true;
    container.innerHTML = "";
    return ingredients;
  }

  container.hidden = false;
  container.innerHTML = `
    <section class="weather-ingredients" aria-labelledby="weatherIngredientsTitle">
      <header class="weather-ingredients-header">
        <h2 id="weatherIngredientsTitle">What’s making it feel this way?</h2>
        <p>The four ingredients shaping the current FeelScore.</p>
      </header>
      <div class="weather-ingredients-grid">
        ${ingredients.map((ingredient) => `
          <article class="weather-ingredient ${ingredient.key}" aria-label="${ingredient.label}: ${ingredient.value}. ${ingredient.interpretation}">
            <div class="weather-ingredient-top"><span class="weather-ingredient-icon">${ICONS[ingredient.key]}</span>${ingredient.label}</div>
            <div class="weather-ingredient-value">${ingredient.value}</div>
            <div class="weather-ingredient-read">${ingredient.interpretation}</div>
            <div class="weather-ingredient-meter" aria-hidden="true"><span style="--ingredient-level:${ingredient.level}%"></span></div>
          </article>
        `).join("")}
      </div>
    </section>
  `;
  return ingredients;
}
