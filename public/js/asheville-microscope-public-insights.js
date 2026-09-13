import { summarizeMetric, robustElevationSlope, haversineMiles } from './asheville-microscope-lab-analysis.js';

const escape = (value) => String(value).replace(/[&<>"']/g, (character) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const number = (value) => Number.isFinite(value) ? value.toFixed(1) : 'Unavailable';
const wet = (station) => station.observation?.precipitationRateInHr > 0;
const categories = ['One Asheville story', 'Mostly aligned', 'Location matters', 'Highly localized'];

export function pairDifferences(first, second) {
  return [
    ['Elevation', first.elevationFt, second.elevationFt, 'ft', 'higher', 'lower', 0],
    ['Temperature', first.observation?.temperatureF, second.observation?.temperatureF, '°F', 'warmer', 'cooler', 1],
    ['Dew point', first.observation?.dewPointF, second.observation?.dewPointF, '°F', 'higher', 'lower', 1],
    ['Sustained wind', first.observation?.windMph, second.observation?.windMph, 'mph', 'stronger', 'lighter', 1],
    ['Elevation-adjusted pressure', first.observation?.normalizedPressureMb, second.observation?.normalizedPressureMb, 'mb', 'higher', 'lower', 1],
    ['Rain today', first.observation?.precipitationTodayIn, second.observation?.precipitationTodayIn, 'in', 'more', 'less', 2],
  ].map(([label, a, b, unit, up, down, precision]) => {
    const delta = Number.isFinite(a) && Number.isFinite(b) ? b - a : null;
    const rounded = delta === null ? null : Number(delta.toFixed(precision));
    return { label, a, b, unit, precision, value: rounded === null ? 'Unavailable' : `${Math.abs(rounded).toFixed(precision)} ${unit}`, direction: rounded === null ? 'Both readings needed' : rounded === 0 ? 'No difference' : rounded > 0 ? up : down };
  });
}

export function pairGraphic(metric, firstName, secondName) {
  if (!Number.isFinite(metric.a) || !Number.isFinite(metric.b)) return '<div class="avl-pair-graphic-empty">Comparison unavailable</div>';
  const padding = { 'ft': 100, '°F': 2, 'mph': 2, 'mb': 2, 'in': .05 }[metric.unit];
  const low = Math.min(metric.a, metric.b) - padding;
  const high = Math.max(metric.a, metric.b) + padding;
  const x = v => 28 + (v-low)/(high-low)*244;
  const a=x(metric.a), b=x(metric.b);
  const text = v => `${v.toFixed(metric.precision)} ${metric.unit}`;
  return `<svg class="avl-pair-graphic" viewBox="0 0 300 106" role="img" aria-label="${escape(firstName)}: ${text(metric.a)}; ${escape(secondName)}: ${text(metric.b)}"><line x1="28" y1="55" x2="272" y2="55" stroke="#ffffff25" stroke-width="8" stroke-linecap="round"/><line x1="${a}" y1="55" x2="${b}" y2="55" stroke="#ffffff90" stroke-width="5"/><line x1="${a}" y1="30" x2="${a}" y2="55" stroke="#68e2cb" stroke-width="2"/><line x1="${b}" y1="55" x2="${b}" y2="80" stroke="#ffbb59" stroke-width="2"/><circle cx="${a}" cy="55" r="10" fill="#68e2cb"/><circle cx="${b}" cy="55" r="6" fill="#ffbb59" stroke="#0a2046" stroke-width="2"/><text x="${a}" y="21" text-anchor="middle" fill="#8bf3dd">${text(metric.a)}</text><text x="${b}" y="100" text-anchor="middle" fill="#ffd078">${text(metric.b)}</text></svg>`;
}

export function publicSummary(payload) {
  const core = (payload.stations || []).filter((station) => (station.scope || 'core') === 'core' && station.quality?.usable && Number.isFinite(station.observation?.temperatureF));
  const stats = summarizeMetric(core, 'temperatureF');
  const index = stats.iqr <= 3 ? 0 : stats.iqr <= 5 ? 1 : stats.iqr <= 8 ? 2 : 3;
  const dry = core.filter((station) => !wet(station));
  const trend = robustElevationSlope(dry);
  const elevationSpan = dry.length ? Math.max(...dry.map((station) => station.elevationFt)) - Math.min(...dry.map((station) => station.elevationFt)) : 0;
  return { core, stats, index, dry, trend, elevationSpan };
}

export function neighborhoodLineup(core, stats) {
  if (!core.length || !Number.isFinite(stats.min)) return '';
  const span = stats.max - stats.min;
  const x = value => span === 0 ? 400 : 48 + (value-stats.min)/span*704;
  const sorted = [...core].sort((a,b) => a.observation.temperatureF-b.observation.temperatureF);
  const lanes = [];
  const dots = sorted.map(station => {
    const value = station.observation.temperatureF, position = x(value);
    let lane = lanes.findIndex(last => position-last >= 18);
    if (lane < 0) lane = lanes.length;
    lanes[lane] = position;
    const color = span === 0 ? '#ae9eea' : `hsl(${220-(value-stats.min)/span*194} 85% 65%)`;
    return `<circle cx="${position}" cy="${74+lane*20}" r="7" fill="${color}" stroke="#fff" stroke-width="1.5"><title>${escape(station.name)}: ${number(value)}°F</title></circle>`;
  });
  const height = 114 + Math.max(1,lanes.length)*20;
  return `<div class="avl-neighborhood-lineup"><div class="avl-lineup-heading"><b>See how closely neighborhoods cluster</b><span>${core.length} dots · one per reporting neighborhood</span></div><svg viewBox="0 0 800 ${height}" role="img" aria-label="Neighborhood temperatures from ${number(stats.min)} to ${number(stats.max)} degrees Fahrenheit. The middle half falls between ${number(stats.q1)} and ${number(stats.q3)} degrees."><rect x="${x(stats.q1)-8}" y="52" width="${Math.max(16,x(stats.q3)-x(stats.q1)+16)}" height="${height-86}" rx="12" fill="#67e2c928" stroke="#67e2c960"/><text x="400" y="28" text-anchor="middle" fill="#8bf3dd">Highlighted band = middle half of neighborhoods</text><line x1="48" y1="${height-27}" x2="752" y2="${height-27}" stroke="#ffffff40" stroke-width="2"/>${dots.join('')}<text x="48" y="${height-5}" fill="#a5c8ff">${number(stats.min)}°F · coolest</text><text x="752" y="${height-5}" text-anchor="end" fill="#ffd078">${number(stats.max)}°F · warmest</text></svg><p>Dots close together mean similar temperatures. Separated dots show places that stand apart. Position shows temperature—not geography.</p></div>`;
}

export function renderPublicInsights(root, payload) {
  if (!document.querySelector('#avl-public-insights-css')) {
    const link = document.createElement('link');
    link.id = 'avl-public-insights-css'; link.rel = 'stylesheet'; link.href = './css/asheville-microscope-public-insights.css';
    document.head.append(link);
  }
  const { core, stats, index, dry, trend, elevationSpan } = publicSummary(payload);
  let summary = root.querySelector('#avl-public-summary');
  if (!summary) {
    summary = document.createElement('section'); summary.id = 'avl-public-summary'; summary.className = 'avl-public-summary';
    summary.setAttribute('aria-labelledby', 'avl-consensus-title');
    root.querySelector('.avl-footprint').after(summary);
  }
  const rain = core.filter(wet);
  const gust = summarizeMetric(core, 'windGustMph');
  const explanation = rain.length
    ? `${rain.map((station) => station.name).join(', ')} ${rain.length === 1 ? 'reports' : 'report'} active rain. Rain may be contributing to local temperature differences; current readings alone cannot establish the cause.`
    : gust.spread >= 10
      ? `No active rain is reported at neighborhood stations with rain-rate data. Gusts differ by ${number(gust.spread)} mph, a reminder that wind exposure also varies across town.`
      : 'The temperature readings are closely clustered right now. Current readings alone cannot separate the effects of elevation, shade, exposure, or recent weather.';
  summary.innerHTML = core.length < 6 ? '<h2 id="avl-consensus-title">Not enough neighborhoods are reporting</h2><p>At least six current readings are needed for this summary.</p>' : `
    <div class="avl-public-kicker">Does one Asheville temperature tell the whole story?</div>
    <h2 id="avl-consensus-title">${categories[index]}</h2>
    <p class="avl-public-lead">${index === 0 && stats.spread >= 7 ? 'Most neighborhoods agree—but the warm and cool pockets still matter.' : ['Most neighborhoods are close in temperature right now.', 'Mostly—but not everywhere.', 'Your neighborhood makes a meaningful difference right now.', 'One reading misses substantial neighborhood differences.'][index]}</p>
    <div class="avl-public-scale" aria-label="Current category: ${categories[index]}">${categories.map((label, position) => `<div class="${position === index ? 'active' : ''}"><span>${position === index ? '● ' : ''}${label}</span></div>`).join('')}</div>
    <div class="avl-public-facts"><div><span>Middle half of neighborhoods</span><strong>${number(stats.q1)}°–${number(stats.q3)}°</strong></div><div><span>All reporting neighborhoods</span><strong>${number(stats.min)}°–${number(stats.max)}°</strong></div><div><span>Coolest-to-warmest gap</span><strong>${number(stats.spread)}°</strong></div></div>
    ${neighborhoodLineup(core, stats)}
    <div class="avl-public-explanation"><b>What else is in the picture?</b><p>${escape(explanation)}</p></div>
    <details><summary>How is this decided?</summary><p>This compares ${core.length} current Asheville neighborhood readings—not the surrounding corridors. The category uses the temperature range containing the middle half of those readings: up to 3°F, 5°F, 8°F, or above 8°F. The full range keeps unusually warm and cool locations visible. These categories describe current conditions—not forecasts or safety guidance.</p></details>`;

  // Elevation testing modules now live on Micronet.

  let compare = root.querySelector('#avl-public-compare');
  if (!compare) {
    compare = document.createElement('section'); compare.id = 'avl-public-compare'; compare.className = 'avl-public-compare';
    root.querySelector('.avl-regional-card').before(compare);
  }
  const previousOne = compare.querySelector('#avl-compare-one')?.value;
  const previousTwo = compare.querySelector('#avl-compare-two')?.value;
  const choices = [...core];
  for (const id of [previousOne, previousTwo]) {
    if (id && !choices.some((station) => station.id === id)) {
      const station = payload.stations.find((station) => station.id === id);
      choices.push({ id, name: `${station?.name || 'Selected neighborhood'} — currently unavailable` });
    }
  }
  const options = choices.sort((a,b) => a.name.localeCompare(b.name)).map((station) => `<option value="${escape(station.id)}">${escape(station.name)}</option>`).join('');
  compare.innerHTML = `<div class="avl-public-kicker">Your neighborhood, side by side</div><h2>Compare two places</h2><div class="avl-public-selects"><label>First neighborhood<select id="avl-compare-one">${options}</select></label><label>Second neighborhood<select id="avl-compare-two">${options}</select></label></div><div class="avl-public-pair-results" aria-live="polite"></div>`;
  const one = compare.querySelector('#avl-compare-one'); const two = compare.querySelector('#avl-compare-two');
  one.value = previousOne || core.find((station) => station.id === 'huntington-chase')?.id || core[0]?.id || '';
  two.value = previousTwo || core.find((station) => station.id === 'west-asheville')?.id || core[1]?.id || '';
  function updatePair() {
    const first = core.find((station) => station.id === one.value); const second = core.find((station) => station.id === two.value);
    if (!first || !second) {
      compare.querySelector('.avl-public-pair-results').innerHTML = '<p>One of your selected places is not currently reporting. Your selection is saved; comparisons will return when fresh readings are available.</p>';
      return;
    }
    const difference = second.observation.temperatureF - first.observation.temperatureF;
    compare.querySelector('.avl-public-pair-results').innerHTML = `<div class="avl-public-pair-head"><strong>${number(Math.abs(difference))}° ${difference < 0 ? 'cooler' : difference > 0 ? 'warmer' : 'difference'}</strong><p>${first.id === second.id ? 'Choose a different second neighborhood to compare.' : `${escape(second.name)} compared with ${escape(first.name)}.`}</p></div><div class="avl-public-facts">${[first,second].map((station) => `<div><span>${escape(station.name)}</span><strong>${number(station.observation.temperatureF)}°F</strong><p>${station.elevationFt.toLocaleString()} ft · ${wet(station) ? 'Active rain reported' : Number.isFinite(station.observation.precipitationRateInHr) ? 'No active rain reported' : 'Rain data unavailable'}</p></div>`).join('')}<div><span>Distance between stations</span><strong>${number(haversineMiles(first,second))} mi</strong><p>${Math.abs(second.elevationFt-first.elevationFt).toLocaleString()} ft of elevation difference</p></div></div><p class="avl-public-caution">Observation points—not forecasts for every address. Updated: ${escape(new Date(payload.generatedAt).toLocaleTimeString('en-US',{timeZone:'America/New_York',hour:'numeric',minute:'2-digit'}))} Eastern.</p>`;
  }
  function updateComparisons() {
    updatePair();
    const first = core.find((station) => station.id === one.value);
    const second = core.find((station) => station.id === two.value);
    if (!first || !second) return;
    compare.querySelector('.avl-public-pair-results').insertAdjacentHTML('beforeend', `<div class="avl-pair-metrics"><h3>How ${escape(second.name)} differs from ${escape(first.name)}</h3><p class="avl-pair-color-key"><span>● ${escape(first.name)}</span><span>● ${escape(second.name)}</span></p><div class="avl-pair-metric-grid">${pairDifferences(first, second).map((metric) => `<div><span>${metric.label}</span>${pairGraphic(metric, first.name, second.name)}<strong>${metric.value}</strong><b>${metric.direction}</b></div>`).join('')}</div><p class="avl-public-caution">Pressure is adjusted for elevation so places at different heights can be compared; readings that cannot be reliably compared are left out. Dew point describes moisture in the air. Rain today compares each station’s daily total, not the total for a single storm. These differences do not establish their cause.</p></div>`);
  }
  one.addEventListener('change', updateComparisons); two.addEventListener('change', updateComparisons); updateComparisons();
}
