const ASHEVILLE_STATION_IDS = new Set(["tempest-237451", "econet-unca", "nws-kavl", "econet-flet",
  "tempest-144737",
  "tempest-127602",
  "windy-ridge-trail",
  "webb-weather",
  "beaucatcher-mountain",
  "spivey-mountain"
]);
const HIGH_ASHEVILLE_STATION_IDS = new Set(["windy-ridge-trail", "webb-weather", "spivey-mountain"]);
const LIGHTNING_SIGNAL_MAX_AGE_MS = 3 * 60 * 60 * 1000;
export const HIKING_CALIBRATION = Object.freeze({
  version: "2026-11-22-wet-footing-v2",
  wetGroundMaxPenalty: 20,
  wetGroundScaleIn: 0.15
});

export function analyzeHikingStations(stations = [], { now = Date.now(), snowDepth = [] } = {}) {
  const usable = stations.filter((station) => station.health?.usable !== false && finite(station.temperatureF) != null);
  const asheville = usable.filter((station) => ASHEVILLE_STATION_IDS.has(station.id));
  const highs = usable.filter((station) => HIGH_ASHEVILLE_STATION_IDS.has(station.id));
  const lower = usable.find((station) => station.id === "tempest-144737");
  const high = highs[0];
  const mitchell = usable.find((station) => station.id === "mount-mitchell");
  const localTempSpread = spread(asheville);
  const highStationSpread = spread(highs);
  const localAvg = average(asheville.map((station) => finite(station.temperatureF)));
  const lapseRate = lower && high
    ? (lower.temperatureF - high.temperatureF) / ((high.elevationFt - lower.elevationFt) / 1000)
    : null;
  const mitchellDrop = localAvg != null && mitchell ? localAvg - mitchell.temperatureF : null;
  const wncLapseRate = lower && mitchell
    ? (lower.temperatureF - mitchell.temperatureF) / ((mitchell.elevationFt - lower.elevationFt) / 1000)
    : null;
  const dewSpreads = usable
    .map((station) => finite(station.dewPointF) == null ? null : station.temperatureF - station.dewPointF)
    .filter(Number.isFinite);
  const minDewSpread = dewSpreads.length ? Math.min(...dewSpreads) : null;
  const maxUv = maximum(usable.map((station) => finite(station.uv) ?? uvFromSolar(station.solarWm2) ?? 0));
  const maxSolar = maximum(usable.map((station) => finite(station.solarWm2) ?? 0));
  const maxGust = maximum(usable.map((station) => finite(station.gustMph) ?? finite(station.windMph) ?? 0));
  const maxTemp = maximum(usable.map((station) => finite(station.temperatureF)));
  const maxWbgt = maximum(usable.map((station) => finite(station.wbgtF)));
  const maxRainRate = maximum(usable.map((station) => finite(station.rainRateInHr) ?? 0));
  const maxRainToday = maximum(usable.map((station) => finite(station.rainTodayIn) ?? 0));
  const lightningStations = usable.filter((station) => station.provider === "tempest" && hasLightningSignal(station, now));
  const nearestLightningStation = lightningStations
    .slice()
    .sort((a, b) => (finite(a.lightningLastDistanceMiles) ?? Infinity) - (finite(b.lightningLastDistanceMiles) ?? Infinity))[0] || null;
  const lightningActive = lightningStations.length > 0;
  const lightningCounts1h = sum(lightningStations, "lightningStrikes1h");
  const lightningCounts3h = sum(lightningStations, "lightningStrikes3h");
  const lightningDetails = lightningDetail(nearestLightningStation);
  const fogRisk = minDewSpread == null ? "Unknown" : minDewSpread <= 4 ? "Elevated" : minDewSpread <= 8 ? "Patchy pockets" : "Low";
  const scoreStations = asheville.length ? asheville : usable;
  const scoreScope = asheville.length ? "Asheville-area trails" : "Available regional observations";
  const missingScoreInputs = [
    ["moisture", scoreStations.some(s => finite(s.dewPointF) != null)],
    ["wind", scoreStations.some(s => finite(s.windMph) != null || finite(s.gustMph) != null)],
    ["precipitation", scoreStations.some(s => finite(s.rainRateInHr) != null || finite(s.precipitationLastHourIn) != null || Boolean(s.weatherDescription?.trim()))]
  ].filter(([, present]) => !present).map(([name]) => name);
  const scoreAvailable = usable.length > 0 && missingScoreInputs.length === 0;
  const localSnow = snowDepth.find(({ id }) => id === "asheville");
  const localWinter = scoreStations.map(winterObservation);
  const localConditions = {
    snowDepthIn: asheville.length ? localSnow?.depthIn ?? null : null,
    freezingPrecipitation: localWinter.includes("freezing precipitation"),
    snowFalling: localWinter.includes("snow"),
    refreezePossible: localWinter.includes("possible refreeze"),
    fogRisk: localFog(scoreStations),
    apparentTempF: average(scoreStations.map(apparentColdTemperature)),
    maxUv: maximum(scoreStations.map((s) => finite(s.uv) ?? uvFromSolar(s.solarWm2))),
    maxSolar: maximum(scoreStations.map((s) => finite(s.solarWm2))),
    maxGust: maximum(scoreStations.map((s) => finite(s.gustMph) ?? finite(s.windMph))),
    maxTemp: maximum(scoreStations.map((s) => finite(s.temperatureF))),
    maxWbgt: maximum(scoreStations.map((s) => finite(s.wbgtF))),
    maxRainRate: maximum(scoreStations.map((s) => finite(s.rainRateInHr))),
    maxRainToday: maximum(scoreStations.map((s) => finite(s.rainTodayIn))),
    recentRainIn: maximum(scoreStations.map((s) => Math.max(finite(s.rainTodayIn) ?? 0, finite(s.precipitationLastHourIn) ?? 0))),
    rainPenalty: maximum(scoreStations.map(observedRainPenalty)),
    lightning: { active: lightningActive }
  };
  const scoreResult = hikerScore(localConditions);
  const scoreLabel = hikerScoreLabel(scoreResult.score, lightningActive);
  const mainFactor = scoreResult.factors.slice().sort((a, b) => b.penalty - a.penalty)[0];
  const winterHeadline = localConditions.freezingPrecipitation
    ? "Wintry precipitation reported in the area. Watch for slick footing."
    : localConditions.refreezePossible
      ? "Freezing temperatures and recent moisture raise the risk of icy footing."
      : localConditions.snowFalling
        ? "Snow reported nearby. Watch for slick footing and reduced visibility."
        : localConditions.snowDepthIn >= 0.25
          ? `Modeled snow depth near Asheville is about ${round(localConditions.snowDepthIn, 1)} in. Depth varies along the trail.`
          : null;
  const coldHeadline = mainFactor?.label === "Cold exposure"
    ? `${asheville.length ? "Nearby trails" : "Reporting sites"} feel around ${format(localConditions.apparentTempF, "degF")}; ${localConditions.fogRisk === "Elevated"
      ? "dress for the cold and watch for damp footing."
      : "dress for the cold and check wind on exposed stretches."}`
    : null;
  const overall = lightningActive
    ? "Lightning nearby, avoid exposed terrain"
    : !scoreAvailable ? "Current trail assessment unavailable"
    : `${scoreLabel} for ${asheville.length ? "Asheville-area hikes" : "available regional observations"}${mainFactor ? `; watch ${mainFactor.label.toLowerCase()}` : ""}`;
  const bestWindow = lightningActive
    ? "Stay off exposed ridges, balds, summits, and open slopes until the lightning signal clears."
    : !scoreAvailable ? `A trail score needs current temperature, moisture, wind and precipitation coverage. Missing: ${missingScoreInputs.join(", ") || "temperature"}. Check current observations and mountain views.`
    : winterHeadline ?? coldHeadline ?? (localConditions.rainPenalty > 0
      ? "Rain is reported nearby; expect wet surfaces and potentially slippery roots and rocks. Check conditions along your route."
      : localConditions.recentRainIn >= 0.1
        ? "Recent rain raises the chance of muddy stretches and slippery roots and rocks; drainage varies by trail."
      : scoreResult.score < 70
      ? `${scoreLabel} conditions on nearby trails; plan around ${mainFactor?.label.toLowerCase() || "changing weather"}.`
    : localConditions.maxTemp >= 78 || localConditions.maxUv >= 5
      ? "Forest shade is the friendliest choice; open ridges and pavement will feel warmer."
      : localConditions.fogRisk === "Elevated"
        ? "Local air is nearly saturated; check the cameras for visibility and watch for damp footing."
        : "Most nearby trails look friendly, with normal mountain checks.");
  const hikerNarrative = lightningActive
    ? `Tempest lightning may be in the vicinity of your hike. ${nearestLightningStation ? `${nearestLightningStation.name} reported ${lightningDetails || "a recent lightning signal"}.` : "A nearby Tempest station reported a recent lightning signal."} Stay alert and avoid exposed ridges, balds, summits, and open slopes until the signal clears.`
    : "";
  const routeWarnings = snowDepth
    .filter(({ id, depthIn }) => id !== "asheville" && depthIn >= 0.25)
    .map(({ name, depthIn }) => `${name} has an estimated ${round(depthIn, 1)} in of snow on the ground (Open-Meteo model). Trail depth can vary.`);
  for (const station of usable.filter(({ id }) => !ASHEVILLE_STATION_IDS.has(id))) {
    const signal = winterObservation(station);
    if (signal === "possible refreeze") {
      routeWarnings.push(`${station.name} reports freezing temperatures with recent moisture; icy footing is possible in that area.`);
    } else if (signal) {
      routeWarnings.push(`${station.name} reports ${signal}; check footing and visibility in that area.`);
    }
  }
  if (maxGust >= 20) {
    const windy = usable.find((s) => (finite(s.gustMph) ?? finite(s.windMph)) === maxGust);
    routeWarnings.push(`${windy?.name || "A mountain station"} reports gusts near ${format(maxGust, " mph")}; check wind before hiking exposed ridges or summits.`);
  }
  if (fogRisk === "Elevated") {
    const damp = usable.find((s) => finite(s.dewPointF) != null && s.temperatureF - s.dewPointF === minDewSpread);
    routeWarnings.push(`${damp?.name || "A mountain station"} reports near-saturated air. This alone does not confirm fog; check a current view of that area.`);
  }
  if (maxUv >= 7) routeWarnings.push("Strong sun is reported in parts of the mountain network; use sun protection on open routes.");
  return {
    overall,
    bestWindow,
    hikerNarrative: lightningActive ? hikerNarrative : `${overall}. ${bestWindow} ${localTempSpread == null ? "Local temperature comparisons are unavailable." : `Nearby readings span about ${format(localTempSpread, "degF")}; shade, slope, and exposure can change the feel.`} ${mitchellDrop == null ? "Check high-peak temperatures separately." : `Mount Mitchell is about ${format(Math.abs(mitchellDrop), "degF")} ${mitchellDrop < 0 ? "warmer" : "cooler"} than the Asheville-area readings; pack a layer for high peaks.`} ${routeWarnings.join(" ")}`,
    scoreScope,
    calibrationVersion: HIKING_CALIBRATION.version,
    snowDepth,
    localConditions,
    routeWarnings,
    bullets: [
      lightningActive ? `Lightning alert: ${nearestLightningStation?.name || "Tempest"} reports nearby lightning. Stay off exposed terrain.` : `${overall}: ${bestWindow}`,
      localTempSpread == null ? "Local temperature spread unavailable." : `Asheville-area spread is about ${format(localTempSpread, "degF")}.`,
      highStationSpread != null && highStationSpread >= 4 ? "High Asheville readings show a microclimate split." : highs.length >= 2 ? "High Asheville readings broadly agree." : "Not enough high Asheville readings for a comparison.",
      mitchellDrop == null ? "Mount Mitchell comparison unavailable." : `Mount Mitchell is about ${format(Math.abs(mitchellDrop), "degF")} ${mitchellDrop < 0 ? "warmer" : "cooler"} than the Asheville-area readings.`,
      fogRisk === "Elevated" ? "Near-saturated air is reported at a mountain station; check cameras before assuming fog." : "Fog risk is not the lead concern.",
      maxGust >= 20 ? "Wind matters on exposed terrain." : "Wind is light at the reporting sites.",
      maxUv >= 5 || maxSolar >= 500 ? "Sun exposure matters on open routes." : "Sun exposure is manageable right now."
    ],
    hikerScore: scoreAvailable ? scoreResult.score : null,
    hikerScoreLabel: lightningActive ? "Alert" : scoreAvailable ? hikerScoreLabel(scoreResult.score, lightningActive) : "Unavailable",
    missingScoreInputs,
    hikerScoreFactors: scoreResult.factors,
    localTempSpread: round(localTempSpread, 1),
    highStationSpread: round(highStationSpread, 1),
    lapseRate: round(lapseRate, 1),
    mitchellDrop: round(mitchellDrop, 1),
    wncLapseRate: round(wncLapseRate, 1),
    fogRisk,
    maxUv,
    maxSolar: round(maxSolar),
    maxGust: round(maxGust, 1),
    maxTemp: round(maxTemp, 1),
    maxWbgt: round(maxWbgt, 1),
    maxRainRate: round(maxRainRate, 2),
    maxRainToday: round(maxRainToday, 2),
    lightning: {
      active: lightningActive,
      stationName: nearestLightningStation?.name ?? null,
      details: lightningDetails,
      lastDistanceMiles: nearestLightningStation?.lightningLastDistanceMiles ?? null,
      lastDistanceMsg: nearestLightningStation?.lightningLastDistanceMsg ?? null,
      lastObservedAt: nearestLightningStation?.lightningLastEpoch ?? null,
      strikeCount1h: lightningCounts1h,
      strikeCount3h: lightningCounts3h,
      summary: lightningActive
        ? `Tempest lightning may be in the vicinity of the hike. ${nearestLightningStation?.name ? `${nearestLightningStation.name} is the closest lightning signal.` : ""} Stay alert and avoid exposed ridges, balds, summits, and open slopes until the signal clears.`
        : "No nearby Tempest lightning signal is active right now."
    }
  };
}

