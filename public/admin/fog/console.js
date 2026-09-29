const endpoint = '/api/router?route=tempest/fog-verification';
const form = document.querySelector('#observation');
const status = document.querySelector('#status');
const at = value => new Date(value).toLocaleString();
const name = id => id === '127602' ? 'Haw Creek' : 'North Downtown (JCC)';
const node = (tag, text) => { const n = document.createElement(tag); n.textContent = text; return n; };
function localInput(date) { return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
form.elements.observedAt.value = localInput(new Date());
document.querySelector('#zone').textContent = `(${Intl.DateTimeFormat().resolvedOptions().timeZone})`;
function camera() {
  const active = form.elements.source.value === 'webcam_review';
  document.querySelector('#camera-fields').hidden = !active;
  form.elements.frameAt.required = active && form.elements.outcome.value !== 'uncertain';
  form.elements.notes.required = active;
  document.querySelector('#camera-link').href = form.elements.cameraId.value === 'north-asheville-south'
    ? 'https://s28.ipcamlive.com/streams/1c4foxnfdylcpihc7/snapshot.jpg'
    : 'https://i.ytimg.com/vi/UxUU3Fc1vBw/maxresdefault_live.jpg';
}
form.elements.source.addEventListener('change', camera);
form.elements.cameraId.addEventListener('change', camera); camera();
form.elements.outcome.addEventListener('change', camera);
async function api(action = 'review', body) {
  const res = await fetch(`${endpoint}&action=${action}`, { method: body ? 'POST' : 'GET', credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  if (res.status === 401) { location.href = '/admin/login.html?next=/admin/fog/index.html'; throw new Error('Admin login required.'); }
  const data = await res.json(); if (!res.ok) throw new Error(data.error || 'Request failed.'); return data;
}
function table(host, headings, rows) {
  host.replaceChildren();
  if (!rows.length) { host.append(node('p', 'No records yet.')); return; }
  const wrap = node('div', ''); wrap.className = 'table-wrap';
  const t = node('table', ''), head = node('tr', ''), body = node('tbody', '');
  headings.forEach(h => { const th = node('th', h); th.scope = 'col'; head.append(th); });
  const thead = node('thead', ''); thead.append(head); t.append(thead, body);
  rows.forEach(row => { const tr = node('tr', ''); row.forEach(value => tr.append(node('td', value))); body.append(tr); });
  wrap.append(t); host.append(wrap);
}
async function load() {
  const data = await api();
  const reports = document.querySelector('#reports'); reports.replaceChildren();
  for (const r of data.reports) {
    const card = node('article', ''); card.append(node('h3', r.name));
    const b = r.baseline;
    card.append(node('p', `${r.labels} observations · ${r.uncertain} uncertain · ${r.matchedReports} matched · ${r.independentEpisodes} independent episodes`));
    card.append(node('p', `${b.hits} hits · ${b.falseAlarms} false alarms · ${b.misses} misses · ${b.correctNegatives} correct no-fog predictions`));
    card.append(node('p', `Balanced accuracy: ${b.balancedAccuracy === null ? 'Needs both fog and no-fog cases' : `${Math.round(b.balancedAccuracy * 100)}%`}`));
    card.append(node('p', `Counted sources: ${r.direct.samples} direct · ${r.webcam.samples} webcam-reviewed`));
    card.append(node('p', r.readiness));
    if (r.candidate) {
      const c = r.candidate;
      card.append(node('p', `Candidate threshold ${c.threshold} · later holdout: ${Math.round(c.proposed.balancedAccuracy * 100)}% vs baseline ${Math.round(c.baseline.balancedAccuracy * 100)}%. ${c.improvesHoldout ? 'Improved on this holdout; review before any change.' : 'No held-out improvement; retain baseline.'}`));
    }
    reports.append(card);
  }
  table(document.querySelector('#predictions'), ['Neighborhood', 'Saved', 'Check around', 'Index'], data.recent.map(p => [name(p.stationId), at(p.issuedAt), at(p.targetAt), `${p.low}–${p.high} / 100`]));
  table(document.querySelector('#labels'), ['Neighborhood', 'Observed', 'Result', 'Source', 'Notes'], data.labels.map(l => [name(l.stationId), at(l.observedAt), l.outcome.replaceAll('_', ' '), l.source.replaceAll('_', ' '), l.notes]));
  return data;
}
form.addEventListener('submit', async event => {
  event.preventDefault(); const button = form.querySelector('button'); button.disabled = true;
  try {
    const data = Object.fromEntries(new FormData(form));
    data.observedAt = new Date(data.observedAt).toISOString();
    data.frameAt = data.frameAt ? new Date(data.frameAt).toISOString() : null;
    data.locationConfirmed = form.elements.locationConfirmed.checked;
    await api('review', data);
    status.textContent = 'Observation saved. Loading updated verification…';
    await load(); status.textContent = 'Observation saved and verification updated. Live model unchanged.';
  } catch (error) { status.textContent = error.message; }
  finally { button.disabled = false; }
});
document.querySelector('#sample').addEventListener('click', async event => {
  const button = event.currentTarget; button.disabled = true;
  try { const result = await api('sample', {}); status.textContent = `${result.saved} station predictions saved. Check the target times below.`; await load(); }
  catch (error) { status.textContent = error.message; } finally { button.disabled = false; }
});
load().then(() => { status.textContent = 'Ready. Record only conditions you actually observed.'; }).catch(error => { status.textContent = error.message; });
