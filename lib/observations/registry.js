const genericShelteredNote = "Likely rural residential with possible tree-canopy influence; exposure is unverified.";

export const OBSERVATION_STATIONS = Object.freeze([
  tempest("tempest-144737", "144737", "Lower Asheville", 2137, 35.60675829810566, -82.54793450070898, "Asheville city weather station", {
    destinationId: "asheville", terrainRole: "valley", comparisonMethod: "direct", weight: 1
  }),
  tempest("tempest-127602", "127602", "Mid Asheville", 2316, 35.6154509046802, -82.50548363971464, "north/east Asheville transition"),
  tempest("tempest-160562", "160562", "High Asheville East", 3363, 35.624525314972594, -82.51184579162579, "nearby ridge reading"),
  tempest("tempest-157700", "157700", "High Asheville North", 3371, 35.6422544091975, -82.49614863661522, "nearby ridge cross-check"),
  tempest("tempest-128340", "128340", "Waynesville / Haywood Valley", 2700, 35.530885, -82.976314, "Haywood County valley-floor anchor", {
    destinationId: "waynesville", terrainRole: "valley", comparisonMethod: "direct", weight: 1
  }),
  tempest("tempest-88141", "88141", "Black Mountain / Swannanoa Valley", 2661, 35.652627, -82.335953, "east Buncombe valley-floor anchor", {
    destinationId: "black-mountain", terrainRole: "valley", comparisonMethod: "direct", weight: 1
  }),
  tempest("tempest-104977", "104977", "Southern Haywood / Pisgah Approach West", 3284, 35.38981830381071, -82.89734143410911, "sheltered mid-elevation corridor reference", {
    destinationId: "graveyard", terrainRole: "sheltered-mid-elevation", comparisonMethod: "elevation-adjusted", weight: 0.35, sitingConfidence: "low", sitingNote: genericShelteredNote
  }),
  tempest("tempest-85173", "85173", "Southern Haywood / Pisgah Approach East", 3167, 35.42995347409254, -82.81730331330805, "sheltered mid-elevation corridor reference", {
    destinationId: "pisgah", terrainRole: "sheltered-mid-elevation", comparisonMethod: "elevation-adjusted", weight: 0.35, sitingConfidence: "low", sitingNote: genericShelteredNote
  }),
  tempest("tempest-100622", "100622", "Mount Mitchell East Slope / Alpine Village", 3264, 35.76593897663289, -82.21251661140285, "forested Black Mountains east-slope reference", {
    destinationId: "mitchell", terrainRole: "forested-east-slope", comparisonMethod: "elevation-adjusted", weight: 0.5, sitingConfidence: "medium-low",
    sitingNote: "Satellite context places the station in a forested mountainside resort development above the South Toe River; wind exposure is likely sheltered."
  }),
  tempest("tempest-186088", "186088", "Western Pisgah High Shoulder", 3989, 35.43601327578987, -82.98075900387035, "western Haywood high-shoulder reference", {
    destinationId: "graveyard", terrainRole: "western-pisgah-high-shoulder", comparisonMethod: "elevation-adjusted", weight: 0.6, sitingConfidence: "low",
    sitingNote: "High-shoulder location is useful for the western Pisgah temperature profile, but its immediate exposure and canopy influence are unverified."
  }),
  wunderground("max-patch", "KTNDELRI5", "Max Patch", 4420, 35.795132, -82.965416, "high-elevation bald reading"),
  wunderground("barnardsville-craggy-north-flank", "KNCBARNA15", "Barnardsville / Craggy North Flank", 3052, 35.748121736670676, -82.45519548077138, "Craggy north-flank moisture and temperature reference", {
    destinationId: "craggy", terrainRole: "craggy-north-flank", comparisonMethod: "elevation-adjusted", weight: 0.4, sitingConfidence: "low",
    sitingNote: "Barnardsville-side temperature and moisture reference below Craggy; exposure is unverified and wind is not treated as representative of the ridge."
  }),
  wunderground("burnsville-northern-high-country", "KNCBURNS99", "Burnsville Northern High Country", 5330, 35.822, -82.367, "northern high-country temperature and moisture anchor", {
    destinationId: "mitchell", terrainRole: "northern-high-country", comparisonMethod: "elevation-adjusted", weight: 0.75, sitingConfidence: "medium-low",
    sitingNote: "Reported 5,330-foot northern high-country site between Craggy and Mount Mitchell; exact sensor exposure remains unverified."
  }),
  wunderground("laurel-ridge-craggy-south-flank", "KNCBLACK183", "Laurel Ridge / Craggy South Flank", 3501, 35.66, -82.367, "Craggy south-flank temperature and moisture reference", {
    destinationId: "craggy", terrainRole: "craggy-south-flank", comparisonMethod: "elevation-adjusted", weight: 0.5, sitingConfidence: "medium-low",
    sitingNote: "Close Craggy south-flank reference at Laurel Ridge; useful for slope-to-slope temperature and moisture comparisons, not summit wind."
  }),
  wunderground("mountain-air-runway-14", "KNCBURNS29", "Mountain Air Runway 14", 4409, 35.870861, -82.344101, "mountaintop runway sensor", null, { componentOnly: true }),
  wunderground("mountain-air-runway-32", "KNCBURNS30", "Mountain Air Runway 32", 4341, 35.866127, -82.339851, "mountaintop runway sensor", null, { componentOnly: true }),
  Object.freeze({
    id: "mountain-air-ridge-composite", provider: "composite", providerStationId: "KNCBURNS29+KNCBURNS30", componentIds: ["mountain-air-runway-14", "mountain-air-runway-32"],
    name: "Mountain Air Ridge Composite", elevationFt: 4375, latitude: 35.868494, longitude: -82.341976, role: "regional exposed high-country cross-check",
    url: "https://www.wunderground.com/dashboard/pws/KNCBURNS29", maxAgeMinutes: 45,
    fall: Object.freeze({ destinationId: "mitchell", terrainRole: "regional-exposed-ridge", comparisonMethod: "elevation-adjusted", weight: 0.7, sitingConfidence: "medium", sitingNote: "Composite of two mountaintop runway stations; counted once to avoid treating colocated sensors as independent evidence." })
  }),
  econet("frying-pan-pisgah-ridgeline", "FRYI", "Frying Pan / Pisgah Ridgeline", 5000, 35.39357, -82.77427, "Pisgah ridgeline reading", {
    destinationId: "pisgah", terrainRole: "ridge", comparisonMethod: "direct", weight: 1
  }),
  econet("mount-mitchell", "MITC", "Mount Mitchell", 6215, 35.75853, -82.27135, "WNC high-peak reading", {
    destinationId: "mitchell", terrainRole: "ridge", comparisonMethod: "direct", weight: 1
  })
]);

