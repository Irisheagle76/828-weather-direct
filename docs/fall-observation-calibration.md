# Fall Explorer observation calibration

The Fall Explorer uses NOAA/NWS forecast grids as its public forecast source. Local observations are currently **shadow diagnostics only**: they measure forecast residuals and terrain behavior but do not change displayed forecast temperatures, freeze thresholds, rankings, or cold-pool guidance.

## Runtime endpoints

- `GET /api/router?route=observations/elevation` returns the cached normalized network and station health.
- `GET /api/router?route=observations/calibration` summarizes retained shadow samples when KV is configured.
- `GET /api/router?route=observations/sample` records a protected calibration sample and evaluates seasonal cold milestones; it requires `Authorization: Bearer $CRON_SECRET`.
- `GET /api/router?route=fall` fetches NOAA guidance, consumes the live observation service, and records one shadow batch when it rebuilds its ten-minute cache.

The hiking-guidance GitHub workflow calls the protected sampler hourly. GitHub scheduling is best-effort, so actual intervals can be longer than one hour.

## Seasonal cold milestones

From August through December, the protected sampler evaluates fresh, direct-live observations for the 2,000–3,000, 3,000–4,000, 4,000–5,000, 5,000–6,000, 6,000+ foot and Asheville valley bands. It stores the first confirmed ≤40°F, ≤36°F, ≤32°F and ≤28°F event for each band in KV without an expiration. The archive records its activation time; the initial 2026 archive is intentionally described as tracking from activation because no historical station replay is available. Future archives begin automatically with the first scheduled sample from August onward.

A milestone requires either two independent eligible stations in the same band during one run or two consecutive qualifying samples from the same station, separated by at least 20 minutes and no more than three hours. Fallback observations, health-blocked readings, forecast-residual outliers and anchors with effective weight below 0.5 are excluded. Once recorded, a seasonal milestone is immutable; the archive retains its station, observation time, temperature and confirmation evidence.

## Required secrets

- `WEATHERFLOW_API_KEY`
- `WEATHER_UNDERGROUND_API_KEY` (Vercel may use the existing alias `WU_API_KEY`)
- `CRON_SECRET`

Provider values must exist in GitHub Actions and Vercel environments. Do not commit them to source or a tracked `.env` file. The former keys existed in repository history and should be rotated at the providers when practical.

## Quality controls

Readings are checked for freshness, future timestamps, missing temperature, physical ranges, dew point consistency, and abrupt short-period jumps. Provider failures fall back station-by-station to the last normalized artifact or warm-memory last-good data. Fallback and suspect readings receive reduced effective weight.

The Mountain Air runway pair is combined into one logical observation to avoid double-counting colocated evidence.

## Shadow sample contents

Each comparison records station and destination IDs, terrain role, elevation, observed and forecast temperature, residual, observed humidity and wind, forecast cloud and wind, local hour, weather regime, health state, comparison method, and base/effective weights.

KV retains up to 14 days at a nominal ten-minute cadence with a 30-day expiration. When KV is unavailable, the same batches remain visible as structured `fall_observation_shadow` runtime logs.

## Promotion criteria

Do not enable forecast correction automatically. Review a station only after it has at least:

- 100 total usable comparisons;
- 25 nighttime comparisons;
- representation across radiational, cloudy, windy, and mixed regimes where possible;
- stable bias without unexplained jumps or siting-related discontinuities.

After 7–14 days, calculate bias and error by station, local hour, lead time, and weather regime. Any future correction should be capped, decay with forecast lead time, preserve NOAA as the baseline, and be removable through a feature flag. Cameras remain the next ground-truth layer for actual foliage color, fog, visibility, and leaf loss.
