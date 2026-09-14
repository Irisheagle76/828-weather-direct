import { getForecastPeriod, validateForecast } from '../../public/js/se-feelscore-period.js';

const DATA_ROOT = 'https://raw.githubusercontent.com/Irisheagle76/828-weather-direct/main/public/data/feelscore';

export function createHandler({ fetchImpl = fetch, clock = () => new Date() } = {}) {
  let cached;
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method && req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).json({ error: 'Method not allowed' });
    }
    const now = clock();
    const period = getForecastPeriod(now);
    if (req.query?.date && req.query.date !== period.forecastDate) {
      return res.status(409).json({ error: 'Forecast period changed', ...period });
    }
    try {
      if (!cached || cached.data.forecastDate !== period.forecastDate || now - cached.loadedAt > 60_000) {
        const response = await fetchImpl(`${DATA_ROOT}/${period.forecastDate}.json`, {
          cache: 'no-store', signal: AbortSignal.timeout(20_000),
          headers: { Accept: 'application/json', 'User-Agent': '828-Weather-Direct-FEELSCORE' },
        });
        if (!response.ok) throw new Error(`Published forecast unavailable (${response.status})`);
        const data = validateForecast(await response.json(), period.forecastDate, now);
        cached = { data, loadedAt: now.getTime() };
      }
      validateForecast(cached.data, period.forecastDate, now);
      return res.status(200).json({ ...cached.data, displayPeriod: period.label });
    } catch (error) {
      console.error(JSON.stringify({ event: 'se_feelscore_error', forecastDate: period.forecastDate, message: error.message }));
      return res.status(503).json({ error: 'Fresh regional forecast temporarily unavailable', ...period });
    }
  };
}

export default createHandler();
