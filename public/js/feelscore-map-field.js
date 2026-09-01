function gridKey(lat, lon) {
  return `${lat.toFixed(2)},${lon.toFixed(2)}`;
}

export function buildCategoryLookup(points) {
  return new Map(points.map((point) => [gridKey(point.lat, point.lon), point.finalCategory]));
}

export function sampleCategory(lon, lat, lookup, spacing, bbox) {
  const lon0 = Math.floor((lon - bbox.west) / spacing) * spacing + bbox.west;
  const lat0 = Math.floor((lat - bbox.south) / spacing) * spacing + bbox.south;
  const tx = (lon - lon0) / spacing;
  const ty = (lat - lat0) / spacing;
  const corners = [
    [lat0, lon0, (1 - tx) * (1 - ty)],
    [lat0, lon0 + spacing, tx * (1 - ty)],
    [lat0 + spacing, lon0, (1 - tx) * ty],
    [lat0 + spacing, lon0 + spacing, tx * ty],
  ];
  const weightsByCategory = new Map();

  for (const [cornerLat, cornerLon, weight] of corners) {
    if (weight <= 0) continue;
    const category = lookup.get(gridKey(cornerLat, cornerLon));
    if (!Number.isInteger(category) || category < 0 || category > 5) continue;
    weightsByCategory.set(category, (weightsByCategory.get(category) || 0) + weight);
  }

  let selected = null;
  let selectedWeight = -1;
  for (const [category, weight] of weightsByCategory) {
    if (weight > selectedWeight || (weight === selectedWeight && category < selected)) {
      selected = category;
      selectedWeight = weight;
    }
  }
  return selectedWeight >= 0.48 ? selected : null;
}
