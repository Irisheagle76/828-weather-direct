# Mobile same-time-yesterday temperature

The additive GET `/api/router?route=tempest/temperature-comparison` endpoint uses the existing server-only `TEMPEST_TOKEN` and `TEMPEST_STATION_ID`. It reads the latest raw station observation, discovers that station's ST device via station metadata, and requests a 20-minute historical device window centered on yesterday at the same Asheville clock time. Tempest documentation: https://apidocs.tempestwx.com/reference/getobservationsbydeviceid

The shared calculation accepts the nearest valid observation within five minutes. Current observations older than 15 minutes are rejected. Missing data never becomes zero or forecast data. Both temperatures in the comparison are raw observations from the same station, rather than mixing yesterday's station reading with today's rounded Better Forecast temperature. The main current-condition fields keep their existing source.

Five-minute process and CDN caches plus in-flight deduplication limit repeated requests; station metadata is cached for an hour. Browser caching is also five minutes. There is no cron job, browser history collection, new provider, secret in client JavaScript, or production deployment. No stale-while-revalidate is used for the time-sensitive comparison.

## Local preview

From `C:\Users\Tim\828codeproject\828-weather-direct`, run:

```powershell
node --env-file=.env.local tools/mobile-preview/server.mjs
```

Open http://127.0.0.1:4174/mobile/ . Keep the server running. This local helper executes only the new comparison endpoint locally; existing weather endpoints continue to be read-only proxied to avlweather.com. The helper is now in the C-drive project and does not depend on the D-drive staging helper.

## Changed files for this addition

Created:
- `lib/tempest/temperature-comparison.js`: shared time matching and temperature calculation.
- `lib/api-routes/tempest/temperature-comparison.js`: cached, read-only provider integration.
- `tools/mobile-preview/server.mjs`: local preview supporting the undeployed endpoint.
- `test/tempest-temperature-comparison.test.js`: matching, DST, missing/stale data, delta, method, caching and token-exposure checks.
- `docs/mobile-temperature-comparison.md`: integration and local startup instructions.

Modified:
- `api/router.js`: one additive route registration; existing routes unchanged.
- `public/mobile/index.html`: replace the unavailable placeholder with comparison output elements.
- `public/mobile/mobile.js`: independently load and render the comparison without delaying core dashboard data.

The preceding pressure addition modified mobile CSS; this history addition does not change CSS or production HTML. Existing unrelated worktree changes are preserved.
