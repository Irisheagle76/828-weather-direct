const genericShelteredNote = "Likely rural residential with possible tree-canopy influence; exposure is unverified.";

export const OBSERVATION_STATIONS = Object.freeze([
tempest("tempest-237451", "237451", "Biltmore Village", 1998, 35.56721, -82.54092, "Asheville valley reference"),
Object.freeze({id:"nws-kavl",provider:"nws",providerStationId:"KAVL",name:"Asheville Regional Airport",elevationFt:2165,latitude:35.43194,longitude:-82.5375,role:"Southern metro reference; not summit wind",url:"https://www.weather.gov/wrh/timeseries?site=KAVL",maxAgeMinutes:120}),
econet("econet-unca", "UNCA", "UNC Asheville", 2367, 35.62233, -82.56646, "North Asheville reference"),
econet("econet-flet", "FLET", "Mills River", 2067, 35.42721, -82.55888, "Southern valley reference"),
econet("econet-wayn", "WAYN", "Waynesville Research Station", 2755, 35.48752, -82.96768, "Western valley reference"),
econet("econet-burn", "BURN", "Burnsville Tower", 2689, 35.91904, -82.26049, "Northeastern valley reference"),
econet("econet-bear", "BEAR", "Bearwallow Mountain", 4219, 35.46135, -82.35822, "Southeastern ridge reference"),
  tempest("tempest-144737", "144737", "North Downtown", 2137, 35.606299, -82.547881, "supplemental downtown Asheville observation from Weather station on Clyde Street", {
    destinationId: "asheville", terrainRole: "valley", comparisonMethod: "direct", weight: 1
  }),
  tempest("tempest-127602", "127602", "Mid Asheville", 2316, 35.6154509046802, -82.50548363971464, "north/east Asheville transition"),
  wunderground("windy-ridge-trail", "KNCASHEV440", "Windy Ridge Trail", 3209, 35.666, -82.497, "northern Asheville ridge reference"),
  wunderground("webb-weather", "KNCASHEV482", "Webb Weather", 3000, 35.652, -82.495, "north Asheville temperature and moisture reference"),
  wunderground("beaucatcher-mountain", "KNCASHEV288", "BeaucatcherWx", 2550, 35.589, -82.540, "Beaucatcher Mountain reference above central Asheville"),
  wunderground("spivey-mountain", "KNCASHEV307", "Spivey Mountain", 3110, 35.601, -82.652, "western Asheville ridge reference"),
  wunderground("lake-junaluska", "KNCLAKEJ3", "Lake Junaluska", 2657, 35.532, -82.972, "Haywood County valley-floor anchor", {
    destinationId: "waynesville", terrainRole: "valley", comparisonMethod: "direct", weight: 1
  }),
  wunderground("wallace-mountain", "KNCBLACK209", "Wallace Mountain", 2625, 35.652, -82.341, "Black Mountain / Swannanoa Valley reference", {
    destinationId: "black-mountain", terrainRole: "valley", comparisonMethod: "direct", weight: 1
  }),
  wunderground("camp-daniel-boone", "KNCCANTO127", "Camp Daniel Boone", 3257, 35.392, -82.898, "western Pisgah approach temperature and moisture reference", {
    destinationId: "graveyard", terrainRole: "sheltered-mid-elevation", comparisonMethod: "elevation-adjusted", weight: 0.35, sitingConfidence: "low", sitingNote: genericShelteredNote
  }),
  wunderground("cold-mountain-station", "KNCCANTO128", "Cold Mountain Station", 3445, 35.428, -82.820, "eastern Pisgah approach temperature and moisture reference", {
    destinationId: "pisgah", terrainRole: "sheltered-mid-elevation", comparisonMethod: "elevation-adjusted", weight: 0.35, sitingConfidence: "low", sitingNote: genericShelteredNote
  }),
  wunderground("alpine-village", "KNCBURNS167", "Alpine Village", 3260, 35.766, -82.213, "forested Black Mountains east-slope reference", {
    destinationId: "mitchell", terrainRole: "forested-east-slope", comparisonMethod: "elevation-adjusted", weight: 0.5, sitingConfidence: "medium-low",
    sitingNote: "Satellite context places the station in a forested mountainside resort development above the South Toe River; wind exposure is likely sheltered."
  }),
  wunderground("park-place", "KNCWAYNE323", "Park Place", 4209, 35.458, -82.965, "western Haywood high-shoulder reference", {
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
  econet("frying-pan-pisgah-ridgeline", "FRYI", "Frying Pan / Pisgah Ridgeline", 5320, 35.39357, -82.77427, "Pisgah ridgeline reading", {
    destinationId: "pisgah", terrainRole: "ridge", comparisonMethod: "direct", weight: 1
  }),
  econet("mount-mitchell", "MITC", "Mount Mitchell", 6215, 35.75853, -82.27135, "WNC high-peak reading", {
    destinationId: "mitchell", terrainRole: "ridge", comparisonMethod: "direct", weight: 1
  })
].map(station => ["wunderground", "composite"].includes(station.provider) ? Object.freeze({...station, enabled:false}) : station));

export const STATION_BY_ID = new Map(OBSERVATION_STATIONS.map((station) => [station.id, station]));
export const FALL_ANCHOR_STATIONS = Object.freeze(OBSERVATION_STATIONS.filter((station) => station.fall));
export const SOURCE_STATIONS = Object.freeze(OBSERVATION_STATIONS.filter((station) => station.provider !== "composite" && station.enabled !== false));

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
