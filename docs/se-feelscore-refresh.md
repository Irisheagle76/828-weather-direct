# Southeast FEELSCORE live data

The map uses `/api/router?route=se-feelscore&date=YYYY-MM-DD`, not a deployment-bundled dataset. The legacy `/data/feelscore-grid.json` URL rewrites to the same live handler.

The requested date is today's Eastern calendar date before 15:00 and tomorrow's afterward. At Eastern midnight the same date becomes Today. Each map point still represents 12, 13, 14 and 15 hours in that point's local timezone. An open page refreshes on minute boundaries and when resumed.

The handler retrieves `public/data/feelscore/YYYY-MM-DD.json` from the public repository's current main branch. It validates the requested date, generation age (maximum 36 hours), dense 0.25-degree grid, zero missing points, and each point's local date/hours. It caches validated data in memory for at most one minute and sends `Cache-Control: no-store`. A missing or invalid forecast returns 503, never a different date's map.

The existing Daily Southeast FEELSCORE automation must generate **both today and tomorrow** at 6 AM Eastern. The existing generator in `C:\Users\Tim\828-weather-direct\scripts\generate-feelscore.mjs` supports:

```
node scripts/generate-feelscore.mjs --date=YYYY-MM-DD --force --batch-size=100 --require-complete --dated --output-dir=C:/Users/Tim/828-weather-direct-feelscore-publish/public/data/feelscore
```

Run once for each date. Validate both outputs using `validateForecast` from `public/js/se-feelscore-period.js` and the existing engine tests. Commit only the dated JSON/CSV files on current main. Data-only commits do not deploy the website or change deployment guards. The live endpoint sees them without a website release.

Keep the last three Eastern calendar dates plus tomorrow; only prune older ISO-date-named JSON/CSV within this data directory after both replacement forecasts validate. Do not delete unrelated files. Git history preserves past published maps.

If the desktop automation does not run, new forecasts will not be generated. The page reports unavailable data instead of hiding that failure. The generator's NWS download must never be run on page requests.
