import { CATEGORY_COLORS, buildCategoryLookup, sampleContour, smoothContourOpacity } from './feelscore-map-field.js';

const canvas = document.querySelector('#feelscore-map');
const stage = document.querySelector('#map-stage');
const inspector = document.querySelector('#map-inspector');
const status = document.querySelector('#data-status');
const empty = document.querySelector('#map-empty');
const dayLabel = document.querySelector('#forecast-day');
const debugToggle = document.querySelector('#debug-toggle');
const qaPanel = document.querySelector('#qa-panel');

const COLORS = CATEGORY_COLORS;
const CATEGORY_LABELS = {
  0: 'Unshaded', 1: 'just alright 🫤', 2: 'Fine, I guess 🤷🏻‍♀️',
  3: 'Nice! 👍', 4: 'B.E.A. utiful 😎', 5: 'Goldilocks 🏆',
};

let dataset;
let boundaries;
let selectedPoint;
let debug = new URLSearchParams(location.search).get('debug') === '1';
let renderFrame;

for (const [category, color] of Object.entries(COLORS)) {
  const cssColor = `rgb(${color.join(', ')})`;
  document.documentElement.style.setProperty(`--fs-category-${category}`, cssColor);
  document.querySelector(`.legend [data-category="${category}"]`)?.style.setProperty('--swatch', cssColor);
}

function formatDate(dateText) {
  const date = new Date(`${dateText}T12:00:00Z`);
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(date);
}

function projection(width, height) {
  const { bbox } = dataset;
  const padding = width < 680 ? 10 : 24;
  return {
    point(lon, lat) {
      return [
        padding + ((lon - bbox.west) / (bbox.east - bbox.west)) * (width - padding * 2),
        padding + ((bbox.north - lat) / (bbox.north - bbox.south)) * (height - padding * 2),
      ];
    },
    inverse(x, y) {
      return [
        bbox.west + ((x - padding) / (width - padding * 2)) * (bbox.east - bbox.west),
        bbox.north - ((y - padding) / (height - padding * 2)) * (bbox.north - bbox.south),
      ];
    },
  };
}

function traceRing(context, ring, project) {
  ring.forEach(([lon, lat], index) => {
    const [x, y] = project(lon, lat);
    if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
  });
  context.closePath();
}

function traceGeometry(context, geometry, project) {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  for (const polygon of polygons) for (const ring of polygon) traceRing(context, ring, project);
}

function fieldLookup() {
  return buildCategoryLookup(dataset.points);
}

function contourLayer(width, height) {
  const scale = Math.min(1, 760 / width);
  const layer = document.createElement('canvas');
  layer.width = Math.max(280, Math.round(width * scale));
  layer.height = Math.max(220, Math.round(height * scale));
  const context = layer.getContext('2d');
  const pixels = context.createImageData(layer.width, layer.height);
  const lookup = fieldLookup();
  const layerProjection = projection(layer.width, layer.height);
  for (let y = 0; y < layer.height; y += 1) {
    for (let x = 0; x < layer.width; x += 1) {
      const [lon, lat] = layerProjection.inverse(x, y);
      const field = sampleContour(lon, lat, lookup, dataset.spacingDegrees, dataset.bbox);
      if (!field) continue;
      const color = [0, 1, 2].map((channel) => Math.round(
        Object.entries(COLORS).reduce((sum, [category, rgb]) => sum + rgb[channel] * field.mix[category], 0),
      ));
      const offset = (y * layer.width + x) * 4;
      pixels.data[offset] = color[0]; pixels.data[offset + 1] = color[1]; pixels.data[offset + 2] = color[2];
      pixels.data[offset + 3] = Math.round(232 * smoothContourOpacity(field.strength));
    }
  }
  context.putImageData(pixels, 0, 0);
  context.globalCompositeOperation = 'destination-in';
  context.beginPath();
  for (const feature of boundaries.features) traceGeometry(context, feature.geometry, layerProjection.point);
  context.fillStyle = '#000'; context.fill('evenodd');
  context.globalCompositeOperation = 'source-over';
  return layer;
}

