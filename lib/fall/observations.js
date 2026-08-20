import { FALL_ANCHOR_STATIONS, STATION_BY_ID } from "../observations/registry.js";

export function normalizeFallObservations(payload, destinations = [], { now = Date.now() } = {}) {
  const destinationById = new Map(destinations.map((destination) => [destination.id, destination]));
  const stations = Array.isArray(payload?.stations) ? payload.stations : [];
  const anchors = [];
  const rejected = [];

  for (const station of stations) {
    const definition = STATION_BY_ID.get(station?.id);
    const config = definition?.fall;
    if (!config) continue;
    const { destinationId } = config;
    const destination = destinationById.get(destinationId);
    const observedAt = Date.parse(station.observedAt);
    const ageMs = now - observedAt;
    const temperatureF = finite(station.temperatureF);
    const maxAgeMinutes = definition.maxAgeMinutes || 90;
    const healthUsable = station.health ? station.health.usable === true : station.status === "live";
    const fresh = healthUsable && Number.isFinite(observedAt) && ageMs >= -5 * 60 * 1000 && ageMs <= maxAgeMinutes * 60000;

    if (!destination || !fresh || temperatureF == null) {
      rejected.push({ id: station.id, destinationId, reason: !destination ? "destination-unavailable" : temperatureF == null ? "temperature-missing" : "stale-or-not-live" });
      continue;
    }

    const forecastHour = nearestHour(destination.hourly || [], observedAt);
    const destinationForecastF = finite(forecastHour?.temperatureF);
    const stationElevation = finite(station.elevationFt);
    const destinationElevation = finite(destination.elevationFeet);
    const forecastTemperatureF = config.comparisonMethod === "elevation-adjusted" && destinationForecastF != null && stationElevation != null && destinationElevation != null
      ? round(destinationForecastF + ((destinationElevation - stationElevation) / 1000) * 3.5, 1)
      : destinationForecastF;
    const residualF = forecastTemperatureF == null ? null : round(temperatureF - forecastTemperatureF, 1);
    const crossStationStatus = Math.abs(residualF) > 15 ? "outlier" : Math.abs(residualF) > 10 ? "watch" : "normal";
    const healthFactor = station.health?.status === "suspect" ? 0.6 : 1;
    const crossFactor = crossStationStatus === "outlier" ? 0.5 : crossStationStatus === "watch" ? 0.75 : 1;
    const fallbackFactor = station.retrievalMode && station.retrievalMode !== "live" ? 0.75 : 1;
    const effectiveWeight = round(config.weight * healthFactor * crossFactor * fallbackFactor, 3);
    anchors.push({
      id: station.id,
      stationId: station.stationId || null,
      name: station.name,
      destinationId,
      terrainRole: config.terrainRole,
      comparisonMethod: config.comparisonMethod,
      weight: config.weight,
      baseWeight: config.weight,
      effectiveWeight,
      sitingConfidence: config.sitingConfidence || (config.weight < 1 ? "low" : "medium"),
      sitingNote: config.sitingNote || null,
      role: station.role || null,
      elevationFeet: stationElevation,
      latitude: finite(station.lat),
      longitude: finite(station.lon),
      observedAt: new Date(observedAt).toISOString(),
      ageMinutes: Math.round(ageMs / 60000),
      temperatureF,
      dewPointF: finite(station.dewPointF),
      humidityPct: finite(station.humidityPct),
      windMph: finite(station.windMph),
      gustMph: finite(station.gustMph),
      forecastTimestamp: forecastHour?.timestamp || null,
      forecastCloudCover: finite(forecastHour?.cloudCover),
      forecastWindMph: finite(forecastHour?.windSpeed),
      forecastTemperatureF,
      temperatureResidualF: residualF,
      crossStationStatus,
      health: station.health || null,
      retrievalMode: station.retrievalMode || "artifact",
      source: station.source || "Observation",
      url: station.url || null
    });
  }

  const generatedAt = Date.parse(payload?.generatedAt);
  const generatedAgeMinutes = Number.isFinite(generatedAt) ? Math.round((now - generatedAt) / 60000) : null;
  return {
    status: anchors.length >= 3 ? "fresh" : anchors.length ? "partial" : stations.length ? "stale" : "unavailable",
    generatedAt: Number.isFinite(generatedAt) ? new Date(generatedAt).toISOString() : null,
    generatedAgeMinutes,
    maxAgeMinutes: Math.max(...FALL_ANCHOR_STATIONS.map((station) => station.maxAgeMinutes || 90)),
    requestedAnchors: FALL_ANCHOR_STATIONS.length,
    availableAnchors: anchors.length,
    anchors,
    rejected,
    networkQuality: payload?.quality || null
  };
}

function nearestHour(hours, timestamp) {
  return hours.reduce((best, hour) => {
    if (!Number.isFinite(hour?.timestamp)) return best;
    if (!best) return hour;
    return Math.abs(hour.timestamp - timestamp) < Math.abs(best.timestamp - timestamp) ? hour : best;
  }, null);
}

function finite(value) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function round(value, digits) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
