import test from "node:test";
import assert from "node:assert/strict";
import { forecastComfortCopy } from "../public/js/intel/forecast-comfort-context.js";
const now = Date.parse("2026-09-15T21:00:00Z");
const hour = (timestamp, temperatureF) => ({ timestamp: Date.parse(timestamp), temperatureF, dewpointF: 60, windSpeed: 4 });
test("Tomorrow follows authored 89F forecast, not comfortable midnight snapshot", () => {
  const copy = forecastComfortCopy({ now, tomorrow: true, item: { score: 71, headline: "Pleasant conditions", narrative: "Temperatures stay mild" }, forecast: { days: { "2026-09-16": { high: 89, low: 60, headline: "Hot and sunny", narrative: "Afternoon temps rise to near 90°. Lots of sunshine again." } } } });
  assert.equal(copy.headline, "Hot and sunny"); assert.match(copy.weatherNarrative, /near 90°/); assert.doesNotMatch(copy.weatherNarrative, /average|curve/); assert.equal(copy.emoji, "🥵");
});
test("Fallback uses tomorrow afternoon peak, excluding other days", () => {
  const copy = forecastComfortCopy({ now, tomorrow: true, hourly: [hour("2026-09-16T04:00:00Z", 60), hour("2026-09-16T19:00:00Z", 90), hour("2026-09-17T19:00:00Z", 100)] });
  assert.match(copy.headline, /Hot/); assert.match(copy.narrative, /60–90/); assert.doesNotMatch(copy.narrative, /100|stay mild/);
});
test("Evening does not repeat past-afternoon wording", () => {
  const copy = forecastComfortCopy({ now, forecast: { days: { "2026-09-15": { headline: "Warm by afternoon", narrative: "It turns warmer by afternoon" } } }, hourly: [hour("2026-09-15T21:00:00Z", 80), hour("2026-09-16T02:00:00Z", 70)] });
  assert.match(copy.narrative, /tonight/); assert.doesNotMatch(copy.narrative, /by afternoon/);
});
test("Missing hourly and authored data explicitly unavailable", () => {
  assert.match(forecastComfortCopy({ now, tomorrow: true }).narrative, /unavailable/);
});
