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
  assert.match(copy.headline, /hot/i); assert.match(copy.narrative, /60°F.*90°F by 3 PM/); assert.doesNotMatch(copy.narrative, /100|stay mild/);
});
test("Evening does not repeat past-afternoon wording", () => {
  const copy = forecastComfortCopy({ now, forecast: { days: { "2026-09-15": { headline: "Warm by afternoon", narrative: "It turns warmer by afternoon" } } }, hourly: [hour("2026-09-15T21:00:00Z", 80), hour("2026-09-16T02:00:00Z", 70)] });
  assert.match(copy.headline, /tonight/); assert.match(copy.narrative, /80°F at 5 PM to 70°F by 10 PM/); assert.doesNotMatch(copy.narrative, /by afternoon/);
});
test("Missing hourly and authored data explicitly unavailable", () => {
  const copy = forecastComfortCopy({ now, tomorrow: true });
  assert.match(copy.narrative, /unavailable/);
  assert.match(copy.weatherNarrative, /unavailable/);
});

const afternoon = Date.parse("2026-10-16T19:00:00Z"); // 3 PM Eastern
const series = (temps, fields = {}, start = afternoon) => temps.map((temp, i) => ({ ...hour(new Date(start + i * 3600000).toISOString(), temp), ...fields }));

test("Screenshot scenario explains warm afternoon becoming cooler with clearing skies", () => {
  const hourly = series([81, 79, 75, 70, 66, 63, 60]);
  hourly.forEach((h, i) => { h.cloudCover = i < 3 ? .9 : .1; });
  const copy = forecastComfortCopy({ now: afternoon, hourly, item: { score: 75, emoji: "💨" } });
  assert.equal(copy.headline, "Warm afternoon, cooler evening");
  assert.equal(copy.weatherNarrative, "Temperatures fall from around 81°F at 3 PM to 60°F by 9 PM. Clouds give way to mostly clear skies by 9 PM.");
  assert.equal(copy.emoji, "🌙");
  assert.doesNotMatch(copy.narrative, /hourly guidance puts|warmer hours|60–81|curve/);
});

test("Afternoon warmup and evening cooldown retain the intervening peak", () => {
  const copy = forecastComfortCopy({ now: afternoon, hourly: series([78, 84, 80, 76, 72, 68, 65], { cloudCover: 15 }) });
  assert.match(copy.weatherNarrative, /78°F at 3 PM to near 84°F around 4 PM, then ease to 65°F by 9 PM/);
  assert.match(copy.weatherNarrative, /Mostly clear skies/);
});

test("Rising evening temperatures are not described as cooling by default", () => {
  const copy = forecastComfortCopy({ now, hourly: series([65, 67, 70, 73], { cloudCover: 95 }, now) });
  assert.equal(copy.headline, "Warming up");
  assert.match(copy.weatherNarrative, /climb from around 65°F at 5 PM to 73°F by 8 PM/);
});

test("Steady temperatures and increasing clouds get a concise outlook", () => {
  const hourly = series([71, 72, 72, 71]);
  hourly.forEach((h, i) => { h.cloudCover = i < 2 ? 10 : 90; });
  const copy = forecastComfortCopy({ now: afternoon, hourly });
  assert.equal(copy.headline, "Mild and fairly steady");
  assert.match(copy.weatherNarrative, /hold near 71°F through 6 PM/);
  assert.match(copy.weatherNarrative, /Clouds build/);
});

test("Intermediate clouds do not become a claim of unbroken clear skies", () => {
  const hourly = series([75, 73, 71]);
  hourly.forEach((h, i) => { h.cloudCover = i === 1 ? .95 : .05; });
  const copy = forecastComfortCopy({ now: afternoon, hourly });
  assert.match(copy.weatherNarrative, /Cloud cover varies/);
  assert.doesNotMatch(copy.weatherNarrative, /Mostly clear skies through/);
});

test("Thunderstorm hour is mentioned even between clear endpoints", () => {
  const hourly = series([81, 79, 75, 70], { weatherCode: 0, cloudCover: .1 });
  hourly[2].weatherCode = 95;
  const copy = forecastComfortCopy({ now: afternoon, hourly });
  assert.match(copy.weatherNarrative, /Thunderstorms are possible around 5 PM/);
  assert.doesNotMatch(copy.weatherNarrative, /Mostly clear skies through|dry/);
  assert.equal(copy.emoji, "⛈️");
});

test("Rain probability works with fractional and percentage inputs without claiming certainty", () => {
  for (const chance of [.6, 60]) {
    const hourly = series([75, 73, 70], { cloudCover: .8 });
    hourly[1].precipProbability = chance;
    const copy = forecastComfortCopy({ now: afternoon, hourly });
    assert.match(copy.weatherNarrative, /Rain is likely around 4 PM \(60% chance\)/);
    assert.doesNotMatch(copy.weatherNarrative, /dry|will rain/);
  }
});

