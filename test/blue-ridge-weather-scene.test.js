import test from "node:test";
import assert from "node:assert/strict";

import { resolveBlueRidgeScene } from "../public/js/visuals/blue-ridge-weather-scene.js";

const noon = Date.UTC(2026, 7, 23, 16);

test("Blue Ridge scene uses known weather codes before cloud-cover abstraction", () => {
  assert.equal(resolveBlueRidgeScene({ forecastHour: { weatherCode: 95, cloudCover: 0.2 }, now: noon }).weatherState, "thunderstorm");
  assert.equal(resolveBlueRidgeScene({ forecastHour: { weatherCode: 45, cloudCover: 0.2 }, now: noon }).weatherState, "fog");
  assert.equal(resolveBlueRidgeScene({ forecastHour: { weatherCode: 71, cloudCover: 0.2 }, now: noon }).weatherState, "snow");
});

test("Blue Ridge scene responds to cloud cover without inventing fog", () => {
  assert.equal(resolveBlueRidgeScene({ forecastHour: { cloudCover: 0.92 }, now: noon }).weatherState, "overcast");
  assert.equal(resolveBlueRidgeScene({ forecastHour: { cloudCover: 0.7 }, currentHour: { relativeHumidity: 0.99 }, now: noon }).weatherState, "mostly-cloudy");
});
