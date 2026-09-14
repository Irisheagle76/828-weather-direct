// The regional product rolls over together on Asheville's Eastern clock.
export function getForecastPeriod(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', hourCycle: 'h23',
  }).formatToParts(now).map(({ type, value }) => [type, value]));
  const today = `${parts.year}-${parts.month}-${parts.day}`;
  const tomorrow = Number(parts.hour) >= 15;
  const date = new Date(`${today}T12:00:00Z`);
  if (tomorrow) date.setUTCDate(date.getUTCDate() + 1);
  return { forecastDate: date.toISOString().slice(0, 10), label: tomorrow ? 'Tomorrow' : 'Today' };
}

export function validateForecast(data, forecastDate, now = new Date()) {
  if (data?.forecastDate !== forecastDate) throw new Error('Forecast date does not match the requested map');
  const age = now.getTime() - Date.parse(data.generatedAt);
  if (!Number.isFinite(age) || age < -300_000 || age > 36 * 3600_000) throw new Error('Forecast data is stale');
  if (!Array.isArray(data.points) || data.points.length < 1000 || data.spacingDegrees !== 0.25
      || data.analysis?.landPointCount !== data.points.length || data.analysis?.missingPointCount !== 0
      || !data.bbox || !Array.isArray(data.qa?.anchorCities)) throw new Error('Regional grid is incomplete');
  const formatters = new Map();
  for (const point of data.points) {
    if (!Number.isFinite(point.lat) || !Number.isFinite(point.lon)
        || !Number.isInteger(point.finalCategory) || point.finalCategory < 0 || point.finalCategory > 5
        || point.hours?.length !== 4) throw new Error('Regional grid contains missing forecast points');
    if (!formatters.has(point.timezone)) formatters.set(point.timezone, new Intl.DateTimeFormat('en-CA', {
      timeZone: point.timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
    }));
    const localParts = formatters.get(point.timezone);
    for (let index = 0; index < 4; index++) {
      const hour = point.hours[index];
      const parts = Object.fromEntries(localParts.formatToParts(new Date(hour.validTime)).map(({ type, value }) => [type, value]));
      if (hour.localTime !== `${12 + index}:00` || Number(parts.hour) !== 12 + index
          || `${parts.year}-${parts.month}-${parts.day}` !== forecastDate) throw new Error('Forecast window is not noon–3 PM local');
    }
  }
  return data;
}