function drawMap() {
  if (!dataset || !boundaries) return;
  const rect = stage.getBoundingClientRect();
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(rect.width * ratio); canvas.height = Math.round(rect.height * ratio);
  const context = canvas.getContext('2d');
  context.scale(ratio, ratio);
  const width = rect.width; const height = rect.height; const project = projection(width, height);

  const water = context.createLinearGradient(0, 0, 0, height);
  water.addColorStop(0, '#0e2032'); water.addColorStop(1, '#091522');
  context.fillStyle = water; context.fillRect(0, 0, width, height);
  context.beginPath();
  for (const feature of boundaries.features) traceGeometry(context, feature.geometry, project.point);
  context.fillStyle = '#182a3b'; context.fill('evenodd');

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(contourLayer(width, height), 0, 0, width, height);
  context.beginPath();
  for (const feature of boundaries.features) traceGeometry(context, feature.geometry, project.point);
  context.strokeStyle = 'rgba(235, 243, 250, 0.58)'; context.lineWidth = 0.8; context.stroke();

  const labelNames = ['Louisville, KY', 'Nashville, TN', 'Asheville, NC', 'Charlotte, NC', 'Atlanta, GA', 'Birmingham, AL', 'Tampa, FL', 'Miami, FL'];
  const labels = dataset.qa.anchorCities.filter((city) => labelNames.includes(city.name));
  context.font = `${width < 620 ? 9 : 10}px system-ui`; context.fillStyle = 'rgba(244, 248, 252, 0.86)';
  context.strokeStyle = 'rgba(6, 14, 24, 0.88)'; context.lineWidth = 3;
  for (const city of labels) {
    const [x, y] = project.point(city.lon, city.lat);
    context.beginPath(); context.arc(x, y, 2.3, 0, Math.PI * 2); context.fill();
    const shortName = city.name.split(',')[0]; context.strokeText(shortName, x + 5, y + 3); context.fillText(shortName, x + 5, y + 3);
  }

  if (debug) {
    for (const point of dataset.points) {
      const [x, y] = project.point(point.lon, point.lat);
      context.beginPath(); context.arc(x, y, point === selectedPoint ? 3.5 : 1.2, 0, Math.PI * 2);
      context.fillStyle = point.finalCategory == null ? '#f45d73' : point.finalCategory === 0 ? '#a6b0bf' : `rgb(${COLORS[point.finalCategory].join(',')})`;
      context.fill();
    }
  }
}

function range(points, key, suffix = '') {
  const values = points.map((point) => point[key]).filter(Number.isFinite);
  if (!values.length) return 'Missing';
  const min = Math.round(Math.min(...values)); const max = Math.round(Math.max(...values));
  return min === max ? `${min}${suffix}` : `${min}–${max}${suffix}`;
}

function skyDescription(hours) {
  const values = hours.map((hour) => hour.skyCoverPct).filter(Number.isFinite);
  if (!values.length) return 'Sky cover unavailable';
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (average <= 20) return 'Mostly sunny'; if (average <= 45) return 'Partly sunny';
  if (average <= 70) return 'Mostly cloudy'; return 'Cloudy';
}

function pointTitle(point) {
  const anchor = dataset.qa.anchorCities.reduce((best, city) => {
    const distance = (city.lat - point.lat) ** 2 + (city.lon - point.lon) ** 2;
    return !best || distance < best.distance ? { city, distance } : best;
  }, null);
  return anchor?.distance < 0.22 ? anchor.city.name : `${point.lat.toFixed(2)}°, ${Math.abs(point.lon).toFixed(2)}°W · ${point.state}`;
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]));
}

function hourLabel(localTime) {
  const hour = Number(String(localTime).split(':')[0]);
  return hour === 12 ? '12 PM' : `${hour - 12} PM`;
}

function showInspector(point) {
  if (!point) return;
  selectedPoint = point;
  const category = point.finalCategory == null ? 'Data missing' : CATEGORY_LABELS[point.finalCategory];
  const rain = range(point.hours, 'precipProbabilityPct', '%');
  const thunderValues = point.hours.map((hour) => hour.thunderProbabilityPct).filter(Number.isFinite);
  const thunder = thunderValues.length && Math.max(...thunderValues) > 0 ? `<div>Thunder risk: ${Math.max(...thunderValues)}% <em>inferred</em></div>` : '';
  const hourly = point.hours.map((hour) => `<li><span>${hourLabel(hour.localTime)}</span><strong>${hour.category == null ? 'Missing' : CATEGORY_LABELS[hour.category]}</strong></li>`).join('');
  const debugDetails = debug ? `<details open><summary>Engine reasoning</summary><pre>${escapeHtml(JSON.stringify({ rawCategory: point.finalCategory, displayValue: point.displayValue, aggregation: point.aggregation, hours: point.hours.map((hour) => ({ time: hour.localTime, inputs: { temperatureF: hour.temperatureF, dewPointF: hour.dewPointF, windMph: hour.windMph, gustMph: hour.gustMph, skyCoverPct: hour.skyCoverPct, precipProbabilityPct: hour.precipProbabilityPct, thunderProbabilityPct: hour.thunderProbabilityPct }, reasoning: hour.reasoning })) }, null, 2))}</pre></details>` : '';
  inspector.innerHTML = `<p class="inspector-location">${pointTitle(point)}</p><h3 class="category-${point.finalCategory ?? 'missing'}">${category}</h3>
    <div class="inspector-grid"><div>Temperature: ${range(point.hours, 'temperatureF', '°F')}</div><div>Dew point: ${range(point.hours, 'dewPointF', '°F')}</div><div>Wind: ${range(point.hours, 'windMph', ' mph')}</div><div>Gusts: ${range(point.hours, 'gustMph', ' mph')}</div><div>${skyDescription(point.hours)}</div><div>Rain risk: ${rain}${point.hours.some((hour) => hour.precipProbabilitySource?.startsWith('inferred')) ? ' <em>inferred</em>' : ''}</div>${thunder}</div>
    <ul class="hourly-list">${hourly}</ul>${debugDetails}`;
  inspector.hidden = false;
  if (debug) drawMap();
}

