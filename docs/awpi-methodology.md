# Asheville Winter Pattern Index 1.0 Experimental

This release integrates a new `/awpi.html` page, `/api/router?route=awpi/current` and authenticated `/api/router?route=awpi/refresh` into the existing site. It uses NOAA GEFS ensemble forecasts delivered by Open-Meteo and NOAA CPC observations. It is not a reproduction of the historical teleconnection regression model.

## Calculations

All scores are explicit, uncalibrated heuristics. Per member and local calendar day:

- Cold: `100 * clamp((5 - dailyMeanTemperatureC) / 10, 0, 1)`.
- Storm: `100 * clamp(dailyPrecipitationMm / 10, 0, 1)`. A local wet-weather proxy, not a diagnosed jet or storm track.
- Snow: `100 * clamp(coincidentSnowCm / 2.54, 0, 1)`. Sum modeled snowfall only for hours where the same member has temperature <=2°C and precipitation >0 mm. Never combine cold from one member/time with moisture from another.

Average member scores only when at least 10 and 80% of all listed members have complete daily fields. Scores remain null on insufficient coverage. Missing, null, physically out-of-range values and unexpected units are rejected. Daily totals allow 23–25 hours for daylight-saving transitions. Fourteen local calendar days start today, including elapsed hours on today’s date. Cards and lead windows require complete constituent scores and show their maximum daily ensemble score, not a probability of any event in the window. Peak dates include ties; confidence is the lowest confidence among tied peak dates. A zero peak has no event date. Favorable stretches are consecutive days with scores >=60 (the existing favorable category), with duration and dates displayed. Each day is averaged across members before selecting a peak; member maxima from different dates are never combined. Cached assessments are re-summarized from their saved daily scores, preserving original forecast timestamps.

Confidence is Moderate at most during days 1–5, Low when daily mean member temperature range exceeds 8°C, and Low for days 6–14. These confidence categories are heuristic, not estimated forecast reliability. One model family is not independent multi-model agreement. No calibrated snow probabilities, climate-normal anomalies, upper-air storm diagnosis, ENSO-expression score or stratospheric disruption score is claimed.

## Sources and storage

- Ensemble documentation: https://open-meteo.com/en/docs/ensemble-api
- CPC AO/NAO/PNA: https://ftp.cpc.ncep.noaa.gov/cwlinks/
- RONI ERSSTv6: https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso/roni/
- Monthly Niño 3.4 SST anomaly: https://www.cpc.ncep.noaa.gov/data/indices/sstoi.indices

Forecast retrieval is cached for 3 hours. Climate sources are cached for 24 hours. Source timestamps and stale status remain visible. AO/NAO/PNA older than 5 days, RONI older than 100 days and Niño 3.4 older than 75 days are marked stale. RONI seasons ending after retrieval time are excluded; classification uses five consecutive seasonal values beyond ±0.5°C and is explicitly an index criterion rather than an official ENSO advisory. Recent RONI values may be revised. The historical packages use transcribed RONI v5; do not silently substitute live v6 values for reproduction.

Existing KV storage is reused for snapshots, with a 45-day expiry and one saved assessment per local day. This requires existing `KV_REST_API_URL` and `KV_REST_API_TOKEN` in the deployment environment. Local memory fallback is disclosed and cannot claim durable history. The refresh route returns a failure if persistence is not durable. Snapshot changes compare matching valid dates, requiring at least five common days. No history or trends are fabricated before snapshots accumulate.

An authenticated Vercel cron calls refresh at 10:30 UTC (5:30 a.m. EST / 6:30 a.m. EDT). `CRON_SECRET` is required. Public reads can refresh an expired cache. A failed source refresh preserves the prior assessment, its dates and calculation timestamp, explicitly labeling it stale. The ensemble response does not expose initialization time, so only retrieval time is reported. No dates are shifted to make older predictions look current.

## Recovered research and audit

Original ZIPs and extracted files are preserved outside production source. `scripts/audit-awpi-hindcast.mjs` recomputes Brier scores from the original prediction tables with matched case dates and outcomes. This is score verification, not an independent model refit or bootstrap replication. No new 2015–2024 outcome evaluation is performed for model selection.

Important corrections to the ChatGPT handoff:

1. v0.4 evaluates 2000–2024 starting winters. Although v0.5 evaluates only 2000–2014, the late period is not untouched across the research history. Independent validation needs a clearly documented unexamined period or prospective forecasts.
2. The v0.5 report describes full-period thresholds for every horizon, but its imported v0.4 code actually uses 1 inch precipitation / 0.5 inch snowfall for seven days and 2 inches / 1 inch for fourteen days. The report wording is inconsistent with the implementation.
3. `awpi_hindcast_v03.read_station_wide` discards attributes and does not reject NOAA quality-flagged observations. Preserve the historical implementation for reproduction, but do not describe it as quality-controlled.
4. Retrospective index revisions and approximate RONI availability prevent a strict vintage-real-time evaluation.
5. The v0.5 +8.47% first-week cold result concerns a different regression model and cannot validate this dashboard's heuristics. No fixed weighting is inferred from those Brier skill scores.

## Release

Run the AWPI tests and the full repository suite, check actual upstream responses, and inspect desktop/mobile behavior and missing-source states. The repository's production gate remains in force: stage from current main, include required fixes, verify the staged build, then explicitly approve promotion. Keep custom-domain auto-assignment disabled. No unrelated local experiments belong in the AWPI release.

## Homepage release — November 10, 2026

The homepage introduces AWPI with a compact winter-pattern card and a link to the complete outlook. All three indicators refer to the same date: the highest daily snow-support score, breaking ties by cold support and then earliest date. This is a highlight, not a prediction of an event. Saved assessments retain their original timestamps; missing and stale guidance are explicitly labeled. The full page retains daily scores, timing, confidence, source freshness, and experimental-method limitations.
