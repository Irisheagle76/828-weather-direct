const format = (value, unit = '', digits = 1) => Number.isFinite(value) ? `${value.toFixed(digits)}${unit}` : 'Unavailable';

export function stationProfileCards(observation = {}, now = Date.now()) {
  const o = observation;
  const direction = Number.isFinite(o.windDirectionDeg)
    ? ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'][Math.round(((o.windDirectionDeg % 360 + 360) % 360) / 22.5) % 16]
    : null;
  const cards = [
    {
      kind: 'conditions',
      label: 'Temperature',
      value: format(o.temperatureF, '°F'),
      dewPoint: format(o.dewPointF, '°F'),
      humidity: format(o.humidityPct, '%', 0)
    },
    { label: 'Wind', value: `${format(o.windMph, ' mph')}${direction && o.windMph > 0 ? ` from ${direction}` : ''}`, detail: `Gust ${format(o.windGustMph, ' mph')}` },
    { label: 'Sea-level pressure', value: format(o.seaLevelPressureMb, ' hPa'), detail: '' },
    { label: 'Rain today', value: format(o.precipitationTodayIn, ' in', 2), detail: '' }
  ];
  if (Number.isFinite(o.uvIndex) && o.uvIndex > 0) cards.push({ label:'UV index', value:format(o.uvIndex), detail:'' });
  const observedAt = Date.parse(o.observedAt);
  const fresh = Number.isFinite(observedAt) && now - observedAt <= 180_000 && observedAt <= now + 60_000;
  const strikeAt = o.lightningStrikeLastAt;
  const recent = Number.isFinite(strikeAt) && now - strikeAt <= 15 * 60_000 && strikeAt <= now;
  if (fresh && (o.lightningStrikeCount > 0 || recent)) {
    cards.push({ label:'Recent lightning', value:Number.isFinite(o.lightningStrikeDistanceMi) ? `${format(o.lightningStrikeDistanceMi, ' mi')} away` : 'Detected',
      detail: recent ? `Last detected ${Math.floor((now - strikeAt) / 60_000)} min ago` : `${Math.round(o.lightningStrikeCount)} ${o.lightningStrikeCount === 1 ? 'detection' : 'detections'} this report` });
  }
  return cards;
}
