import { FEELSCORE_CALIBRATION } from './comfort.js';

const number = value => value == null || value === '' ? null : Number.isFinite(Number(value)) ? Number(value) : null;

export function comfortExplanation({ currentHour = {}, forecastHour = {}, precipOverride = null, score = null } = {}) {
  const temperature = number(currentHour.temperatureF ?? forecastHour.temperatureF);
  const dew = number(currentHour.dewpointF ?? currentHour.dewPoint ?? forecastHour.dewpointF);
  const wind = number(currentHour.windSpeed ?? forecastHour.windSpeed);
  const gust = number(currentHour.windGust ?? forecastHour.windGust);
  const parts = [];
  const { idealMinF, idealMaxF } = FEELSCORE_CALIBRATION.temperature;
  if (temperature != null) parts.push(temperature < 45 ? 'Cold air' : temperature < idealMinF ? 'Cool temperatures' : temperature <= idealMaxF ? 'Mild temperatures' : temperature < 85 ? 'Warm temperatures' : 'Hot temperatures');
  if (dew != null) parts.push(dew < FEELSCORE_CALIBRATION.dewpoint.noticeableF ? 'manageable humidity' : dew < FEELSCORE_CALIBRATION.dewpoint.veryMuggyF ? 'noticeable humidity' : 'muggy air');
  if (wind != null) parts.push(gust >= 25 ? 'strong gusts' : wind < 4 ? 'very little wind' : wind < 10 ? 'a light breeze' : 'breezy conditions');
  const rain = precipOverride?.mode === 'active';
  if (!parts.length) return { title: 'Why it feels this way', text: rain ? 'Rain is affecting outdoor comfort right now.' : 'Waiting for current weather readings.' };
  const joined = parts.length < 3 ? parts.join(' and ') : `${parts.slice(0, -1).join(', ')}, and ${parts.at(-1)}`;
  const good = !rain && number(score) >= FEELSCORE_CALIBRATION.scoreBands.pleasant;
  return {
    title: good ? 'Why it feels good' : 'Why it feels this way',
    text: `${joined} ${parts.length === 1 ? 'is' : 'are'} ${good ? 'keeping it comfortable' : 'affecting comfort outside'}.${rain ? ' Rain is affecting outdoor plans, even if the air feels mild.' : ''}`
  };
}

export function bestWindowSummary(model, now = Date.now()) {
  const best = model?.best;
  if (!Number.isFinite(best?.start) || !Number.isFinite(best?.end) || !Number.isFinite(best?.peak)) return null;
  const zone = 'America/New_York';
  const dateKey = time => new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(time);
  const clock = time => new Intl.DateTimeFormat('en-US', { timeZone: zone, hour: 'numeric' }).format(time);
  const today = dateKey(now);
  // A local calendar date, not a 24-hour offset, keeps Tomorrow correct across DST.
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = type => Number(parts.find(item => item.type === type).value);
  const tomorrowDate = new Date(Date.UTC(part('year'), part('month') - 1, part('day') + 1));
  const tomorrow = tomorrowDate.toISOString().slice(0, 10);
  const dayLabel = time => dateKey(time) === today ? 'Today' : dateKey(time) === tomorrow ? 'Tomorrow' : new Intl.DateTimeFormat('en-US', { timeZone: zone, weekday: 'short' }).format(time);
  const sameDate = dateKey(best.start) === dateKey(best.end);
  const window = sameDate ? `${dayLabel(best.start)}, ${clock(best.start)}–${clock(best.end)}` : `${dayLabel(best.start)}, ${clock(best.start)}–${dayLabel(best.end)} ${clock(best.end)}`;
  const peak = Math.round(best.peak);
  const bands = FEELSCORE_CALIBRATION.scoreBands;
  const label = peak >= bands.ideal ? 'Ideal' : peak >= bands.pleasant ? 'Pleasant' : peak >= bands.noticeable ? 'Noticeable' : peak >= bands.challenging ? 'Challenging' : 'Harsh';
  return { window, detail: `Peak FeelScore ${peak} · ${label}` };
}
