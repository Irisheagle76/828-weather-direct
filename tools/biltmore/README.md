# 828 Biltmore — local experimental prototype

## Public-friendly presentation — September 15

Prototype-only lighter blue/orange/white palette, navy text and high-contrast chart/meter colors. Question-led headings, visible fixed-ruler explanation (gauge height is not water depth), plain-language river summary and NOAA forecast interpretation. Recent river changes and average movement now display inches/inches per hour; gauge height and official river marks stay in feet. The charts explicitly explain their zoomed vertical scales. Concern names are presentation labels only: Lower concern / Keep watching / Concern increasing / High concern / Flood-stage reached; underlying rule levels, thresholds, data sources and refresh intervals are unchanged. Missing/stale readings are never an all-clear. Demo rain remains excluded from concern analysis.

Files edited: isolated `public/css/biltmore.css`, `public/js/biltmore/page.js`, `public/js/biltmore/watershed.js`, `public/js/biltmore/rules.js` (wording only), this README and prototype tests. No shared production files, navigation, dependencies or deployment. Verified at 1440×1000 and 390×844, no horizontal overflow or browser errors. Screenshots: `public-desktop.png`, `public-mobile.png`.

## Watershed radar + official forecast — September 14

Only prototype files changed. Traffic work paused; existing camera cards retained unchanged. No deployment or navigation changes.

- Official NOAA forecast: `https://api.water.noaa.gov/nwps/v1/gauges/bltn7/stageflow/forecast`, cached 15 minutes. Actual stage points in feet, issuance time and forecast horizon; dashed purple guidance is separate from solid USGS observations. No extrapolation or invented crest: flat guidance is identified as no distinct crest. Guidance older than 24 hours is visibly stale; expired future points are unavailable. Forecast is not an official warning and does not change the experimental concern engine.
- NOAA MRMS base reflectivity: `https://opengeo.ncep.noaa.gov/geoserver/conus/conus_bref_qcd/ows`. WMS GetCapabilities time dimension supplies the latest actual frame; metadata cached 5 minutes. Browser WMS tiles request that specific time, with no background animation or hidden-tab polling. Frames older than 20 minutes are stale. Reflectivity is dBZ, not measured inches/hour or watershed rainfall accumulation.
- USGS NLDI upstream basin: `https://api.water.usgs.gov/nldi/linked-data/nwissite/USGS-03451000/basin?simplified=true`, cached 24 hours. Simplified official drainage geometry, not a flood inundation boundary. Independent boundary/radar failures are explicit.
- Interactive map reuses the existing site's Leaflet 1.9.4 CDN pattern, isolated to this page; public OpenStreetMap tiles carry attribution. No package/framework or API credentials added. Metadata fetched server-side; public WMS/map tiles directly by browser. Fit-watershed button resets framing; official NWS radar link provides animation fallback.
- New isolated modules: `public/js/biltmore/forecast.js`, `public/js/biltmore/watershed.js`, tests `test/biltmore-forecast.test.js`. Prototype allowlist expanded for these modules only.

Open http://127.0.0.1:4188/biltmore.html. Restart from the repository root with:

```
node --env-file=.env.local tools/biltmore/server.mjs
```

For same-network mobile access, pass the Windows private LAN IPv4 address as the final argument, for example `node --env-file=.env.local tools/biltmore/server.mjs 192.168.4.102`, then open `http://192.168.4.102:4188/biltmore.html` in the phone browser. The IP can change. This binds only that private interface, not all interfaces; no tunnel, public hosting or router port-forwarding. Preview is unauthenticated and intended only for a trusted LAN. Windows firewall or Wi-Fi client isolation may block access; firewall policy has not been altered.

No deployment was performed. No production router, CSS, HTML, navigation, package files, environment files, or Vercel configuration was edited. The local server exposes only the four prototype assets plus `/experimental/biltmore/data`. It does not serve existing pages or expose environment values. Adding these files to a future deployment would require separate authorization; the data endpoint exists only in this local server.

## Files

- `public/biltmore.html`: independent document, no shared scripts or service worker registration; noindex.
- `public/css/biltmore.css`: independent styles, based on existing site colors/typography.
- `public/js/biltmore/page.js`: rendering, polling, SVG charts, separate official alerts.
- `public/js/biltmore/rules.js`: analysis/trend configuration and future station placeholder.
- `tools/biltmore/server.mjs`: local-only official-source fetch/cache; reuses existing read-only Tempest normalization helper.
- `test/biltmore-prototype.test.js`: deterministic rules and change-window tests.
- `tools/biltmore/mobile.png`, `desktop.png`: visual acceptance captures.
- This README.

