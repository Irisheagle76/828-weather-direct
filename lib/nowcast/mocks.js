export const MOCK_SCENARIOS = Object.freeze([
  "quiet", "temperature-falling", "dew-point-rising", "stronger-gusts", "wind-shift",
  "rain-beginning", "rain-ending", "heavy-rain", "tempest-stale", "tempest-unavailable",
  "new-nws-alert", "forecast-wetter", "nws-unavailable", "multiple-changes"
]);

export function buildMockData(scenario = "quiet", now = Date.now()) {
  const selected = MOCK_SCENARIOS.includes(scenario) ? scenario : "quiet";
  const history = Array.from({ length: 12 }, (_, index) => {
    const minutesAgo = 60 - index * 5;
    return baseObservation(now - minutesAgo * 60_000);
  });
  let observation = baseObservation(now - 60_000);
  let tempestError = null;
  let nwsError = null;
  const previousForecast = baseForecast(now - 15 * 60_000, 20, 67, "Mostly Sunny");
  let forecast = baseForecast(now - 2 * 60_000, 20, 67, "Mostly Sunny");
  let alerts = [];
  let previousAlerts = [];

  if (["temperature-falling", "multiple-changes"].includes(selected)) observation.temperatureF = 61;
  if (selected === "dew-point-rising") observation.dewPointF = 58;
  if (["stronger-gusts", "multiple-changes"].includes(selected)) { observation.windSpeedMph = 15; observation.windGustMph = 27; }
  if (selected === "wind-shift") { history.forEach(item => { item.windDirectionDeg = 350; item.windSpeedMph = 8; }); observation.windDirectionDeg = 55; observation.windSpeedMph = 10; }
  if (["rain-beginning", "multiple-changes"].includes(selected)) { observation.rainRateInPerHour = 0.12; observation.rainAccumulationIn = 0.02; }
  if (selected === "rain-ending") { history.slice(-2).forEach(item => { item.rainRateInPerHour = 0.08; }); observation.rainRateInPerHour = 0; }
  if (selected === "heavy-rain") observation.rainRateInPerHour = 0.72;
  if (selected === "tempest-stale") { observation.timestamp = now - 25 * 60_000; observation.freshness = "stale"; }
  if (selected === "tempest-unavailable") { observation = null; tempestError = "Mock Tempest unavailable"; }
  if (["new-nws-alert", "multiple-changes"].includes(selected)) alerts = [baseAlert(now)];
  if (selected === "forecast-wetter") forecast = baseForecast(now - 2 * 60_000, 70, 64, "Showers Likely");
  if (selected === "nws-unavailable") { forecast = null; nwsError = "Mock NWS unavailable"; }

  return { scenario: selected, now, observation, history, forecast, hourly: forecast ? baseHourly(now) : null, previousForecast, alerts, previousAlerts, tempestError, nwsError };
}

function baseObservation(timestamp) {
  return {
    timestamp, temperatureF: 66, dewPointF: 52, humidityPct: 58, feelsLikeF: 66,
    windDirectionDeg: 225, windSpeedMph: 5, windGustMph: 10, pressureMb: 1017.2,
    rainRateInPerHour: 0, rainAccumulationIn: 0, lightningDistanceMiles: null,
    lightningCount: 0, uvIndex: 2.1, solarRadiationWm2: 260,
    source: "Tempest (mock)", freshness: "fresh", fetchStatus: "success", fetchedAt: timestamp
  };
}

function baseForecast(updatedAt, pop, temperature, shortForecast) {
  return { kind: "point", updatedAt, fetchedAt: updatedAt, source: "National Weather Service (mock)", periods: [{ number: 1, name: "This Afternoon", startTime: new Date(updatedAt).toISOString(), endTime: new Date(updatedAt + 6 * 60 * 60_000).toISOString(), isDaytime: true, temperatureF: temperature, temperatureUnit: "F", precipProbabilityPct: pop, windSpeed: "5 to 10 mph", windSpeedMph: 10, windDirection: "SW", shortForecast, detailedForecast: `${shortForecast} with southwest winds.` }] };
}

function baseHourly(now) {
  return { kind: "hourly", updatedAt: now - 2 * 60_000, fetchedAt: now, source: "National Weather Service (mock)", periods: Array.from({ length: 8 }, (_, index) => ({ number: index + 1, name: "", startTime: new Date(now + index * 60 * 60_000).toISOString(), endTime: new Date(now + (index + 1) * 60 * 60_000).toISOString(), temperatureF: 66 - index, temperatureUnit: "F", precipProbabilityPct: 20 + index * 3, windSpeed: "5 mph", windSpeedMph: 5, windDirection: "SW", shortForecast: index < 3 ? "Partly Cloudy" : "Chance Showers", detailedForecast: "" })) };
}

function baseAlert(now) {
  return { id: "mock-alert-1", event: "Special Weather Statement", severity: "Moderate", urgency: "Expected", certainty: "Likely", headline: "Mock Special Weather Statement for Buncombe County", effective: new Date(now - 5 * 60_000).toISOString(), expires: new Date(now + 60 * 60_000).toISOString(), area: "Buncombe County", description: "Mock alert text for Phase 1 testing.", instruction: "Monitor official NWS information.", sent: new Date(now - 5 * 60_000).toISOString(), source: "National Weather Service (mock)", url: "https://api.weather.gov/alerts/mock-alert-1" };
}