function hikerScore(guidance) {
  const factors = [];
  let penalty = 0;
  const add = (amount, label) => {
    const value = round(amount, 1);
    if (value > 0) {
      penalty += value;
      factors.push({ label, penalty: value });
    }
  };
  if (guidance.lightning?.active) add(45, "Nearby lightning");
  const coldPenalty = guidance.apparentTempF == null ? 0 : clamp((50 - guidance.apparentTempF) * 2.2, 0, 45);
  const moisturePenalty = guidance.fogRisk === "Elevated" ? 8 : guidance.fogRisk === "Patchy pockets" ? 4 : 0;
  if (guidance.freezingPrecipitation) add(45, "Freezing precipitation");
  else if (guidance.refreezePossible) add(25, "Possible refreeze");
  if (guidance.snowFalling) add(18, "Falling or blowing snow");
  if (guidance.snowDepthIn >= 0.25) add(clamp(8 + guidance.snowDepthIn * 5, 0, 40), "Estimated snow cover");
  add(coldPenalty, "Cold exposure");
  add(moisturePenalty * (1 + clamp(coldPenalty / 22, 0, 1) * 0.5), "Fog or damp trail risk");
  add(Math.max(
    guidance.maxUv == null ? 0 : clamp((guidance.maxUv - 2) * 2, 0, 18),
    guidance.maxSolar == null ? 0 : clamp((guidance.maxSolar - 500) / 120, 0, 5)
  ), "Sun exposure");
  add(guidance.maxGust == null ? 0 : clamp((guidance.maxGust - 12) * 0.9, 0, 18), "Wind on exposed terrain");
  add(guidance.maxWbgt == null ? 0 : clamp((guidance.maxWbgt - 65) * 0.75, 0, 20), "Heat stress");
  add(guidance.maxTemp == null || guidance.maxWbgt != null ? 0 : clamp((guidance.maxTemp - 78) * 0.6, 0, 10), "Warm air temperature");
  add(guidance.rainPenalty ?? 0, "Active rain");
  // Editorial footing calibration, not a measurement of trail mud. Retain
  // recent-hour rainfall across midnight without treating it as active rain.
  add(HIKING_CALIBRATION.wetGroundMaxPenalty * (1 - Math.exp(-Math.max(0, guidance.recentRainIn ?? 0) / HIKING_CALIBRATION.wetGroundScaleIn)), "Wet ground");
  return { score: Math.round(clamp(92 - penalty, 0, 100)), factors };
}

