import test from "node:test";
import assert from "node:assert/strict";

import { buildWeatherIngredients } from "../public/js/visuals/weather-ingredients.js";

test("weather ingredients explain calibrated current factors without computing another score", () => {
  const ingredients = buildWeatherIngredients({
    currentHour: { temperatureF: 72, dewpointF: 67, windSpeed: 3, windGust: 6 },
    forecastHour: { cloudCover: 0.83 }
  });
  const byKey = Object.fromEntries(ingredients.map((item) => [item.key, item]));

  assert.equal(byKey.temperature.interpretation, "In the comfort sweet spot");
  assert.equal(byKey.moisture.interpretation, "Muggy air is a major factor");
  assert.equal(byKey.wind.interpretation, "Very little breeze");
  assert.equal(byKey.sky.interpretation, "Thick cloud cover");
  assert.equal(byKey.sky.value, "83%");
  assert.equal("score" in byKey.temperature, false);
});
