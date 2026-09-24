import { CATEGORY_COLORS, buildCategoryLookup, sampleContour, smoothContourOpacity } from "/js/feelscore-map-field.js";
export const LABELS = { 0: "Unshaded", 1: "just alright 🫤", 2: "Fine, I guess 🤷🏻‍♀️", 3: "Nice! 👍", 4: "B.E.A. utiful 😎", 5: "Goldilocks 🏆" };
const cities = [["Asheville", -82.5515, 35.5951], ["Knoxville", -83.92, 35.96], ["Greenville", -82.4, 34.85], ["Boone", -81.67, 36.22], ["Clayton", -83.4, 34.88], ["Chattanooga", -85.0, 35.05]];
// Anchors inside each visible state, not the state's out-of-frame centroid.
export const STATE_LABELS = [["TN", -84.35, 36.25], ["NC", -81.7, 35.7], ["SC", -81.75, 34.35], ["GA", -84.0, 34.2]];
export function drawRegionalMap(canvas, data) {
  const size = 360; canvas.width = size * 2; canvas.height = size * 2;
  const ctx = canvas.getContext("2d"); ctx.scale(2, 2);
  const b = data.focus;
  const project = (lon, lat) => [(lon - b.west) / (b.east - b.west) * size, (b.north - lat) / (b.north - b.south) * size];
  const trace = () => {
    ctx.beginPath();
    for (const feature of data.boundaries.features) {
      const polygons = feature.geometry.type === "Polygon" ? [feature.geometry.coordinates] : feature.geometry.coordinates;
      for (const polygon of polygons) for (const ring of polygon) { ring.forEach(([lon, lat], i) => { const [x, y] = project(lon, lat); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.closePath(); }
    }
  };
  ctx.fillStyle = "#10243a"; ctx.fillRect(0, 0, size, size);
  const layer = document.createElement("canvas"); layer.width = 180; layer.height = 180;
  const lc = layer.getContext("2d"), image = lc.createImageData(180, 180), lookup = buildCategoryLookup(data.points);
  for (let y = 0; y < 180; y++) for (let x = 0; x < 180; x++) {
    const field = sampleContour(b.west + x / 180 * (b.east - b.west), b.north - y / 180 * (b.north - b.south), lookup, data.spacingDegrees, data.bbox);
    if (!field) continue;
    const offset = (y * 180 + x) * 4;
    for (let c = 0; c < 3; c++) image.data[offset + c] = Object.entries(CATEGORY_COLORS).reduce((sum, [category, color]) => sum + color[c] * field.mix[category], 0);
    image.data[offset + 3] = Math.round(232 * smoothContourOpacity(field.strength));
  }
  lc.putImageData(image, 0, 0); ctx.save(); trace(); ctx.clip("evenodd"); ctx.drawImage(layer, 0, 0, size, size); ctx.restore();
  trace(); ctx.strokeStyle = "#e1ebf5"; ctx.lineWidth = 1; ctx.stroke();
  ctx.font = "bold 11px system-ui"; ctx.lineWidth = 3; ctx.strokeStyle = "#071a38"; ctx.fillStyle = "white";
  for (const [name, lon, lat] of cities) {
    if (lon < b.west || lon > b.east || lat < b.south || lat > b.north) continue;
    const [x, y] = project(lon, lat); ctx.beginPath(); ctx.arc(x, y, name === "Asheville" ? 4 : 2, 0, Math.PI * 2); ctx.fill();
    ctx.textAlign = x > 290 ? "right" : "left";
    const labelX = x > 290 ? x - 6 : x + 6; ctx.strokeText(name, labelX, y - 5); ctx.fillText(name, labelX, y - 5);
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const [name, lon, lat] of STATE_LABELS) { const [x, y] = project(lon, lat); ctx.font = "bold 17px system-ui"; ctx.strokeText(name, x, y); ctx.fillText(name, x, y); }
  canvas.hidden = false;
}
