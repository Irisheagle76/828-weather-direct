// Approximate solar elevation, sufficient to exclude night/IR images from the
// daylight pixel classifier. Coordinates default to central Asheville.
export function solarElevation(now, latitude = 35.5951, longitude = -82.5515) {
  const date = new Date(now), yearStart = Date.UTC(date.getUTCFullYear(), 0, 1);
  const day = Math.floor((now - yearStart) / 86400000) + 1;
  const minutes = date.getUTCHours() * 60 + date.getUTCMinutes();
  const gamma = 2 * Math.PI / ((date.getUTCFullYear() % 4 === 0 && (date.getUTCFullYear() % 100 !== 0 || date.getUTCFullYear() % 400 === 0)) ? 366 : 365) * (day - 1 + (minutes / 60 - 12) / 24);
  const equation = 229.18 * (0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma) - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma));
  const declination = 0.006918 - 0.399912 * Math.cos(gamma) + 0.070257 * Math.sin(gamma) - 0.006758 * Math.cos(2 * gamma) + 0.000907 * Math.sin(2 * gamma) - 0.002697 * Math.cos(3 * gamma) + 0.00148 * Math.sin(3 * gamma);
  const radians = Math.PI / 180, hourAngle = (minutes + equation + 4 * longitude) / 4 - 180;
  return Math.asin(Math.sin(latitude * radians) * Math.sin(declination) + Math.cos(latitude * radians) * Math.cos(declination) * Math.cos(hourAngle * radians)) / radians;
}

// Compass bearing clockwise from true north, using the same approximate
// declination and equation of time as the existing camera daylight gate.
export function solarPosition(now, latitude = 35.5951, longitude = -82.5515) {
  const date = new Date(now);
  const day = Math.floor((now - Date.UTC(date.getUTCFullYear(), 0, 1)) / 86400000) + 1;
  const minutes = date.getUTCHours() * 60 + date.getUTCMinutes();
  const gamma = 2 * Math.PI / ((date.getUTCFullYear() % 4 === 0 && (date.getUTCFullYear() % 100 !== 0 || date.getUTCFullYear() % 400 === 0)) ? 366 : 365) * (day - 1 + (minutes / 60 - 12) / 24);
  const equation = 229.18 * (0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma) - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma));
  const declination = 0.006918 - 0.399912 * Math.cos(gamma) + 0.070257 * Math.sin(gamma) - 0.006758 * Math.cos(2 * gamma) + 0.000907 * Math.sin(2 * gamma) - 0.002697 * Math.cos(3 * gamma) + 0.00148 * Math.sin(3 * gamma);
  const rad = Math.PI / 180;
  const hourAngle = ((minutes + equation + 4 * longitude) / 4 - 180) * rad;
  const azimuth = (Math.atan2(Math.sin(hourAngle), Math.cos(hourAngle) * Math.sin(latitude * rad) - Math.tan(declination) * Math.cos(latitude * rad)) / rad + 180 + 360) % 360;
  const elevation = solarElevation(now, latitude, longitude);
  return { azimuth, elevation, direction: ['N','NE','E','SE','S','SW','W','NW'][Math.round(azimuth / 45) % 8] };
}

export function sunPositionCard(now = Date.now(), timing = {}) {
  const sunrise = Number(timing.sunrise), sunset = Number(timing.sunset);
  const valid = sunrise > 0 && sunset > sunrise;
  const progress = valid ? Math.min(1, Math.max(0, (now - sunrise) / (sunset - sunrise))) : 0;
  const clock = value => value ? new Date(value).toLocaleTimeString('en-US', {timeZone:'America/New_York',hour:'numeric',minute:'2-digit'}) : 'Unavailable';
  const duration = ms => { const minutes = Math.max(0, Math.floor(ms / 60000)); return `${Math.floor(minutes / 60)}h ${minutes % 60}m`; };
  const x = 30 + progress * 340;
  const y = 150 - 420 * progress * (1 - progress);
  const message = !valid ? 'Sunrise and sunset timing unavailable.' : now < sunrise ? `Sunrise in ${duration(sunrise - now)}.` : now >= sunset ? 'The sun has set for today.' : `${duration(sunset - now)} of daylight left.`;
  return `<section class="panel daylight-curve"><p class="kicker">Sky &amp; Sunset</p><h2>Asheville Light Curve</h2><p>${message}</p><svg viewBox="0 0 400 180" role="img" aria-label="${valid ? `${Math.round(progress * 100)} percent of today's daylight elapsed` : 'Daylight timing unavailable'}"><defs><radialGradient id="lightSun"><stop stop-color="#ffe797"/><stop offset="1" stop-color="#ff961f"/></radialGradient></defs><path d="M30 150 Q65 45 120 45 H280 Q335 45 370 150" fill="none" stroke="#b9cde2" stroke-width="1"/><path d="M30 150 Q200 -60 370 150" fill="none" stroke="#f6b27b" stroke-width="3"/><path d="M30 150H370" stroke="#b9cde2"/>${valid && now >= sunrise && now < sunset ? `<circle cx="${x}" cy="${y}" r="10" fill="url(#lightSun)"/>` : ''}</svg><div class="light-endpoints"><div><strong>${clock(valid ? sunrise : null)}</strong><small>Sunrise</small></div><div><strong>${clock(valid ? sunset : null)}</strong><small>Sunset</small></div></div><div class="light-summary"><div><strong>${valid ? duration(sunset - sunrise) : 'Unavailable'}</strong><small>Daylight</small></div><div><strong>${timing.start && timing.end ? `${clock(timing.start)}–${clock(timing.end)}` : 'Unavailable'}</strong><small>Viewing window</small></div><div><strong>${valid ? `${Math.round(progress * 100)}%` : 'Unavailable'}</strong><small>Daylight elapsed</small></div></div><small>Sun marker shows progress through daylight, not measured height or brightness.</small></section>`;
}