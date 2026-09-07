const FEET_TO_METERS = 0.3048;
const STANDARD_TEMPERATURE_K = 288;
const STANDARD_LAPSE_K_PER_M = 0.0065;
const PRESSURE_EXPONENT = 5.2561;
const STANDARD_SEA_LEVEL_MB = 1013.25;
const MIN_COMPARABLE_MB = 870;
const MAX_COMPARABLE_MB = 1085;
const DATUM_DECISION_MARGIN_MB = 8;

export function stationToElevationAdjustedPressureMb(stationPressureMb, elevationFt) {
  if (!Number.isFinite(stationPressureMb) || !Number.isFinite(elevationFt)) return null;
  const elevationM = elevationFt * FEET_TO_METERS;
  const factor = ((STANDARD_TEMPERATURE_K - STANDARD_LAPSE_K_PER_M * elevationM) / STANDARD_TEMPERATURE_K) ** PRESSURE_EXPONENT;
  if (!Number.isFinite(factor) || factor <= 0) return null;
  return round(stationPressureMb / factor);
}

export function harmonizePressureObservations(stations = []) {
  const explicitSeaLevel = stations
    .map((station) => station?.observation)
    .filter((observation) => observation?.pressureDatum === "sea_level" && Number.isFinite(observation.seaLevelPressureMb))
    .map((observation) => observation.seaLevelPressureMb)
    .sort((a,b) => a - b);
  const reference = median(explicitSeaLevel) ?? STANDARD_SEA_LEVEL_MB;

  return stations.map((station) => {
    if (!station?.observation) return station;
    return { ...station, observation: normalizePressure(station.observation, station.elevationFt, reference) };
  });
}

export function normalizePressure(observation, elevationFt, referenceMb = STANDARD_SEA_LEVEL_MB) {
  const result = { ...observation };
  const datum = observation.pressureDatum;

  if (datum === "sea_level" && plausible(observation.seaLevelPressureMb)) {
    result.normalizedPressureMb = round(observation.seaLevelPressureMb);
    result.pressureNormalization = "reported_sea_level";
    return result;
  }

  if (datum === "station" && Number.isFinite(observation.stationPressureMb)) {
    const adjusted = stationToElevationAdjustedPressureMb(observation.stationPressureMb,elevationFt);
    if (plausible(adjusted)) {
      result.normalizedPressureMb = adjusted;
      result.pressureNormalization = "elevation_reduced_station";
      return result;
    }
  }

  if (datum === "ambiguous" && Number.isFinite(observation.reportedPressureMb)) {
    const raw = observation.reportedPressureMb;
    const adjusted = stationToElevationAdjustedPressureMb(raw,elevationFt);
    const rawDistance = plausible(raw) ? Math.abs(raw - referenceMb) : Infinity;
    const adjustedDistance = plausible(adjusted) ? Math.abs(adjusted - referenceMb) : Infinity;
    if (rawDistance + DATUM_DECISION_MARGIN_MB < adjustedDistance) {
      result.seaLevelPressureMb = round(raw);
      result.normalizedPressureMb = round(raw);
      result.pressureDatum = "sea_level_inferred";
      result.pressureNormalization = "inferred_sea_level";
      return result;
    }
    if (adjustedDistance + DATUM_DECISION_MARGIN_MB < rawDistance) {
      result.stationPressureMb = round(raw);
      result.normalizedPressureMb = adjusted;
      result.pressureDatum = "station_inferred";
      result.pressureNormalization = "inferred_station_elevation_reduced";
      return result;
    }
  }

  result.normalizedPressureMb = null;
  result.pressureNormalization = "unresolved";
  return result;
}

function plausible(value) {
  return Number.isFinite(value) && value >= MIN_COMPARABLE_MB && value <= MAX_COMPARABLE_MB;
}

function median(values) {
  if (!values.length) return null;
  const middle = Math.floor(values.length / 2);
  return values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
}

function round(value) {
  return Number.isFinite(value) ? Number(value.toFixed(3)) : null;
}
