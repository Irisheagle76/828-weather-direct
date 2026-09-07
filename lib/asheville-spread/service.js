import { ASHEVILLE_STATIONS, publicStationMetadata } from "./stations.js";
import { fetchStationObservation } from "./providers.js";
import { assessObservation } from "./quality.js";
import { harmonizePressureObservations } from "./pressure.js";

export async function buildAshevilleSpread(options = {}) {
  const nowMs = options.nowMs ?? Date.now();
  const stations = options.stations ?? ASHEVILLE_STATIONS;
  const fetcher = options.fetcher ?? fetchStationObservation;
  const fetched = await Promise.all(stations.map(async (station) => {
    const metadata = publicStationMetadata(station);
    if (station.enabled === false) {
      return {
        ...metadata,
        status: "unavailable",
        observation: null,
        quality: { freshness: "unknown", ageMinutes: null, usable: false, flags: ["source_not_configured"] },
        unavailableReason: station.unavailableReason
      };
    }

    try {
      const observation = await fetcher(station, options);
      return {
        ...metadata,
        status: "pending",
        observation,
        quality: null
      };
    } catch (error) {
      return {
        ...metadata,
        status: "unavailable",
        observation: null,
        quality: { freshness: "unknown", ageMinutes: null, usable: false, flags: [error?.code ?? "source_error"] },
        unavailableReason: publicErrorMessage(error)
      };
    }
  }));
  const observations = harmonizePressureObservations(fetched).map((station) => {
    if (!station.observation) return station;
    const quality = assessObservation(station.observation,nowMs);
    return { ...station, status: quality.usable ? "reporting" : "degraded", quality };
  });

  return {
    generatedAt: new Date(nowMs).toISOString(),
    network: {
      id: "asheville-spread",
      name: "Asheville Spread",
      stationCount: observations.length,
      enabledStationCount: observations.filter((station) => station.enabled).length
    },
    summary: summarizeObservations(observations),
    stations: observations
  };
}

export function summarizeObservations(stations) {
  const coreStations = stations.filter((station) => (station.scope ?? "core") === "core");
  const metroStations = stations.filter((station) => station.scope === "metro");
  const corridorStations = stations.filter((station) => station.scope === "corridor");
  const core = summarizeStationGroup(coreStations);
  const regional = summarizeStationGroup(stations);
  const corridors = Object.fromEntries(
    ["north", "east", "south", "west"].map((direction) => [
      direction,
      summarizeStationGroup(corridorStations.filter((station) => station.corridor === direction))
    ])
  );

  return {
    ...core,
    coreStationCount: coreStations.length,
    metroStationCount: metroStations.length,
    corridorStationCount: corridorStations.length,
    metroContext: summarizeStationGroup(metroStations),
    corridors,
    regionalTemperatureSpreadF: regional.temperatureSpreadF,
    regionalCoolest: regional.coolest,
    regionalWarmest: regional.warmest
  };
}

function summarizeStationGroup(stations) {
  const reporting = stations.filter((station) => station.observation);
  const usable = reporting.filter((station) => station.quality?.usable && Number.isFinite(station.observation?.temperatureF));
  const sorted = [...usable].sort((a, b) => a.observation.temperatureF - b.observation.temperatureF);
  const coolest = sorted[0] ?? null;
  const warmest = sorted.at(-1) ?? null;
  const elevationValues = stations.map((station) => station.elevationFt).filter(Number.isFinite);

  return {
    reportingStationCount: reporting.length,
    usableStationCount: usable.length,
    freshStationCount: reporting.filter((station) => station.quality?.freshness === "fresh").length,
    temperatureSpreadF: coolest && warmest
      ? Number((warmest.observation.temperatureF - coolest.observation.temperatureF).toFixed(1))
      : null,
    coolest: coolest ? stationTemperatureSummary(coolest) : null,
    warmest: warmest ? stationTemperatureSummary(warmest) : null,
    elevationRangeFt: elevationValues.length ? Math.max(...elevationValues) - Math.min(...elevationValues) : null
  };
}

function stationTemperatureSummary(station) {
  return {
    stationId: station.id,
    name: station.name,
    temperatureF: station.observation.temperatureF,
    observedAt: station.observation.observedAt
  };
}

function publicErrorMessage(error) {
  switch (error?.code) {
    case "missing_credentials": return "Provider credentials are not configured";
    case "empty_observation": return "Provider returned no current observation";
    case "upstream_timeout": return "Provider timed out";
    case "upstream_http": return "Provider request failed";
    default: return "Observation is temporarily unavailable";
  }
}
