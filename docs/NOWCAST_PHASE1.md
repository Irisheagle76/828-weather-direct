# 828 Nowcast Console — Phase 1

## Architecture

The existing project is a static HTML/CSS/JavaScript site deployed on Vercel, with ESM serverless routes dispatched through `api/router.js`. Admin pages are protected by the existing `828_admin_session` HttpOnly cookie in both middleware and server handlers. Tempest already supplies WeatherFlow observations. Phase 1 adds an official NWS client for the Asheville point because the existing forecast endpoint uses Open-Meteo rather than NWS. Existing Vercel KV is reused for durable bounded histories; an in-memory fallback keeps local development usable when KV is not configured.

## Phase 1 modules

- `lib/nowcast/config.js`: thresholds, cache intervals, location, and retention.
- `lib/nowcast/clients.js`: Tempest and official NWS retrieval/normalization.
- `lib/nowcast/logic.js`: deterministic changes, rain state, alert and forecast comparison, freshness, and console status.
- `lib/nowcast/draftBuilder.js`: rule-based 40–100 word drafts.
- `lib/nowcast/storage.js`: bounded KV histories and structured logs.
- `lib/nowcast/mocks.js`: the 14 required test scenarios.
- `lib/nowcast/service.js`: independent source orchestration and diagnostics.
- `lib/api-routes/nowcast/*`: authenticated console and draft endpoints.
- `public/admin/nowcast/*`: responsive private operations console.

Observation retention is 72 hours with a hard limit of 1,000 records. Forecasts retain 48 hours/48 records, alert snapshots 7 days/168 records, drafts 100 records, and logs 250 records.

## Environment

Copy `.env.example` to `.env.local` for local development and set the existing admin and Tempest values. `NWS_USER_AGENT` should identify 828 Weather and provide a monitored contact address. Vercel KV variables are supplied by the project's KV integration. `NOWCAST_MOCK_MODE` defaults off and must equal `true` to expose mock scenarios.

## Local development

For an immediate mock preview, install with `npm install`, run `npm run preview:nowcast`, and open `http://127.0.0.1:4173/admin/nowcast/index.html`. This preview binds only to the local computer, explicitly enables the mock banner and scenarios, and cannot publish. For live-service development, use the project's normal Vercel development command (`npx vercel dev`), sign in at `/admin/login.html`, then open `/admin/nowcast/index.html`.

## Manual operations workflow

Phase 1 intentionally operates as a meteorologist-triggered workspace rather than an unattended monitor:

1. Open the console when Asheville weather begins to warrant closer attention.
2. Select **Start Operations Session**. This performs the first fetch and begins two-minute collection while the page remains open.
3. Use **Fetch Now** when an immediate manual refresh is useful.
4. Watch the 15-, 30-, and 60-minute readiness indicators as the session history develops.
5. Generate, edit, and approve a deterministic nowcast draft.
6. Use **Copy & Open Weather Pulse** to hand the text to the existing manual Pulse composer.
7. Select **End Session** when active monitoring is complete. No further data is fetched.

The active session and its bounded six-hour observation history are stored on the current device so a page reload can resume the session. This device-local history is sent only to the authenticated Phase 1 endpoint for deterministic comparisons. It is not a replacement for durable production storage across devices.

## Tests

Run `npm test`. Tests use Node's built-in test runner and fixtures; they make no live Tempest or NWS calls.

## Mock data

Set `NOWCAST_MOCK_MODE=true`, restart local development, and open the console. A prominent mock banner and scenario selector appear. Scenarios cover quiet weather, temperature/dew-point trends, wind/gust changes, rain transitions and heavy rain, stale/unavailable Tempest, alert changes, wetter forecasts, unavailable NWS, and multiple simultaneous changes.

## Deployment

Deploy through the existing Vercel workflow. Confirm `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, `TEMPEST_STATION_ID`, `TEMPEST_TOKEN`, `NWS_USER_AGENT`, and the existing Vercel KV integration are configured for the target environment. Keep `NOWCAST_MOCK_MODE=false` or unset in production. No new service or database dependency is required.

## Known limitations

- There is deliberately no background collector. Observation history grows only during a manually started operations session, and the page must remain open for the two-minute collection cycle.
- A new live session has a warm-up period: 15-, 30-, and 60-minute observation comparisons appear as enough session history accumulates. Current conditions, NWS forecasts, and alerts are available immediately.
- Device-local session history survives reloads on the same browser but does not synchronize across devices.
- The in-memory storage fallback is intentionally non-durable and local-development only. Production history requires the existing Vercel KV integration.
- Forecast change detection compares the current leading NWS period with the prior saved leading period. Period timing changes are flagged, but complex cross-period alignment is not attempted.
- Alert cancellation is inferred when a previously active alert disappears before its expiration; expiration is inferred from the official expiration timestamp.
- Tempest feels-like equals measured temperature because the raw station observation endpoint does not supply a validated feels-like value. It is labeled unavailable only when temperature is unavailable.

## Phase 1 completion checklist

- [x] Private authenticated console and Phase 1 APIs
- [x] Normalized Tempest conditions with per-field source/time/freshness
- [x] Official NWS point and hourly forecasts
- [x] Official NWS active alerts with attribution and instructions
- [x] Bounded observation, forecast, alert, draft, and log histories
- [x] 15-, 30-, and 60-minute change detection
- [x] Central configurable thresholds and circular wind math
- [x] Rain-state grace-period logic
- [x] Deterministic status and rule-based draft generation
- [x] Generate, regenerate, edit, copy, approve, and dismiss controls
- [x] Independent source health and system diagnostics
- [x] Explicit mock mode and all required scenarios
- [x] Fixture-based deterministic tests
- [x] No radar, camera analysis, AI, terrain prediction, or publishing integration

## Recommended Phase 2 starting point

Begin with a written radar-source and update-frequency decision, followed by a read-only latest-radar ingestion adapter and source-health contract. Do not couple radar ingestion to Phase 1 observation or draft storage.
