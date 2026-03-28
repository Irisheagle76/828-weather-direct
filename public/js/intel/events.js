// /intel/events.js
// Sky-aware event detection for Human-Action 2.1

export function computeEvents(stats, sky) {
  if (!stats) {
    return emptyEvents();
  }

  const {
    windGustMax,
    rainTotal,
    snowTotal,
    cloudAvgSky,
    uvMaxSky,
    solarMax,
    visibilityMin,
    fogPotentialAvg
  } = stats;

  // ------------------------------------------------------------
  // 1. PM Commute Risk (3–7 PM local)
  // ------------------------------------------------------------
  // This is now handled upstream in forecast-intel using hourly data.
  // Here we only accept the boolean passed in if needed.
  // For now, we compute a sky-aware version:
  const pmCommuteRisk =
    rainTotal > 0.1 ||
    snowTotal > 0.1 ||
    windGustMax > 25 ||
    visibilityMin < 2;

  // ------------------------------------------------------------
  // 2. Weather Notables
  // ------------------------------------------------------------
  const windNotable = windGustMax > 30;
  const precipNotable = rainTotal > 0.25;
  const snowNotable = snowTotal > 0.25;

  // ------------------------------------------------------------
  // 3. Sky Notables
  // ------------------------------------------------------------
  const cloudNotable = cloudAvgSky != null ? cloudAvgSky > 80 : false;
  const uvRisk = uvMaxSky != null ? uvMaxSky >= 6 : false;
  const lowVisibility = visibilityMin != null ? visibilityMin < 1 : false;
  const fogRisk = fogPotentialAvg != null ? fogPotentialAvg > 0.4 : false;

  // ------------------------------------------------------------
  // 4. Sky Behavior Events
  // ------------------------------------------------------------
  const sunnyBreak =
    cloudAvgSky != null &&
    cloudAvgSky < 40 &&
    solarMax != null &&
    solarMax > 150;

  const cloudyAfternoon =
    cloudAvgSky != null &&
    cloudAvgSky > 70 &&
    solarMax < 200;

  const filteredSun =
    solarMax != null &&
    solarMax > 200 &&
    cloudAvgSky != null &&
    cloudAvgSky > 50 &&
    cloudAvgSky < 80;

  const hazyMorning =
    sky?.visibilityCategory === "haze" ||
    (visibilityMin != null && visibilityMin < 5 && visibilityMin > 2);

  return {
    pmCommuteRisk,
    windNotable,
    precipNotable,
    snowNotable,
    cloudNotable,

    // Sky-aware
    uvRisk,
    lowVisibility,
    fogRisk,
    sunnyBreak,
    cloudyAfternoon,
    filteredSun,
    hazyMorning
  };
}

function emptyEvents() {
  return {
    pmCommuteRisk: false,
    windNotable: false,
    precipNotable: false,
    snowNotable: false,
    cloudNotable: false,
    uvRisk: false,
    lowVisibility: false,
    fogRisk: false,
    sunnyBreak: false,
    cloudyAfternoon: false,
    filteredSun: false,
    hazyMorning: false
  };
}