function hikerScoreLabel(score, lightningActive) {
  if (lightningActive) return "Alert";
  if (score >= 84) return "Great";
  if (score >= 70) return "Good";
  if (score >= 55) return "Mixed";
  return "Use care";
}

function localFog(stations) {
  const spreads = stations.filter((s) => finite(s.dewPointF) != null)
    .map((s) => s.temperatureF - s.dewPointF);
  if (!spreads.length) return "Unknown";
  const minimum = Math.min(...spreads);
  return minimum <= 4 ? "Elevated" : minimum <= 8 ? "Patchy pockets" : "Low";
}

function observedRainPenalty(station) {
  const rate = Math.max(0, finite(station.rainRateInHr) ?? 0);
  const measured = rate > 0 ? Math.min(24, 6 + rate * 80) : 0;
  const description = station.weatherDescription ?? "";
  // Use present liquid precipitation reports when gauges are absent or rounded
  // to zero. Vicinity reports and wintry precipitation have separate handling.
  if (/freezing|snow|sleet|ice pellets|vicinity|nearby|chance/i.test(description)) return measured;
  if (!/\b(rain|drizzle|showers)\b/i.test(description)) return measured;
  const reported = /heavy/i.test(description) ? 24
    : /light|drizzle/i.test(description) ? 10 : 18;
  return Math.max(measured, reported);
}

