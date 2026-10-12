// Date-only rainfall records have no timezone. Spell out the month for US readers.
export function rainfallDate(value) {
  const match = String(value || '').match(/^(\d{4})(\d{2})(\d{2})$/);
  if (!match) return '--';
  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return '--';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(date);
}

export function headlineForPulse(pulse = {}, plainText = '') {
  const title = String(pulse.headline || pulse.title || '').trim();
  if (title && !/^(828\s+)?weather\s+pulse$/i.test(title)) return title;
  const text = String(plainText).replace(/\s+/g, ' ').trim();
  if (!text) return 'Local weather update';
  const sentence = text.match(/^.*?[.!?](?=\s|$)/)?.[0] || text;
  if (sentence.length <= 110) return sentence;
  return `${sentence.slice(0, 107).replace(/\s+\S*$/, '').trimEnd()}…`;
}