## Sources and availability

- USGS: `https://waterservices.usgs.gov/nwis/iv/?format=json&sites=03451000&parameterCd=00065,00060&period=P2D&siteStatus=all`. Live stage (ft), discharge (ft³/s), individual observation timestamps. Stage change 1/3/6 hours and elapsed-time average rate are derived from real observations, anchored to latest observation, with a 20-minute match tolerance. Missing windows return unavailable. Graph shows the past 24 hours, stops at actual observations, and breaks across gaps over 20 minutes. Observations provisional.
- NOAA: `https://api.water.noaa.gov/nwps/v1/gauges/bltn7`. Live metadata: action 9, minor 10, moderate 14.5, major 16.5 ft at verification. Thresholds are fetched, not hardcoded. Official observed gauge category/time shown separately; category is not a warning. Metadata API documentation: https://api.water.noaa.gov/nwps/v1/docs/.
- NWS: `https://api.weather.gov/alerts/active?point=35.56510,-82.54016`. Live point alert check, event/headline, full description, expiration. At verification no active alerts were returned. Point coverage does not cover all surrounding watersheds.
- WeatherFlow: existing authorized `swd/rest/better_forecast` adapter for station 131000, using server-only `WEATHERFLOW_API_KEY`. Request currently unavailable in this environment. Temperature, dew point, wind/gust, daily rainfall and rain rate are supported by the adapter but NOT confirmed live here. No key borrowed from public station pages.
- Victoria: external PWSWeather link only; independent supported Xweather access not configured. No scraped fields or substituted airport readings.
- DriveNC: on September 14, both supplied `https://www.drivenc.gov/map/Cctv/4222` and `/4218` were verified to return HTTP 200 `image/jpeg` directly. Both now render as dashboard still images, with source links and graceful unavailable fallback. Retrieval time is shown, but camera capture age is unknown. The documented metadata API still requires a developer key; the public image URLs do not. Stills refresh on visible-page data refresh (5 minutes), with a manual button limited to one request per 10 seconds. No scraping or guessed images are used.

Rolling 1/3/6-hour rainfall and rainfall bars now use a clearly labeled Huntington Chase proof-of-concept sensor (see below). Biltmore rainfall and rainfall-response analysis remain unavailable. The UI never converts missing readings to zero and does not invent a station or causal response.

## Refresh / stale behavior

One aggregate browser request every 5 minutes while visible, plus refresh when returning to the tab. No overlapping requests. Upstream caches: USGS, Tempest, alerts 5 minutes; NOAA metadata 60 minutes. Each source is independent with 15-second timeout, request coalescing and cached stale fallback. Failed fetches are cached for the same interval to avoid retry storms. Observation data older than 60 minutes is marked stale. Browser timeout 25 seconds. No Vercel calls, camera polling, or new dependency.

## Experimental concern rules

Rules centralized in `rules.js`. Active NWS Flood Warning / Flash Flood Warning at the configured point gives HIGH; official warning text stays separate. Fresh gauge at/above NOAA minor stage gives FLOODING (gauge threshold only, not street-by-street confirmation). At/above action stage gives ELEVATED. Missing/stale stage or thresholds, missing recent change, or positive one-hour change exceeding 0.02 ft gives MONITOR. Otherwise LOW, with explicit incomplete rainfall coverage and local-flooding caveats. The 0.02-ft tolerance describes nearly steady observations, not an aggressive rapid-rise threshold. No rainfall or rapid-rise risk triggers are enabled. HIGH is not generated from invented rainfall thresholds.

Elevated/HIGH/FLOODING reorders sections through CSS: now, river, rainfall, cameras, official alerts, response, stations. DOM section identities remain stable for future event-mode development.

## Future 828 Biltmore station

The rainfall adapter is now ready: configure server-side `BILTMORE_TEMPEST_MODE=local`, `BILTMORE_TEMPEST_STATION_ID` and `BILTMORE_TEMPEST_TOKEN` when the actual Biltmore device exists. Local mode requires its own explicit station ID and credential and never silently falls back to the personal station. Preserve station 131000 as secondary. Weather and station-network integration can be extended separately; the current change only activates rainfall calculations. Never expose credentials in browser configuration. Deterministic river-response wording still requires calibrated local coverage/history; the demo deliberately does not enable it.

## Huntington Chase rainfall proof of concept

