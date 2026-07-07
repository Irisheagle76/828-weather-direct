# Automatic Forecast Vacation Mode

## Architecture

The automatic forecast reuses the Forecast Composer's live `forecast:manual:latest` KV record and the existing `/forecast.html` renderer. It does not create a second public forecast model. The pipeline discovers Asheville's current NWS forecast URLs from `/points/35.5951,-82.5515`, retrieves the point and hourly forecasts, and retrieves the latest Greenville-Spartanburg Area Forecast Discussion. Central derivation functions build all composer fields; deterministic language rules, style checks, and schema validation run before one atomic KV replacement.

Manual Composer publications remain available and are marked `manual`. Automatic publications are marked `automatic`, with source timestamps and internal review metadata. The public page does not display an automation label.

## Schedule and vacation window

Vercel Cron calls the protected route daily at `09:15 UTC` and `19:15 UTC`. In July these are exactly 5:15 AM and 3:15 PM EDT. The route separately enforces the configured absolute timestamps. Defaults allow runs from July 13 through the final 5:15 AM run on July 26, then stop at 8:00 AM EDT.

## Environment variables

Set these in the Vercel production environment:

```text
AUTO_FORECAST_ENABLED=true
AUTO_FORECAST_START=2026-07-13T00:00:00-04:00
AUTO_FORECAST_END=2026-07-26T08:00:00-04:00
AUTO_FORECAST_TIMEZONE=America/New_York
AUTO_FORECAST_MANUAL_OVERRIDE_HOURS=6
AUTO_FORECAST_LATITUDE=35.5951
AUTO_FORECAST_LONGITUDE=-82.5515
CRON_SECRET=<long random value>
```

`AUTO_FORECAST_ENABLED=false` is the immediate kill switch. To extend the trip, change `AUTO_FORECAST_END`; no code change is needed. `CRON_SECRET` is used by Vercel automatically for cron authorization and must not be committed.

## Manual override and failure safety

A manual publish is always accepted. Scheduled runs skip successfully when a manual forecast is less than six hours old. An authenticated admin can deliberately request an update, but even that update cannot publish outside the vacation window. Dry runs are allowed outside the window and never write live data.

Candidates are fully generated and validated before publication. NWS failure, incomplete hourly data, style failure, malformed fields, or a publication failure leaves the last known good forecast untouched. A short KV lock makes duplicate cron delivery idempotent.

## Admin use

Open `/admin/forecast/index.html` and use the **Automatic Forecast** panel:

- **Run Dry-Run Preview** fetches sources, builds and validates all fields, compares against the live forecast, and prints the candidate without publishing.
- **Run Authorized Update** requests a live run using the existing server-side admin session. It still obeys the vacation window.
- Status shows the window, latest result, source, manual shield, validation, and source freshness.

Arbitrary time injection is available only through module parameters in local tests; no production request parameter exposes it.

## Tests and logs

Run `npm test`. Unit tests use fixtures/dependency injection and do not call live NWS endpoints. Inspect production invocations and structured diagnostics in Vercel Function logs for the `forecast/automatic` route. Responses and logs contain no secrets.

## Rollback

Set `AUTO_FORECAST_ENABLED=false` first. For complete code rollback, remove both entries in `vercel.json`, the `forecast/automatic` router entry and middleware protection, the Automatic Forecast admin panel, and `lib/forecast/`. Manual Composer publishing and the public renderer remain otherwise unchanged.

## Known limitations

- NWS hourly products do not always provide explicit gusts; the gust field is marked not applicable when unsupported.
- The AFD is editorial context, not a machine-readable hazard feed. Severe wording is guarded and sets `needsReview`, but official warning links on the existing site remain the authority.
- Forecast periods beyond the available hourly horizon are rejected instead of being guessed.
