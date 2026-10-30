// Show a readable selection while keeping every source available in the station list.
export const MAX_PROFILE_STATIONS = 10;
const preferredIds = ["nws-kavl", "econet-unca", "econet-flet", "econet-wayn", "econet-burn", "econet-bear", "tempest-144737", "tempest-127602", "frying-pan-pisgah-ridgeline", "mount-mitchell"];

export function selectHikingProfileStations(stations = []) {
  const usable = stations.filter((station) => station.health?.usable !== false &&
    Number.isFinite(station.temperatureF) && Number.isFinite(station.elevationFt));
  const byId = new Map(usable.map((station) => [station.id, station]));
  const selected = preferredIds.map((id) => byId.get(id)).filter(Boolean);
  // Fill missing references with the most distinct remaining elevations.
  const remaining = usable.filter((station) => !selected.includes(station));
  while (selected.length < MAX_PROFILE_STATIONS && remaining.length) {
    remaining.sort((a, b) => elevationGap(b, selected) - elevationGap(a, selected) || a.id.localeCompare(b.id));
    selected.push(remaining.shift());
  }
  return selected.sort((a, b) => a.elevationFt - b.elevationFt || a.id.localeCompare(b.id));
}

function elevationGap(station, selected) {
  return selected.length ? Math.min(...selected.map((site) => Math.abs(site.elevationFt - station.elevationFt))) : 0;
}
