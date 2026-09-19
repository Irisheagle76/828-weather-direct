function pointInRing(lon, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const crosses = (yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

function pointInPolygon(lon, lat, polygon) {
  if (!pointInRing(lon, lat, polygon[0])) return false;
  return !polygon.slice(1).some((hole) => pointInRing(lon, lat, hole));
}

export function pointInGeometry(lon, lat, geometry) {
  if (!geometry) return false;
  if (geometry.type === 'Polygon') return pointInPolygon(lon, lat, geometry.coordinates);
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.some((polygon) => pointInPolygon(lon, lat, polygon));
  return false;
}

export function featureContainsPoint(feature, lon, lat) {
  return pointInGeometry(lon, lat, feature.geometry);
}

export function gridPointsOnLand({ bbox, spacing, features }) {
  const points = [];
  const round = (value) => Math.round(value * 100) / 100;
  for (let lat = bbox.south; lat <= bbox.north + 1e-9; lat += spacing) {
    for (let lon = bbox.west; lon <= bbox.east + 1e-9; lon += spacing) {
      const pointLat = round(lat);
      const pointLon = round(lon);
      const state = features.find((feature) => featureContainsPoint(feature, pointLon, pointLat));
      if (state) points.push({ lat: pointLat, lon: pointLon, state: state.properties.STUSPS || state.properties.STUSAB || state.properties.NAME });
    }
  }
  return points;
}