export const STATION_BY_ID = new Map(OBSERVATION_STATIONS.map((station) => [station.id, station]));
export const FALL_ANCHOR_STATIONS = Object.freeze(OBSERVATION_STATIONS.filter((station) => station.fall));
export const SOURCE_STATIONS = Object.freeze(OBSERVATION_STATIONS.filter((station) => station.provider !== "composite"));

export function stationsForProvider(provider) {
  return SOURCE_STATIONS.filter((station) => station.provider === provider);
}

function tempest(id, providerStationId, name, elevationFt, latitude, longitude, role, fall = null, extra = {}) {
  return Object.freeze({ id, provider: "tempest", providerStationId, name, elevationFt, latitude, longitude, role, url: `https://tempestwx.com/station/${providerStationId}/grid`, maxAgeMinutes: 45, fall: freezeFall(fall), ...extra });
}

function wunderground(id, providerStationId, name, elevationFt, latitude, longitude, role, fall = null, extra = {}) {
  return Object.freeze({ id, provider: "wunderground", providerStationId, name, elevationFt, latitude, longitude, role, url: `https://www.wunderground.com/dashboard/pws/${providerStationId}`, maxAgeMinutes: 45, fall: freezeFall(fall), ...extra });
}

function econet(id, providerStationId, name, elevationFt, latitude, longitude, role, fall = null) {
  return Object.freeze({ id, provider: "econet", providerStationId, name, elevationFt, latitude, longitude, role, url: `https://econet.climate.ncsu.edu/m/?id=${providerStationId}`, maxAgeMinutes: 90, fall: freezeFall(fall) });
}

function freezeFall(value) {
  return value ? Object.freeze(value) : null;
}