Warren Ave station update: the separate third-party neighborhood station is registered in `tools/biltmore/stations.mjs` as Biltmore Village · Warren Ave, Tempest 131000, 35.56510/−82.54016, elevation 2048 ft, Residential · trees, shrubs (user-supplied metadata). It is not the Huntington Chase demo or future 828-owned device. Current credential probes returned station observations HTTP 404 and better_forecast HTTP 401; these are feed/access failures, not proof the physical station is offline. The existing station adapter remains unavailable and fails gracefully. A separately authorized provider API key can be supplied server-side as `BILTMORE_VILLAGE_API_KEY` without affecting the personal demo or shared APIs. Current fields and their timestamps will hydrate when the supported provider feed succeeds. No station-owner credential was scraped or borrowed.

`tools/biltmore/rainfall.mjs` is an isolated server-only adapter/calculation module. Demo mode defaults to station 127602 and the existing `TEMPEST_TOKEN`, without editing environment files or shared APIs. The authorized station metadata endpoint discovers its single active Tempest device; ambiguity fails rather than guessing a device. A 30-hour device-history request is cached for five minutes, with station metadata cached for one hour. Requests have 12-second timeouts. Returned samples currently have a five-minute interval; the current rate is the last interval accumulation converted to inches/hour, not an instantaneous intensity claim.

Official endpoints: `/swd/rest/stations/{station_id}` and `/swd/rest/observations/device/{device_id}?time_start=...&time_end=...`. Documentation: https://weatherflow.github.io/Tempest/api/swagger/. Array index 12 supplies raw interval rain in mm; index 17 supplies report interval minutes. Millimeters divided by 25.4 gives inches. Duplicate timestamps are deduplicated; negative/null readings are rejected. Accumulation windows require contiguous complete intervals and exact boundary coverage (1-second timestamp tolerance); missing, overlapping or partial samples return unavailable, not prorated values. Coverage percentage remains visible. Local midnight is timezone-aware, including DST. Today and rolling totals end at the latest observation timestamp, not an invented current sample.

The hourly chart contains actual complete UTC-hour interval totals with an Eastern display axis. Missing hours use an × marker; current partial hours are not represented as full hours. The overlay combines remote demo rainfall with the real Biltmore gauge solely to prove time-aligned plotting, with explicit different-location labeling and no response or causal claim. Huntington Chase readings are excluded from the flood engine. Weather fields remain from the original village station layer and are not substituted with Huntington Chase conditions.

Verification: seven tests pass, including mm conversion, null/duplicate rejection, gaps/boundaries, DST and credential isolation. The real response showed complete 1/3/6-hour/today windows with 0.00 inches at verification (dry conditions). Browser values matched the response; desktop/mobile widths showed no overflow and no console errors. Screenshots: `rain-poc-desktop.png`, `rain-poc-calculations.png`, `rain-poc-mobile.png`. Diagnostic helper: `node --env-file=.env.local tools/biltmore/check-rainfall.mjs`; it reports only non-secret data.

## Verification

Two rules tests pass; server/client syntax checks pass. Browser visually inspected at 390×844 and 1440×1000; no overflow, console errors or uncaught browser errors. Real USGS response matched displayed 1.31 ft stage and approximately 40 ft³/s at Sep 13, 9 PM EDT during verification. NOAA threshold context and timestamps matched feed. Station failure did not affect river or alert cards. Camera anchors use exactly the supplied official URLs; upstream camera playback not verified. Existing files were not edited, navigation has no prototype entry; full existing-site regression suite was not run because substantial preexisting edits are outside scope.

Browser upstream CORS was avoided by the local server, not diagnosed as a provider outage. Initial direct requests were blocked by local sandbox socket permissions; approved server access succeeded for official sources. Do not attribute local sandbox restrictions to USGS/NOAA CORS.

## Visual-first adjustment — September 14

The now card contains an official-threshold stage dial, physical river-rise/fall meter, rain-rate dial and five-step experimental concern strip. No new flood thresholds were introduced. Display-only ranges in `CONFIG.meters` are 0–2 in/hr for rainfall and −1 to +1 ft/hr for river movement. Values outside the display range retain their actual numeric reading with the marker clamped at the edge; the scale is not a flood-risk calibration. The stage dial range ends at NOAA major flood stage, fetched live; unavailable/stale context hides the needle. Missing rainfall renders a grey dial, not a zero reading.

River/camera cards sit beside each other on wide screens; cameras follow the river on phones. Charts have responsive readable labels and explicit zoomed-scale labeling. Source explanations are in expandable details; uncertainty, missing-state labels and official/experimental distinctions remain visible. `visual-desktop.png` and `visual-mobile.png` are acceptance captures. Three tests pass; both camera images were verified to load with nonzero natural widths. Prototype-only HTML, CSS, JS, rules, tests and this README changed; no shared production files or deployment configuration changed.
