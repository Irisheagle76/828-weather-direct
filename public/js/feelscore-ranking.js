export function rankCities(cities = [], limit = 10) {
  const seen = new Set();
  return cities.filter((city) => {
    if (!city.name || seen.has(city.name) || !Number.isInteger(city.finalCategory)
      || city.finalCategory < 0 || city.finalCategory > 5) return false;
    seen.add(city.name);
    return true;
  }).sort((a, b) => b.finalCategory - a.finalCategory || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map((city, index, sorted) => ({
      ...city,
      rank: sorted.findIndex((entry) => entry.finalCategory === city.finalCategory) + 1,
    }));
}