function winterObservation(station) {
  const weather = station.weatherDescription ?? "";
  if (/\b(?:freezing (?:rain|drizzle)|ice pellets|sleet)\b/i.test(weather)) return "freezing precipitation";
  if (/\b(?:snow|flurries)\b/i.test(weather)) return "snow";
  if (finite(station.temperatureF) <= 32 && Math.max(
    finite(station.rainRateInHr) ?? 0,
    finite(station.rainTodayIn) ?? 0,
    finite(station.precipitationLastHourIn) ?? 0
  ) >= 0.01) return "possible refreeze";
  return null;
}

function apparentColdTemperature(station) {
  const tempF = finite(station.temperatureF);
  const windMph = finite(station.windMph);
  if (tempF > 50 || windMph == null || windMph <= 3) return tempF;

  const windFactor = windMph ** 0.16;
  const windChillF = 35.74 + 0.6215 * tempF - 35.75 * windFactor + 0.4275 * tempF * windFactor;
  return Math.min(tempF, windChillF);
}

function hasLightningSignal(station, now, thresholdMiles = 10) {
  const lastStrikeAt = Date.parse(station.lightningLastEpoch);
  return Boolean(
    (finite(station.lightningStrikes1h) ?? 0) > 0 ||
    (finite(station.lightningStrikes3h) ?? 0) > 0 ||
    (Number.isFinite(lastStrikeAt) && now - lastStrikeAt <= LIGHTNING_SIGNAL_MAX_AGE_MS && (finite(station.lightningLastDistanceMiles) ?? Infinity) <= thresholdMiles)
  );
}

