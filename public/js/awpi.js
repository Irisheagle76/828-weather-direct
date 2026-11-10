const $ = id => document.getElementById(id);
const finite = n => typeof n === 'number' && Number.isFinite(n);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const number = n => finite(n) ? String(Math.round(n)) : '—';
const signed = n => finite(n) ? `${n > 0 ? '+' : ''}${n.toFixed(1)}` : '—';
const category = n => !finite(n) ? 'Unavailable' : ['Very unfavorable','Unfavorable','Mixed','Favorable','Strongly favorable'][Math.min(4, Math.floor(n / 20))];
const date = s => s ? new Date(s.length === 10 ? `${s}T12:00:00Z` : s).toLocaleString('en-US', s.length === 10 ? { month: 'short', day: 'numeric', timeZone: 'America/New_York' } : { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short', timeZone: 'America/New_York' }) : 'Unknown';
const components = [['cold','Cold Pattern','Absolute cold support'],['storm','Storm Track','Local precipitation proxy'],['snow','Snow Setup','Coincident cold + modeled snow']];

function chart(days) {
  if (!days.some(d => components.some(([key]) => finite(d[key])))) return '<p class="muted">The chart will appear when forecast data are available.</p>';
  const x = i => 44 + i * 62, y = v => 200 - v * 1.65;
  let svg = '<svg viewBox="0 0 890 245" role="img" aria-labelledby="awpi-chart-title awpi-chart-description"><title id="awpi-chart-title">14-day winter support</title><desc id="awpi-chart-description">Cold, storm and snow support from zero to one hundred. Exact values are available in the table below.</desc>';
  for (const n of [0, 25, 50, 75, 100]) svg += `<line x1="44" y1="${y(n)}" x2="860" y2="${y(n)}" stroke="#e2e9ee"/><text x="30" y="${y(n) + 4}" text-anchor="end" font-size="11" fill="#53687a">${n}</text>`;
  const colors = { cold: '#087dc1', storm: '#b44c14', snow: '#08756f' };
  for (const [key, title] of components) {
    let previous = null;
    days.forEach((d, i) => {
      if (!finite(d[key])) { previous = null; return; }
      if (previous !== null) svg += `<line x1="${x(previous)}" y1="${y(days[previous][key])}" x2="${x(i)}" y2="${y(d[key])}" stroke="${colors[key]}" stroke-width="2.5" ${i >= 5 ? 'stroke-dasharray="5 3"' : ''}/>`;
      svg += `<circle cx="${x(i)}" cy="${y(d[key])}" r="3.5" fill="${colors[key]}"><title>${esc(`${date(d.date)} ${title}: ${d[key]}`)}</title></circle>`;
      previous = i;
    });
  }
  days.forEach((d, i) => { if (!(i % 2) || i === 13) svg += `<text x="${x(i)}" y="227" text-anchor="middle" font-size="11" fill="#53687a">${esc(date(d.date))}</text>`; });
  return svg + '</svg>';
}

export function render(data) {
  $('updated').textContent = data.generatedAt ? `Calculated ${date(data.generatedAt)}` : 'No current assessment';
  $('status').textContent = data.stale || data.status === 'stale' ? 'STALE GUIDANCE — The last successful assessment is shown with its original dates. A refresh failed or the forecast is out of date.' : data.status === 'unavailable' ? 'Forecast unavailable — missing values are not treated as zero.' : data.status === 'partial' ? 'Partial guidance — some daily scores are unavailable. Review source freshness below.' : 'Experimental ensemble guidance · Scores are not probabilities · Confidence decreases with lead time';
  $('narrative').textContent = data.narrative || 'Current ensemble guidance is unavailable.';
  $('cards').innerHTML = components.map(([key, title, detail]) => `<article class="score-card ${key}"><h2>${title}</h2><div class="score">${number(data.summary?.[key])}<small> / 100</small></div><div class="category">${category(data.summary?.[key])}</div><div class="meter"><span style="width:${finite(data.summary?.[key]) ? data.summary[key] : 0}%"></span></div><p>${detail}<br>14-day mean support</p></article>`).join('');
  const days = data.days || [];
  $('chart').innerHTML = chart(days);
  $('daily').innerHTML = days.map(d => `<tr><td>${esc(date(d.date))}</td><td>${number(d.cold)}</td><td>${number(d.storm)}</td><td>${number(d.snow)}</td><td>${esc(d.confidence)}</td><td>${number(d.members?.cold)} / ${number(d.members?.storm)} / ${number(d.members?.snow)}</td></tr>`).join('');
  $('windows').innerHTML = (data.windows || []).map(w => `<div class="window"><strong>${esc(w.label)}</strong>Cold ${number(w.cold)} · Storm ${number(w.storm)} · Snow ${number(w.snow)}<br>${esc(w.confidence)} confidence</div>`).join('');
  const sources = data.sources || {};
  $('enso').innerHTML = [['roni','RONI (3-month relative anomaly)'],['nino34','Niño 3.4 (monthly anomaly)']].map(([key, title]) => { const s = sources[key]; return `<div class="reading"><div>${title}<small>${esc(s?.data?.period || 'No observation')} · ${esc(s?.status || 'unavailable')}</small></div><b>${signed(s?.data?.value)} °C</b></div>`; }).join('') + `<p>${esc(sources.roni?.data?.classification || 'Classification unavailable')}</p><p class="muted">RONI change from previous season: ${signed(sources.roni?.data?.value - sources.roni?.data?.previous)} °C. Recent values may be revised.</p>`;
  $('teleconnections').innerHTML = ['ao','nao','pna'].map(key => { const s = sources[key]; return `<div class="reading"><div>${key.toUpperCase()}<small>${esc(s?.data?.date ? date(s.data.date) : 'No observation')} · ${esc(s?.status || 'unavailable')}</small></div><b>${signed(s?.data?.value)}</b></div>`; }).join('');
  $('trends').innerHTML = (data.trends || [1,3,7].map(lagDays => ({ lagDays, delta: {} }))).map(t => `<div class="reading"><div>${t.lagDays} day${t.lagDays === 1 ? '' : 's'} ago<small>${t.overlapDays || 0} shared forecast dates</small></div><div>${components.map(([key, title]) => `${title.split(' ')[0]} ${signed(t.delta?.[key])}`).join('<br>')}</div></div>`).join('') + (data.persistence !== 'durable' ? '<p class="muted">Persistent history is unavailable in this environment.</p>' : '');
  $('sources').innerHTML = Object.entries(sources).map(([key, s]) => `<div><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(key === 'ensemble' ? 'NOAA GEFS via Open-Meteo' : `NOAA CPC ${key.toUpperCase()}`)}</a><span class="source-status">${esc(s.status)} · Retrieved ${esc(date(s.retrievedAt))}</span>${s.data?.date ? `<br>Observation period ends ${esc(date(s.data.date))}` : ''}</div>`).join('') || '<p>No sources could be retrieved.</p>';
}

render({ status: 'unavailable', narrative: 'Retrieving the latest forecast and climate observations…' });
$('status').textContent = 'Loading actual ensemble guidance and NOAA observations…';
try {
  const response = await fetch('/api/router?route=awpi/current', { signal: AbortSignal.timeout(45000) });
  const data = await response.json();
  if (!data.status) throw new Error('Invalid assessment');
  render(data);
} catch {
  render({ status: 'unavailable', narrative: 'The current assessment could not be retrieved. Please try again later.' });
}
