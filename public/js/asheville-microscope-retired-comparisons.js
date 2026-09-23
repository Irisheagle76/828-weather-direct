import { publicSummary } from './asheville-microscope-public-insights.js';
const escape = (v) => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number = (v) => Number.isFinite(v) ? v.toFixed(1) : 'Unavailable';
export function renderRetiredComparisons(root, payload) {
  const { core, dry, trend, elevationSpan } = publicSummary(payload);
  let best;
  for (let i=0;i<dry.length;i++) for (let j=i+1;j<dry.length;j++) {
    const a=dry[i], b=dry[j], height=Math.abs(a.elevationFt-b.elevationFt), gap=Math.abs(a.observation.temperatureF-b.observation.temperatureF);
    if (height<=25 && (!best || gap>best.gap)) best={a,b,height,gap};
  }
  root.innerHTML = '<h2>Beyond the headline · saved for testing</h2><p>Former Microscope modules. Neighborhood comparisons retained here for evaluation; broader elevation comparisons may be explored later.</p><div class="avl-deeper-grid"><article class="avl-context-panel"><h3>Matched elevation comparison</h3>' + (best ? '<p>'+escape(best.a.name)+' and '+escape(best.b.name)+'</p><strong>'+number(best.gap)+'°F apart · '+best.height+' ft elevation difference</strong><p>'+number(best.a.observation.temperatureF)+'°F / '+best.a.elevationFt+' ft versus '+number(best.b.observation.temperatureF)+'°F / '+best.b.elevationFt+' ft.</p><p>Similar elevations do not isolate exposure or establish the cause of the temperature difference. Active-rain stations are excluded; recent rain may still matter.</p>' : '<p>No dry neighborhood pair within 25 vertical feet is available.</p>') + '</article><article class="avl-context-panel"></article></div>';
  const oldPanel = root.querySelector('.avl-deeper-grid .avl-context-panel:nth-child(2)');
  oldPanel.hidden = true;
  let elevation = root.querySelector('#avl-public-elevation');
  if (!elevation) {
    elevation = document.createElement('article'); elevation.id = 'avl-public-elevation'; elevation.className = 'avl-context-panel avl-public-elevation'; oldPanel.after(elevation);
  }
  const sufficient = dry.length >= 6 && elevationSpan >= 150 && trend.slopePer1000Ft != null && trend.r2 != null;
  const strength = !sufficient ? 'Not enough evidence right now' : trend.r2 < 0.15 ? 'Little relationship right now' : trend.r2 < 0.4 ? 'Some relationship—not the whole story' : 'A clearer elevation pattern right now';
  const exceptions = sufficient ? dry.map((station) => ({station, departure: station.observation.temperatureF - (trend.intercept + trend.slopePer1000Ft * station.elevationFt / 1000)})).sort((a, b) => Math.abs(b.departure) - Math.abs(a.departure)).slice(0, 3) : [];
  elevation.innerHTML = `<div class="avl-section-kicker">Elevation lens · Asheville neighborhoods</div><h3>Does elevation explain the temperatures right now?</h3><strong class="avl-public-verdict">${strength}</strong><p>${sufficient ? `${Math.abs(trend.slopePer1000Ft) < 1.5 ? 'Higher and lower locations have similar temperatures.' : trend.slopePer1000Ft < 0 ? 'Higher locations tend to be cooler.' : 'Higher locations tend to be warmer.'} That is an observed relationship, not proof that elevation caused the difference.` : 'A useful comparison needs at least six dry reporting stations across 150 vertical feet, with enough temperature variation.'}</p><div class="avl-public-exceptions">${exceptions.map(({station, departure}) => `<div class="${departure < 0 ? 'cool' : 'warm'}"><b>${escape(station.name)}</b><strong>${number(Math.abs(departure))}° ${departure < 0 ? 'cooler' : 'warmer'}</strong><span>${number(station.observation.temperatureF)}° observed · ${station.elevationFt.toLocaleString()} ft<br>than the overall elevation pattern suggests</span></div>`).join('')}</div><details><summary>What can—and can’t—this tell us?</summary><p>${core.length - dry.length} active-rain station(s) excluded. ${dry.length} dry neighborhood readings compared across ${elevationSpan} vertical feet. This comparison describes current conditions only. Recent rain can still affect a station after the rain stops. Shade, exposure, geography, timing, and sensor differences remain possible influences; these comparisons do not tell us the cause.</p></details>`;
}

