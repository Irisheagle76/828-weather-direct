// Approximate solar elevation, sufficient to exclude night/IR images from the
// daylight pixel classifier. Coordinates default to central Asheville.
export function solarElevation(now, latitude = 35.5951, longitude = -82.5515) {
  const date = new Date(now), yearStart = Date.UTC(date.getUTCFullYear(), 0, 1);
  const day = Math.floor((now - yearStart) / 86400000) + 1;
  const minutes = date.getUTCHours() * 60 + date.getUTCMinutes();
  const gamma = 2 * Math.PI / 365 * (day - 1 + (minutes / 60 - 12) / 24);
  const equation = 229.18 * (0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma) - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma));
  const declination = 0.006918 - 0.399912 * Math.cos(gamma) + 0.070257 * Math.sin(gamma) - 0.006758 * Math.cos(2 * gamma) + 0.000907 * Math.sin(2 * gamma) - 0.002697 * Math.cos(3 * gamma) + 0.00148 * Math.sin(3 * gamma);
  const radians = Math.PI / 180, hourAngle = (minutes + equation + 4 * longitude) / 4 - 180;
  return Math.asin(Math.sin(latitude * radians) * Math.sin(declination) + Math.cos(latitude * radians) * Math.cos(declination) * Math.cos(hourAngle * radians)) / radians;
}
