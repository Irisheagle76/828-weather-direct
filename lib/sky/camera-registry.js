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
    snapshotUrl: "https://raw.githubusercontent.com/Irisheagle76/828-weather-direct/main/public/js/sky-cam/frame.jpg",
    enabled: false,
    orientation: { center: "east" },
    skyCrop: 0.35,
    capabilities: ["sky_cover", "cloud_texture", "directional_conditions"]
  }
];
