const time = timestamp => new Intl.DateTimeFormat('en-US', {
  weekday: 'short', hour: 'numeric', timeZone: 'America/New_York'
}).format(new Date(timestamp));
const hour = timestamp => new Intl.DateTimeFormat('en-US', {
  hour: 'numeric', timeZone: 'America/New_York'
}).format(new Date(timestamp));
const label = score => score < 20 ? 'Low' : score < 40 ? 'Moderate' : score < 60 ? 'Elevated' : score < 80 ? 'High' : 'Extreme';

export function fireSeasonNote(outlook) {
  const season = outlook?.season;
  const profile = season?.profile || (outlook?.autumnWeight > 0 ? 'fall' : 'standard');
  const status = season?.mode && season.mode !== 'auto' ? 'Selected profile' : 'Seasonal profile';
  if (profile === 'spring') return `${status}: spring. Dry air, wind and dry spells matter before green-up; vegetation and fuel moisture are not measured. `;
  if (profile === 'fall') return `${status}: fall. Dry air, wind and dry spells matter during leaf fall; leaf moisture is not measured. `;
  return `${status}: standard. Weather and drought still determine the score outside the spring and fall windows. `;
}

export function firePresentation(data) {
  const peak = data?.outlook?.complete && data.outlook.peak;
  if (!peak || !Number.isFinite(peak.FRI)) return {
    value: data.FRI, caption: 'Fire potential now',
    headline: `${label(data.FRI)} fire potential right now.`,
    summary: 'The full 24-hour outlook is unavailable. This reading describes current weather only.'
  };
  return {
    value: peak.FRI, caption: 'Peak fire · next 24h',
    headline: `${label(peak.FRI)} fire potential in the next 24 hours.`,
    summary: `Peak ${peak.FRI}/100 ${peak.observed ? 'now' : `near ${time(peak.timestamp)}`}, with ${Math.round(peak.rh)}% humidity and ${Math.round(peak.windGust)} mph gusts. Current potential: ${data.FRI}/100 (${label(data.FRI).toLowerCase()}).`
  };
}

function validPoints(outlook) {
  return (outlook?.points || []).filter(p => [p.timestamp, p.DSS, p.FRI, p.rh, p.windGust].every(Number.isFinite) &&
    p.DSS >= 0 && p.DSS <= 100 && p.FRI >= 0 && p.FRI <= 100);
}

// Cubic control points remain inside each pair of samples; no score overshoot.
function path(points, field, x, y) {
  return points.map((p, i) => {
    if (!i) return `M ${x(p.timestamp)} ${y(p[field])}`;
    const before = points[i - 1], mid = (x(before.timestamp) + x(p.timestamp)) / 2;
    return `C ${mid} ${y(before[field])} ${mid} ${y(p[field])} ${x(p.timestamp)} ${y(p[field])}`;
  }).join(' ');
}

export function fireChartMarkup(outlook, { width = 860, selected = 0 } = {}) {
  const points = validPoints(outlook);
  if (points.length < 2) return '';
  const w = Math.max(280, width), height = 250, left = 34, right = w - 15, top = 18, bottom = 211;
  const first = points[0].timestamp, end = first + 24 * 3600000;
  const x = ts => +(left + (ts - first) / (end - first) * (right - left)).toFixed(2);
  const y = score => +(bottom - score / 100 * (bottom - top)).toFixed(2);
  const active = points[Math.max(0, Math.min(points.length - 1, selected))];
  const fire = path(points, 'FRI', x, y), drought = path(points, 'DSS', x, y);
  const peak = outlook.complete ? outlook.peak : null;
  return `<svg viewBox="0 0 ${w} ${height}" role="img" aria-label="24-hour drought and fire outlook. Drought background ${points[0].DSS} out of 100. ${peak ? `Peak fire potential ${peak.FRI} near ${time(peak.timestamp)}.` : 'Forecast coverage is incomplete.'}">
    <defs><linearGradient id="fireCurveFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffae72" stop-opacity=".28"/><stop offset="1" stop-color="#ffae72" stop-opacity=".01"/></linearGradient></defs>
    ${[0,20,40,60,80,100].map(n => `<line x1="${left}" x2="${right}" y1="${y(n)}" y2="${y(n)}" stroke="white" stroke-opacity="${n === 0 ? '.25' : '.09'}"/><text x="${left-9}" y="${y(n)+4}" text-anchor="end" fill="#d9c7bd" font-size="11">${n}</text>`).join('')}
    <path d="${fire} L ${x(points.at(-1).timestamp)} ${bottom} L ${left} ${bottom} Z" fill="url(#fireCurveFill)"/>
    <path d="${drought}" fill="none" stroke="#9ae3d4" stroke-width="2.5" stroke-dasharray="7 5" stroke-linecap="round"/>
    <path d="${fire}" fill="none" stroke="#ffad74" stroke-width="3.5" stroke-linecap="round"/>
    ${peak ? `<circle cx="${x(peak.timestamp)}" cy="${y(peak.FRI)}" r="9" fill="#ffad74" fill-opacity=".18"/><circle cx="${x(peak.timestamp)}" cy="${y(peak.FRI)}" r="4" fill="#fff0dd"/>` : ''}
    <line x1="${x(active.timestamp)}" x2="${x(active.timestamp)}" y1="${top}" y2="${bottom}" stroke="#fff2df" stroke-opacity=".4" stroke-dasharray="3 4"/>
    <circle cx="${x(active.timestamp)}" cy="${y(active.DSS)}" r="4" fill="#9ae3d4"/>
    <circle cx="${x(active.timestamp)}" cy="${y(active.FRI)}" r="5" fill="#ffad74" stroke="#fff2df" stroke-width="2"/>
    ${[0,6,12,18,24].map((n,i) => `<text x="${x(first+n*3600000)}" y="237" text-anchor="${i === 0 ? 'start' : i === 4 ? 'end' : 'middle'}" fill="#e3d3c9" font-size="11">${n === 0 ? 'Now' : n === 24 ? '+24h' : hour(first+n*3600000)}</text>`).join('')}
  </svg>`;
}

