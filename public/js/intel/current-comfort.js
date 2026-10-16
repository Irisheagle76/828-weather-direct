import { calculateComfort, FEELSCORE_CALIBRATION } from './comfort.js';
import { forecastComfortCopy } from './forecast-comfort-context.js';
import { getCurrentPrecipOverride, applyPrecipOverrideToNarrative } from './precip-override.js';
import { buildComfortCurveModel } from '../visuals/comfort-curve.js';
import { bestWindowSummary } from './feelscore-insight.js';

export const COMFORT_REFRESH_MS = 60000;
const number = value => value == null || value === '' ? null : Number.isFinite(Number(value)) ? Number(value) : null;
const timestamp = value => {
  if (value == null || value === '') return null;
  const n = number(value);
  const time = n == null ? Date.parse(value) : n < 1e12 ? n * 1000 : n;
  return Number.isFinite(time) ? time : null;
};
const fahrenheit = value => number(value) == null ? null : number(value) * 9 / 5 + 32;
const mph = value => number(value) == null ? null : number(value) * 2.237;

export function normalizeComfortHour(hour) {
  if (!hour) return null;
  const time = timestamp(hour.timestamp ?? hour.time ?? hour.ts);
  if (time == null) return null;
  const temperatureF = number(hour.temperatureF ?? hour.temp ?? hour.temperature);
  const relativeHumidity = number(hour.relativeHumidity ?? hour.relative_humidity ?? hour.rh ?? hour.humidity);
  let dewpointF = number(hour.dewpointF ?? hour.dewPoint);
  if (dewpointF == null && temperatureF != null && relativeHumidity > 0 && relativeHumidity <= 100) {
    const c = (temperatureF - 32) * 5 / 9;
    const gamma = Math.log(relativeHumidity / 100) + 17.625 * c / (243.04 + c);
    dewpointF = 243.04 * gamma / (17.625 - gamma) * 9 / 5 + 32;
  }
  return { ...hour, ts: time, timestamp: time, temperatureF, dewpointF, relativeHumidity,
    windSpeed: number(hour.windSpeed ?? hour.wind ?? hour.wind_speed) ?? 0,
    windGust: number(hour.windGust ?? hour.wind_gust),
    precipAmount: number(hour.precipAmount ?? hour.precipitation) ?? 0,
    precipProbability: number(hour.precipProbability ?? hour.precipitation_probability) ?? 0,
    cloudCover: number(hour.cloudCover ?? hour.cloud_cover ?? hour.cloudcover),
    weatherCode: number(hour.weatherCode ?? hour.weather_code)
  };
}

export function normalizeComfortObservation(current) {
  if (!current) return null;
  return normalizeComfortHour({ ...current,
    timestamp: current.timestamp ?? current.observedAt ?? current.time,
    temperatureF: number(current.temperatureF ?? current.tempF ?? current.temp ?? current.temperature) ?? fahrenheit(current.air_temperature),
    dewpointF: number(current.dewpointF ?? current.dewPoint ?? current.dew_point_f) ?? fahrenheit(current.dew_point),
    windSpeed: number(current.windSpeed ?? current.wind ?? current.wind_speed) ?? mph(current.wind_avg),
    windGust: number(current.windGust ?? current.wind_gust_mph) ?? mph(current.wind_gust)
  });
}

export function comfortScore100(hour) {
  // Missing values must not become a 0°F temperature or dew point via Number(null).
  if (number(hour?.temperatureF) == null || number(hour?.dewpointF ?? hour?.dewPoint) == null) return null;
  const score = calculateComfort(hour)?.score;
  return Number.isFinite(score) ? Math.round(score * 10) : null;
}

export function comfortScoreLabel(score) {
  if (!Number.isFinite(score)) return 'Updating';
  const bands = FEELSCORE_CALIBRATION.scoreBands;
  return score >= bands.ideal ? 'Ideal' : score >= bands.great ? 'Great' : score >= bands.pleasant ? 'Pleasant' : score >= bands.noticeable ? 'Noticeable' : score >= bands.challenging ? 'Challenging' : 'Harsh';
}

export function upcomingComfortHours(hourly, currentHour, now = Date.now()) {
  const future = hourly.filter(h => h.timestamp >= now - 30 * 60000 && h.temperatureF != null).slice(0, 6);
  if (currentHour && future.length && Math.abs(future[0].timestamp - currentHour.timestamp) < 20 * 60000) {
    future[0] = { ...future[0], ...currentHour, timestamp: future[0].timestamp };
  }
  return future;
}

// All platforms pass the same weather API payload into this model. The score
// describes now; the separate outlook and curve describe the coming hours.
export function buildCurrentComfort(weather = {}, options = {}) {
  const { now = Date.now(), forecast = {}, storm = {}, storage } = options;
  const hourly = (weather.hourly || []).map(normalizeComfortHour).filter(Boolean).sort((a, b) => a.timestamp - b.timestamp);
  const current = weather.current || weather.current_conditions || null;
  const observation = normalizeComfortObservation(current);
  const fresh = observation && now - observation.timestamp >= -60000 && now - observation.timestamp <= 20 * 60000;
  const forecastHour = hourly.filter(h => Math.abs(h.timestamp - now) <= 90 * 60000 && comfortScore100(h) != null)
    .sort((a, b) => Math.abs(a.timestamp - now) - Math.abs(b.timestamp - now))[0] || null;
  const currentHour = fresh && comfortScore100(observation) != null ? { ...observation, ts: now, timestamp: now } : forecastHour;
  const score = comfortScore100(currentHour);
  const precipOverride = options.precipOverride ?? getCurrentPrecipOverride({ current, hourly, now, storage,
    radar: storm?.radar, lightningCount: storm?.weather?.lightningCount });
  const outlook = forecastComfortCopy({ hourly, daily: weather.daily || [], forecast, now });
  const summary = applyPrecipOverrideToNarrative({ headline: outlook.headline, subHeadline: outlook.weatherNarrative, narrative: outlook.weatherNarrative }, precipOverride);
  const copy = { ...outlook, headline: summary.headline, weatherNarrative: summary.subHeadline, narrative: summary.narrative };
  const curve = buildComfortCurveModel({ hourly, daily: weather.daily || [], currentHour, now, score: comfortScore100 });
  return { score, label: comfortScoreLabel(score), source: currentHour === forecastHour ? forecastHour ? 'forecast' : 'unavailable' : 'observation',
    currentHour, forecastHour, hourly, copy, precipOverride, curve, best: bestWindowSummary(curve, now),
    nextHours: upcomingComfortHours(hourly, currentHour, now) };
}
