// Phase 1 thresholds are operational starting points, not universal scientific limits.
// Keep them centralized so a meteorologist can tune behavior without editing detectors.
export const NOWCAST_CONFIG = Object.freeze({
  version: "1.0.0-phase1",
  location: {
    name: "Asheville, NC",
    latitude: 35.5951,
    longitude: -82.5515
  },
  thresholds: {
    temperatureF30m: 3,
    dewPointF30m: 3,
    humidityPoints30m: 15,
    pressureMb60m: 1.5,
    windDirectionDegrees30m: 45,
    minimumWindMphForDirection: 5,
    sustainedWindMph30m: 8,
    gustMph30m: 10,
    measurableRainInPerHour: 0.01,
    heavyRainInPerHour: 0.3,
    rainEndGraceMinutes: 10,
    staleTempestMinutes: 10,
    delayedNwsForecastMinutes: 20,
    staleNwsForecastMinutes: 45,
    delayedNwsAlertsMinutes: 5,
    staleNwsAlertsMinutes: 15,
    failedSourceConsecutiveFailures: 3,
    forecastTemperatureF: 3,
    forecastPopPoints: 20,
    forecastWindMph: 8
  },
  cacheMs: {
    tempest: 90_000,
    nwsAlerts: 120_000,
    nwsForecast: 600_000
  },
  retention: {
    observationsHours: 72,
    maxObservations: 1_000,
    forecastsHours: 48,
    maxForecasts: 48,
    alertsHours: 168,
    maxAlertSnapshots: 168,
    maxDrafts: 100,
    maxLogs: 250
  }
});

export const PHASE1_SOURCE_NAMES = Object.freeze([
  "tempest",
  "nwsPointForecast",
  "nwsHourlyForecast",
  "nwsAlerts",
  "observationStorage",
  "draftStorage"
]);
