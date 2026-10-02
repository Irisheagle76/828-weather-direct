const capturedBase = "https://raw.githubusercontent.com/Irisheagle76/828-weather-direct/main/public/sky-camera-observations";
export const CAMERA_REGISTRY = [
  {
    id: "downtown-asheville-west",
    name: "Downtown Asheville",
    snapshotUrl: "https://i.ytimg.com/vi/UxUU3Fc1vBw/maxresdefault_live.jpg",
    enabled: true,
    orientation: { center: "west" },
    skyCrop: 0.2,
    capabilities: ["sky_cover", "cloud_texture", "sun_visibility", "western_horizon"]
  },
  {
    id: "north-asheville-south",
    name: "North Asheville toward downtown · SSE",
    displayAllowed: false,
    snapshotUrl: "https://s28.ipcamlive.com/streams/1ceufgi3xpyusiox5/snapshot.jpg?_=0",
    enabled: true,
    // Analysis only. Side bearings and horizon geometry are not calibrated.
    orientation: { center: "south-southeast" },
    skyCrop: 0.2,
    capabilities: ["sky_cover", "cloud_texture", "sky_color"]
  },
  {
    id: "east-asheville-east",
    name: "East Asheville",
    snapshotUrl: `${capturedBase}/east-asheville-east.jpg`,
    manifestUrl: `${capturedBase}/east-asheville-east.json`,
    enabled: true,
    orientation: { center: "east-northeast" },
    skyTop: 0.05, skyCrop: 0.25,
    capabilities: ["sky_cover", "cloud_texture", "directional_conditions"]
  },
  {
    id: "unca-south", name: "UNC Asheville toward downtown",
    // Use the original asset: a new Cloudinary transformation has a new
    // Last-Modified time even when the underlying camera image is old.
    snapshotUrl: "https://res.cloudinary.com/dz45rrije/image/upload/avlweather_towercam_latest.jpg",
    enabled: true, orientation: { center: "south" }, skyCrop: 0.25,
    location: { latitude: 35.62180, longitude: -82.56606, elevationFeet: 2357 },
    capabilities: ["sky_cover", "cloud_texture"]
  },
  {
    id: "chamber-southwest", name: "Chamber toward Mt. Pisgah",
    snapshotUrl: `${capturedBase}/chamber-southwest.jpg`,
    manifestUrl: `${capturedBase}/chamber-southwest.json`,
    enabled: true, orientation: { center: "southwest" }, skyCrop: 0.2,
    capabilities: ["sky_cover", "cloud_texture"]
  },
  {
    id: "fairview-north", name: "Fairview toward Swannanoa",
    snapshotUrl: "https://images.ambientweather.net/308398A68945/latest.jpg",
    stationUrl: "https://www.wunderground.com/dashboard/pws/KNCFAIRV101",
    enabled: true, scope: "regional", orientation: { center: "north" },
    // Top timestamp and the ridge/foreground are outside this sky sample.
    skyTop: 0.05, skyCrop: 0.4,
    location: { latitude: 35.51220208502947, longitude: -82.39874320739332, elevationFeet: 2435 },
    capabilities: ["sky_cover", "cloud_texture", "directional_conditions"]
  }
];
