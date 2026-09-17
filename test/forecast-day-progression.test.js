import test from "node:test";
import assert from "node:assert/strict";
import { getDayProgression, normalizeDayIcon } from "../public/js/modules/forecast-day-progression.js";

test("mostly sunny morning and scattered afternoon storms render as two phases", () => {
  const result = getDayProgression({
    icon: "thunderstorm",
    condition: "Mostly sunny",
    sky: "mostly_sunny",
    evolution: "building",
    stormRisk: "scattered",
    rainWindow: { start: "Afternoon" }
  }, "⛈️", "Storms possible");

  assert.equal(result.first.icon, "🌤️");
  assert.equal(result.first.condition, "Mostly sunny");
  assert.deepEqual(result.later, {
    icon: "⛈️",
    condition: "Scattered storms possible",
    timing: "Afternoon"
  });
});

test("a broad model storm condition does not relabel the sunny first phase", () => {
  const result = getDayProgression({
    icon: "thunderstorm", condition: "Storms possible", sky: "mostly_sunny",
    evolution: "building", stormRisk: "scattered", rainWindow: { start: "afternoon" }
  });
  assert.equal(result.first.condition, "Mostly sunny");
  assert.equal(result.later.condition, "Scattered storms possible");
});

test("winter progression honors the two authored icons and conditions", () => {
  const result = getDayProgression({
    icon: "cloudy",
    condition: "Cloudy",
    laterIcon: "wintry-mix",
    laterCondition: "Snow and sleet possible",
    laterTiming: "Evening",
    sky: "overcast"
  });

  assert.equal(result.first.icon, "☁️");
  assert.equal(result.later.icon, "🌨️");
  assert.equal(result.later.condition, "Snow and sleet possible");
  assert.equal(result.later.timing, "Evening");
});

test("adding a later icon to a legacy storm day keeps sunny skies first", () => {
  const result = getDayProgression({
    icon: "thunderstorm",
    condition: "Mostly sunny",
    sky: "mostly_sunny",
    evolution: "building",
    stormRisk: "scattered",
    laterIcon: "snow"
  });
  assert.equal(result.first.icon, "🌤️");
  assert.equal(result.later.icon, "🌨️");
  assert.equal(result.later.condition, "Snow possible");
});

test("a generic back-and-forth sky keeps the published single icon", () => {
  const result = getDayProgression({ icon: "partly-cloudy", condition: "Mostly sunny", sky: "mostly_sunny", evolution: "mixed", stormRisk: "none" });
  assert.equal(result.first.icon, "⛅");
  assert.equal(result.later, null);
});

test("clearing clouds create a later bright phase", () => {
  const result = getDayProgression({ sky: "mostly_cloudy", evolution: "clearing", stormRisk: "none" });
  assert.equal(result.first.condition, "Mostly cloudy");
  assert.equal(result.later.condition, "Brighter later");
});

test("winter icons normalize from authored names", () => {
  assert.equal(normalizeDayIcon("snow"), "🌨️");
  assert.equal(normalizeDayIcon("freezing-rain"), "🌧️");
});

test("Weather Setup can show a winter precipitation-type change", () => {
  const result = getDayProgression({
    sky: "snow",
    condition: "Snow",
    evolution: "changing_precip",
    laterIcon: "freezing-rain",
    laterTiming: "evening"
  });
  assert.equal(result.first.condition, "Snow");
  assert.equal(result.later.icon, "🌧️");
  assert.equal(result.later.condition, "Freezing rain possible");
  assert.equal(result.later.timing, "Evening");
});

test("No second icon suppresses an automatically suggested storm phase", () => {
  const result = getDayProgression({
    sky: "mostly_sunny", evolution: "building", stormRisk: "scattered",
    rainWindow: { start: "afternoon" }, laterIcon: "none"
  });
  assert.equal(result.later, null);
});

test("developing rain gives a second icon when rain timing is specified", () => {
  const result = getDayProgression({
    sky: "mostly_sunny", evolution: "developing", stormRisk: "none",
    rainWindow: { start: "midday" }
  });
  assert.equal(result.later.condition, "Showers possible");
  assert.equal(result.later.timing, "Midday");
});