function lightningDetail(station) {
  if (!station) return null;
  const parts = [];
  if ((finite(station.lightningStrikes1h) ?? 0) > 0) parts.push(`${station.lightningStrikes1h} strike${station.lightningStrikes1h === 1 ? "" : "s"} in the last hour`);
  if ((finite(station.lightningStrikes3h) ?? 0) > 0) parts.push(`${station.lightningStrikes3h} strike${station.lightningStrikes3h === 1 ? "" : "s"} in the last 3 hours`);
  if (station.lightningLastDistanceMsg) parts.push(`last strike ${station.lightningLastDistanceMsg}`);
  else if (finite(station.lightningLastDistanceMiles) != null) parts.push(`last strike about ${format(station.lightningLastDistanceMiles, " miles")} away`);
  return parts.join(" · ");
}

function spread(stations) {
  const values = stations.map((station) => finite(station.temperatureF)).filter(Number.isFinite);
  return values.length ? Math.max(...values) - Math.min(...values) : null;
}

function average(values) {
  return values.length ? values.reduce((total, value) => total + value, 0) / values.length : null;
}

function maximum(values) {
  const usable = values.filter(Number.isFinite);
  return usable.length ? Math.max(...usable) : null;
}

function sum(stations, key) {
  return stations.reduce((total, station) => total + (finite(station[key]) ?? 0), 0);
}

function uvFromSolar(solarWm2) {
  const value = finite(solarWm2);
  return value == null ? null : Math.max(0, Math.min(11, Math.round(value / 115)));
}

function finite(value) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function round(value, digits = 0) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function format(value, suffix = "") {
  return value == null ? "n/a" : `${Math.round(value)}${suffix}`;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
