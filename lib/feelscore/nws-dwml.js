import { XMLParser } from 'fast-xml-parser';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseTagValue: true,
  trimValues: true,
});

const asArray = (value) => value == null ? [] : Array.isArray(value) ? value : [value];

function timeLayouts(data) {
  return new Map(asArray(data['time-layout']).map((layout) => [
    String(layout['layout-key']),
    asArray(layout['start-valid-time']).map(String),
  ]));
}

function numericValues(parameter) {
  return asArray(parameter?.value).map((value) => {
    const raw = typeof value === 'object' ? value['#text'] : value;
    if (raw == null || raw === '') return null;
    const numeric = Number(raw);
    return Number.isFinite(numeric) ? numeric : null;
  });
}

function weatherValues(parameter) {
  return asArray(parameter?.['weather-conditions']).map((condition) => {
    const summary = condition?.['@_weather-summary'] || '';
    const values = asArray(condition?.value);
    const primary = values[0] || {};
    return {
      summary,
      coverage: primary['@_coverage'] || '',
      type: primary['@_weather-type'] || '',
      intensity: primary['@_intensity'] || '',
      qualifier: primary['@_qualifier'] || '',
    };
  });
}

function valueAtInstant(parameter, layouts, instant, transform = numericValues) {
  if (!parameter) return null;
  const times = layouts.get(String(parameter['@_time-layout'])) || [];
  const values = transform(parameter);
  if (!times.length || !values.length) return null;
  const target = instant.getTime();
  let best = -1;
  for (let index = 0; index < times.length; index += 1) {
    const value = Date.parse(times[index]);
    if (Number.isFinite(value) && value <= target) best = index;
  }
  if (best < 0) return null;
  const ageHours = (target - Date.parse(times[best])) / 3_600_000;
  if (ageHours > 12) return null;
  return values[best] ?? null;
}

function coverageProbability(coverage) {
  const normalized = String(coverage || '').toLowerCase();
  if (!normalized || normalized === 'none') return 0;
  if (normalized.includes('slight chance')) return 20;
  if (normalized.includes('chance')) return 40;
  if (normalized.includes('likely')) return 60;
  if (normalized.includes('definite')) return 80;
  if (normalized.includes('isolated')) return 20;
  if (normalized.includes('scattered')) return 40;
  if (normalized.includes('numerous')) return 60;
  return null;
}

function localHourInstant(layouts, date, hour, locationOffsetHint) {
  const prefix = `${date}T${String(hour).padStart(2, '0')}:00:00`;
  for (const times of layouts.values()) {
    const match = times.find((time) => time.startsWith(prefix) && (!locationOffsetHint || time.endsWith(locationOffsetHint)));
    if (match) return new Date(match);
  }
  return null;
}

function offsetForLocation(parameters, layouts, date) {
  const candidates = [parameters.temperature, parameters['wind-speed'], parameters['cloud-amount']].flatMap(asArray);
  for (const parameter of candidates) {
    const times = layouts.get(String(parameter?.['@_time-layout'])) || [];
    const match = times.find((time) => time.startsWith(`${date}T12:00:00`));
    if (match) return match.slice(-6);
  }
  return null;
}

function parameterByType(parameters, key, type) {
  return asArray(parameters[key]).find((item) => !type || item?.['@_type'] === type) || null;
}

export function parseDwmlBatch(xml, requestedPoints, forecastDate) {
  const document = parser.parse(xml);
  const data = document?.dwml?.data;
  if (!data) throw new Error('NWS response did not contain DWML data');
  const layouts = timeLayouts(data);
  const locations = asArray(data.location);
  const parameterSets = asArray(data.parameters);

  return requestedPoints.map((requested, index) => {
    const location = locations[index] || {};
    const key = String(location['location-key'] || `point${index + 1}`);
    const parameters = parameterSets.find((set) => String(set['@_applicable-location']) === key) || parameterSets[index] || {};
    const offset = offsetForLocation(parameters, layouts, forecastDate);
    const temperature = parameterByType(parameters, 'temperature', 'hourly');
    const dewPoint = parameterByType(parameters, 'temperature', 'dew point');
    const wind = parameterByType(parameters, 'wind-speed', 'sustained');
    const gust = parameterByType(parameters, 'wind-speed', 'gust');
    const sky = parameterByType(parameters, 'cloud-amount', 'total');
    const weather = parameters.weather;
    const qpf = parameterByType(parameters, 'precipitation', 'liquid');

    const hours = [12, 13, 14, 15].map((hour) => {
      const instant = localHourInstant(layouts, forecastDate, hour, offset);
      if (!instant) return { localTime: `${hour}:00`, missing: true };
      const wx = valueAtInstant(weather, layouts, instant, weatherValues) || {};
      const coverageProbabilityPct = coverageProbability(wx.coverage);
      const weatherText = [wx.summary, wx.coverage, wx.type, wx.intensity, wx.qualifier].filter(Boolean).join(' · ');
      const thunder = /thunder/i.test(weatherText);
      const precipitationAmount = valueAtInstant(qpf, layouts, instant);
      const precipExpected = Boolean((Number.isFinite(precipitationAmount) && precipitationAmount > 0) || /rain|showers|drizzle/i.test(weatherText));
      return {
        localTime: `${String(hour).padStart(2, '0')}:00`,
        validTime: instant.toISOString(),
        temperatureF: valueAtInstant(temperature, layouts, instant),
        dewPointF: valueAtInstant(dewPoint, layouts, instant),
        windMph: valueAtInstant(wind, layouts, instant),
        gustMph: valueAtInstant(gust, layouts, instant),
        skyCoverPct: valueAtInstant(sky, layouts, instant),
        precipProbabilityPct: precipExpected ? coverageProbabilityPct : 0,
        precipProbabilitySource: precipExpected ? 'inferred-from-NDFD-weather-coverage' : 'no-precipitation-weather-code',
        precipExpected,
        precipCoverage: String(wx.coverage || '').toLowerCase(),
        precipitationAmountIn: precipitationAmount,
        weather: weatherText,
        thunder,
        thunderProbabilityPct: thunder ? coverageProbabilityPct : 0,
        thunderProbabilitySource: thunder ? 'inferred-from-NDFD-weather-coverage' : 'no-thunder-weather-code',
      };
    });

    return { ...requested, nwsLocationKey: key, sourceCoordinates: location.point || null, hours };
  });
}
