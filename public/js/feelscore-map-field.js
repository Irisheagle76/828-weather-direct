export const CATEGORY_COLORS = {
  1: [240, 138, 75],
  2: [242, 201, 76],
  3: [168, 214, 94],
  4: [73, 198, 139],
  5: [70, 211, 202],
};

function gridKey(lat, lon) {
  return `${lat.toFixed(2)},${lon.toFixed(2)}`;
}

export function buildCategoryLookup(points) {
  return new Map(points.map((point) => [gridKey(point.lat, point.lon), point.finalCategory]));
}

export function sampleContour(lon, lat, lookup, spacing, bbox) {
  const centerX = Math.round((lon - bbox.west) / spacing);
  const centerY = Math.round((lat - bbox.south) / spacing);
  const categoryWeights = [0, 0, 0, 0, 0, 0];
  const radius = 3;
  const sigma = 0.65;

  for (let yOffset = -radius; yOffset <= radius; yOffset += 1) {
    for (let xOffset = -radius; xOffset <= radius; xOffset += 1) {
      const gridLon = bbox.west + (centerX + xOffset) * spacing;
      const gridLat = bbox.south + (centerY + yOffset) * spacing;
      const category = lookup.get(gridKey(gridLat, gridLon));
      if (!Number.isInteger(category) || category < 1 || category > 5) continue;

      const xDistance = (lon - gridLon) / spacing;
      const yDistance = (lat - gridLat) / spacing;
      const distanceSquared = xDistance ** 2 + yDistance ** 2;
      if (distanceSquared > radius ** 2) continue;
      const weight = Math.exp(-distanceSquared / (2 * sigma ** 2));
      categoryWeights[category] += weight;
    }
  }

  const totalWeight = categoryWeights.reduce((sum, weight) => sum + weight, 0);
  if (totalWeight < 0.025) return null;

  return {
    strength: Math.min(1, totalWeight),
    mix: categoryWeights.map((weight) => weight / totalWeight),
  };
}

export function smoothContourOpacity(strength) {
  const normalized = Math.max(0, Math.min(1, (strength - 0.04) / 0.28));
  return normalized * normalized * (3 - 2 * normalized);
}
