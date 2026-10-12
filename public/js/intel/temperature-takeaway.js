export function buildTemperatureTakeaway(slots = []) {
  const current = slots.find(slot => slot.label === 'Now');
  const future = slots.filter(slot => slot !== current && Number.isFinite(slot?.hour?.temperatureF)).at(-1);
  if (!future || !Number.isFinite(current?.hour?.temperatureF)) return null;
  const temperature = Math.round(future.hour.temperatureF);
  const difference = temperature - Math.round(current.hour.temperatureF);
  const timing = /^Tomorrow /i.test(future.label)
    ? `tomorrow ${future.label.replace(/^Tomorrow /i, '')}`
    : future.label;
  const change = Math.abs(difference) >= 3
    ? `, ${difference < 0 ? 'down' : 'up'} ${Math.abs(difference)}° from now`
    : ', close to the temperature now';
  return { emoji: '🌡️', text: `Heading out later? Expect around ${temperature}° by ${timing}${change}.` };
}
