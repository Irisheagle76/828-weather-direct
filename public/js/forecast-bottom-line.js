const local = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
});
const timers = new WeakMap();

export function bottomLineForNow(forecast, now = new Date()) {
  const p = Object.fromEntries(local.formatToParts(now).map(({type, value}) => [type, value]));
  const key = [p.year, p.month, p.day].join('-');
  const note = forecast?.todayBottomLine;
  const text = note?.date === key ? note.text : forecast?.days?.[key]?.bottomLine;
  const seconds = (15 - Number(p.hour)) * 3600 - Number(p.minute) * 60 - Number(p.second);
  return seconds > 0 && typeof text === 'string' && text.trim()
    ? { text: text.trim(), remainingMs: seconds * 1000 - now.getMilliseconds() } : null;
}

export function showBottomLine(card, forecast) {
  if (!card) return;
  clearTimeout(timers.get(card));
  const line = bottomLineForNow(forecast);
  card.hidden = !line;
  card.querySelector('p').textContent = line?.text || '';
  if (line) timers.set(card, setTimeout(() => showBottomLine(card, forecast), line.remainingMs));
}
