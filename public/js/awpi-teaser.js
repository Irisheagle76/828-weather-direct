const finite = n => typeof n === 'number' && Number.isFinite(n);
const label = n => !finite(n) ? 'Unavailable' : ['Very low', 'Low', 'Mixed', 'Favorable', 'Strong'][Math.min(4, Math.floor(n / 20))];
export function teaser(data) {
  const days = (data.days || []).filter(d => ['cold','storm','snow'].every(k => finite(d[k])));
  if (!days.length) return null;
  // Choose one date; never combine independent component maxima.
  const day = days.reduce((best, d) => d.snow > best.snow || (d.snow === best.snow && d.cold > best.cold) ? d : best);
  const stale = data.stale || data.status === 'stale' || day.date < new Intl.DateTimeFormat('en-CA', {timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  return { day, stale, headline: stale ? 'Previous outlook — check the full assessment for updates.' : day.snow >= 60 ? 'A snow-support signal worth watching.' : day.snow >= 20 ? 'Some winter ingredients, with uncertainty.' : 'Limited snow support in the current guidance.' };
}
export function renderTeaser(data, root) {
  const result = teaser(data);
  if (!result) {
    root.querySelector('[data-awpi-headline]').textContent = 'Current guidance is unavailable.';
    root.querySelector('[data-awpi-date]').textContent = 'Explore how the index works and check for updates.';
    root.querySelector('[data-awpi-meta]').textContent = 'Experimental guidance · Not a weather alert';
    return;
  }
  const {day, stale, headline} = result;
  root.querySelector('[data-awpi-headline]').textContent = headline;
  const format = new Intl.DateTimeFormat('en-US', {month:'short',day:'numeric',timeZone:'America/New_York'});
  root.querySelector('[data-awpi-date]').textContent = 'Highlighted date: ' + format.format(new Date(day.date+'T12:00:00Z')) + ' · ' + day.confidence + ' confidence';
  for (const key of ['cold','storm','snow']) root.querySelector('[data-awpi-'+key+']').textContent = label(day[key]);
  const stamp = data.generatedAt ? new Date(data.generatedAt).toLocaleString('en-US', {month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short',timeZone:'America/New_York'}) : 'Unknown';
  root.querySelector('[data-awpi-meta]').textContent = 'Experimental guidance · Not a weather alert · ' + (stale ? 'Older assessment: ' : 'Calculated ') + stamp + (data.refreshing ? ' · Updating…' : '');
}
if (typeof document !== 'undefined') {
  const root = document.querySelector('#awpi-preview');
  if (root) {
    const load = async () => {
      const response = await fetch('/api/router?route=awpi/current', {signal:AbortSignal.timeout(45000),cache:'no-store'});
      const data = await response.json();
      renderTeaser(data, root);
      return data;
    };
    load().then(data => {
      if (data.refreshing) setTimeout(() => load().catch(() => {}), 20000);
    }).catch(() => renderTeaser({}, root));
  }
}