test("Missing sky fields never become clear skies or sunshine", () => {
  const copy = forecastComfortCopy({ now: afternoon, hourly: series([81, 75, 70], { cloudCover: null, weatherCode: null }) });
  assert.doesNotMatch(copy.weatherNarrative, /clear|sun|cloud|dry|rain/);
  assert.equal(copy.emoji, "🙂");
});

test("Weather codes supply sky conditions when cloud cover is missing", () => {
  const copy = forecastComfortCopy({ now: afternoon, hourly: series([75, 73, 70], { weatherCode: 3 }) });
  assert.match(copy.weatherNarrative, /Mostly cloudy skies/);
});

test("Upcoming hours replace today's already elapsed authored weather", () => {
  const copy = forecastComfortCopy({ now: afternoon, forecast: { days: { "2026-10-16": { headline: "A chilly start", narrative: "Morning fog gives way to sunshine." } } }, hourly: series([81, 78, 74]) });
  assert.match(copy.weatherNarrative, /81°F at 3 PM to 74°F by 5 PM/);
  assert.doesNotMatch(copy.weatherNarrative, /Morning|fog/);
});

test("Authored forecast remains available when daytime hourly data is missing", () => {
  const copy = forecastComfortCopy({ now: afternoon, forecast: { days: { "2026-10-16": { headline: "Warm and sunny", narrative: "A warm afternoon ahead." } } } });
  assert.equal(copy.headline, "Warm and sunny");
});

test("Unsorted timestamps in seconds exclude past and distant hours", () => {
  const hourly = series([81, 78, 75]);
  hourly.push({ timestamp: afternoon - 3600000, temperatureF: 100 }, { timestamp: afternoon + 7 * 3600000, temperatureF: 20 });
  const copy = forecastComfortCopy({ now: afternoon, hourly: hourly.reverse().map(h => ({ ...h, timestamp: h.timestamp / 1000 })) });
  assert.match(copy.weatherNarrative, /81°F at 3 PM to 75°F by 5 PM/);
  assert.doesNotMatch(copy.weatherNarrative, /100|20°F/);
});

test("Crossing midnight and winter Eastern time use the correct local clock", () => {
  const winter = Date.parse("2026-12-16T03:00:00Z"); // 10 PM EST
  const copy = forecastComfortCopy({ now: winter, hourly: series([40, 38, 36, 34], { cloudCover: 90 }, winter) });
  assert.match(copy.weatherNarrative, /40°F at 10 PM to 34°F by 1 AM tomorrow/);
  assert.doesNotMatch(copy.weatherNarrative, /sunshine/);
});

test("A cold dip followed by recovery is not reduced to steady endpoints", () => {
  const copy = forecastComfortCopy({ now: afternoon, hourly: series([65, 58, 62, 66]) });
  assert.match(copy.headline, /Cooler first/);
  assert.match(copy.weatherNarrative, /dip.*58°F around 4 PM, then recover to 66°F/);
});

test("A single reading cannot imply a temperature trend", () => {
  const copy = forecastComfortCopy({ now: afternoon, hourly: series([72]) });
  assert.match(copy.weatherNarrative, /near 72°F at 3 PM.*More hourly detail/);
  assert.doesNotMatch(copy.weatherNarrative, /fall|climb|hold/);
});

test("Large gaps in hourly coverage are disclosed", () => {
  const hourly = series([81, null, null, null, null, 65]);
  const copy = forecastComfortCopy({ now: afternoon, hourly });
  assert.match(copy.weatherNarrative, /Some hourly detail is missing/);
});

test("A rain chance overrides an otherwise clear-weather icon and continuous clear claim", () => {
  const hourly = series([75, 73, 71], { weatherCode: 0, precipProbability: .4 });
  const copy = forecastComfortCopy({ now: afternoon, hourly });
  assert.match(copy.weatherNarrative, /Rain is possible/);
  assert.doesNotMatch(copy.weatherNarrative, /clear skies through|dry/);
  assert.equal(copy.emoji, "🌦️");
});

test("Wintry weather and fog codes take priority over cloud cover", () => {
  for (const [weatherCode, expected] of [[71, /Snow is possible/], [66, /Freezing rain or drizzle is possible/], [45, /Fog may limit visibility/]]) {
    const copy = forecastComfortCopy({ now: afternoon, hourly: series([32, 30, 28], { weatherCode, cloudCover: .1 }) });
    assert.match(copy.weatherNarrative, expected);
    assert.doesNotMatch(copy.weatherNarrative, /Mostly clear/);
  }
});
