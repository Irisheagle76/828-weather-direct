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
    name: "North Asheville",
    snapshotUrl: "https://s28.ipcamlive.com/streams/1c4foxnfdylcpihc7/snapshot.jpg?_=0",
    enabled: true,
    orientation: { left: "east", center: "south", right: "west" },
    skyCrop: 0.62,
    capabilities: ["sky_cover", "cloud_texture", "cloud_type", "sky_color", "directional_conditions", "ridge_visibility", "valley_visibility", "possible_undercast"]
  },
  {
    id: "east-asheville-east",
    name: "East Asheville",
    snapshotUrl: "https://i.ytimg.com/vi/QWfo671Na08/maxresdefault_live.jpg",
    enabled: false,
    orientation: { center: "east" },
    skyCrop: 0.35,
    capabilities: ["sky_cover", "cloud_texture", "directional_conditions"]
  }
];