export function renderFireCurve(target, outlook) {
  const container = typeof target === 'string' ? document.querySelector(target) : target;
  if (!container) return;
  container._fireObserver?.disconnect();
  const points = validPoints(outlook);
  if (points.length < 2) {
    container.innerHTML = '<p class="fire-curve-empty">Hourly outlook unavailable. No trend is estimated from missing data.</p>';
    return;
  }
  let selected = outlook.complete ? Math.max(0, points.findIndex(p => p.timestamp === outlook.peak?.timestamp)) : 0;
  container.innerHTML = `<section class="fire-curve-card" aria-label="Drought and fire outlook">
    <header class="fire-curve-header"><div><div class="fire-curve-eyebrow">The next 24 hours</div><h3>Drought &amp; fire outlook</h3></div><span class="fire-curve-scale">0–100 · Higher = more concern</span></header>
    <div class="fire-curve-legend"><span><i class="fire-line-key"></i>Fire potential</span><span><i class="drought-line-key"></i>Drought background</span></div>
    <div class="fire-curve-plot"></div>
    <div class="fire-curve-inspect" aria-live="polite" aria-atomic="true"></div>
    <label class="fire-curve-slider-label">Explore the hours<input class="fire-curve-slider" type="range" min="0" max="${points.length-1}" value="${selected}" step="1" aria-label="Explore hourly drought and fire scores"></label>
    <p class="fire-curve-note">${outlook.complete ? 'Fire potential follows the hourly weather forecast.' : 'Partial forecast: the line stops where complete hourly data ends.'} ${fireSeasonNote(outlook)}Drought background stays level because rainfall and soil analyses update daily. Times Eastern.</p>
  </section>`;
  const plot = container.querySelector('.fire-curve-plot'), inspect = container.querySelector('.fire-curve-inspect');
  const slider = container.querySelector('input');
  const draw = () => {
    const p = points[selected], when = p.observed ? 'Now · observed' : `${time(p.timestamp)} · forecast`;
    plot.innerHTML = fireChartMarkup(outlook, {width: plot.clientWidth || 860, selected});
    inspect.innerHTML = `<b>${when}</b><span class="fire-curve-fire">Fire <strong>${p.FRI}</strong> · ${label(p.FRI)}</span><span class="fire-curve-drought">Drought <strong>${p.DSS}</strong></span><small>${Math.round(p.rh)}% RH · ${Math.round(p.windGust)} mph gusts</small>`;
    slider.setAttribute('aria-valuetext', `${when}: fire ${p.FRI}, ${label(p.FRI)}; drought ${p.DSS}; humidity ${Math.round(p.rh)} percent`);
  };
  slider.addEventListener('input', () => { selected = Number(slider.value); draw(); });
  plot.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch') return;
    const rect = plot.getBoundingClientRect();
    const fraction = Math.max(0, Math.min(1, (event.clientX - rect.left - 34) / (rect.width - 49)));
    const timestamp = points[0].timestamp + fraction * 24 * 3600000;
    selected = points.reduce((best, p, i) => Math.abs(p.timestamp-timestamp) < Math.abs(points[best].timestamp-timestamp) ? i : best, 0);
    slider.value = selected;
    draw();
  });
  draw();
  if (typeof ResizeObserver !== 'undefined') {
    let width = plot.clientWidth;
    container._fireObserver = new ResizeObserver(() => {
      if (plot.clientWidth !== width) { width = plot.clientWidth; draw(); }
    });
    container._fireObserver.observe(plot);
  }
}