function nearestPoint(event) {
  const rect = canvas.getBoundingClientRect();
  const [lon, lat] = projection(rect.width, rect.height).inverse(event.clientX - rect.left, event.clientY - rect.top);
  return dataset.points.reduce((best, point) => {
    const distance = (point.lat - lat) ** 2 + (point.lon - lon) ** 2;
    return !best || distance < best.distance ? { point, distance } : best;
  }, null)?.point;
}

function updateDebugPanel() {
  debugToggle.setAttribute('aria-pressed', String(debug)); qaPanel.hidden = !debug;
  if (!debug) return;
  const counts = dataset.analysis.categoryCounts;
  qaPanel.innerHTML = `<p class="eyebrow">Developer / QA mode</p><h2 id="qa-title">Analysis diagnostics</h2>
    <div class="qa-grid"><div><strong>${dataset.analysis.landPointCount.toLocaleString()}</strong><span>land points</span></div><div><strong>${dataset.analysis.missingPointCount.toLocaleString()}</strong><span>missing points</span></div><div><strong>${dataset.qa.suspiciousDiscontinuityCount.toLocaleString()}</strong><span>sharp adjacent jumps</span></div><div><strong>${Object.entries(counts).map(([key, value]) => `${key}:${value}`).join(' · ')}</strong><span>raw category counts</span></div></div>
    <p><strong>Source:</strong> ${dataset.source.name}. ${dataset.source.retrieval}</p><p><strong>Precipitation limitation:</strong> ${dataset.source.precipitationNote}</p>
    <table><thead><tr><th>QA city</th><th>Grid node</th><th>FEELSCORE</th></tr></thead><tbody>${dataset.qa.anchorCities.map((city) => `<tr><td>${city.name}</td><td>${city.gridPoint?.join(', ') ?? 'Missing'}</td><td>${city.label}</td></tr>`).join('')}</tbody></table>`;
}

canvas.addEventListener('pointermove', (event) => {
  if (event.pointerType === 'touch' || !dataset) return;
  cancelAnimationFrame(renderFrame); renderFrame = requestAnimationFrame(() => showInspector(nearestPoint(event)));
});
canvas.addEventListener('click', (event) => dataset && showInspector(nearestPoint(event)));
canvas.addEventListener('keydown', (event) => {
  if (!dataset || !['Enter', ' '].includes(event.key)) return;
  event.preventDefault(); showInspector(selectedPoint || dataset.points[Math.floor(dataset.points.length / 2)]);
});
debugToggle.addEventListener('click', () => {
  debug = !debug;
  const url = new URL(location.href); if (debug) url.searchParams.set('debug', '1'); else url.searchParams.delete('debug');
  history.replaceState(null, '', url); updateDebugPanel(); drawMap(); if (selectedPoint) showInspector(selectedPoint);
});
window.addEventListener('resize', () => {
  clearTimeout(window.__feelscoreResize); window.__feelscoreResize = setTimeout(drawMap, 120);
});

Promise.all([
  fetch('/data/feelscore-grid.json', { cache: 'no-cache' }).then((response) => { if (!response.ok) throw new Error(`Dataset unavailable (${response.status})`); return response.json(); }),
  fetch('/data/southeast-states.geojson').then((response) => { if (!response.ok) throw new Error(`Boundaries unavailable (${response.status})`); return response.json(); }),
]).then(([analysis, states]) => {
  dataset = analysis; boundaries = states; empty.hidden = true; canvas.tabIndex = 0;
  dayLabel.textContent = formatDate(dataset.forecastDate);
  const generated = new Date(dataset.generatedAt);
  status.textContent = `${dataset.analysis.landPointCount.toLocaleString()} land points · updated ${generated.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`;
  updateDebugPanel(); drawMap();
  const asheville = dataset.qa.anchorCities.find((city) => city.name.startsWith('Asheville'));
  const initial = dataset.points.find((point) => asheville?.gridPoint?.[0] === point.lat && asheville?.gridPoint?.[1] === point.lon);
  if (initial) showInspector(initial);
}).catch((error) => {
  status.textContent = 'Regional analysis temporarily unavailable';
  empty.querySelector('strong').textContent = 'The latest analysis could not load';
  empty.querySelector('span:last-child').textContent = 'Please try again shortly.';
  console.error('FEELSCORE load failed:', error);
});
