# Asheville Microscope and Micronet checkpoint

Checkpoint date: September 7, 2026

This document preserves the product decisions, data architecture, known limitations, and next steps for the Asheville Microscope and experimental Micronet work. Neither page has been deployed as part of this checkpoint.

## Product structure

### Asheville Microscope

`public/asheville-microscope.html` is the public-facing concept. It is designed to explain what Asheville's neighborhood observations mean without requiring the audience to understand meteorological statistics.

Current features:

- A six-signal **Asheville right now** briefing covering temperature, rain, terrain, exposure, moisture, and wind.
- A neighborhood footprint with clickable station bubbles and a selected-station profile.
- Temperature, dew-point, and wind observation modes.
- An elevation cross-section using station elevation as context rather than automatic causation.
- Event-aware rain language. Actively raining stations are excluded from elevation comparisons when enough dry stations remain.
- A Greater Asheville and four-corridor regional comparison.
- Matched-elevation comparisons that help isolate neighborhood exposure.
- Data-source, freshness, elevation, and exposure context attached to observations.

### Asheville Micronet Intelligence Lab

`public/asheville-microscope-lab.html` is the experimental analysis page. It tests calculations and presentation ideas before anything moves into the public Microscope.

Current features:

- Robust ranking of locations that differ most from the typical current reading.
- Plain-language anomaly presentation while median/MAD calculations remain behind the scenes.
- A neighborhood-consensus classification:
  - One Asheville story
  - Mostly aligned
  - Location matters
  - Highly localized
- Event-aware explanation of what may be shaping the current pattern.
- Elevation tendency and pattern-alignment analysis with a plain-language verdict.
- A clean interactive Leaflet/Esri basemap with Asheville, Greater Asheville, and mountain-corridor scopes.
- Temperature, dew point, wind, gust, rain, pressure, and solar map layers.
- Pairwise station comparisons for distance, elevation, temperature, dew point, wind, adjusted pressure, and rainfall.
- Rain-localization experiments and a quality-control/readiness audit.

The analysis implementation is in `public/js/asheville-microscope-lab-analysis.js`.

## Observation network

The registry contains 30 unique physical stations:

- 18 Asheville/core stations
- 4 Greater Asheville stations
- 8 mountain-corridor stations

Station definitions, public metadata, scope, coordinates, elevation, exposure, and source configuration are in `lib/asheville-spread/stations.js`.

The latest local snapshot used during this checkpoint was generated September 6, 2026 at approximately 1:08 PM Eastern:

- 26 of 30 stations reporting
- 26 fresh observations
- Unavailable: Sand Hill, Biltmore Village, Asheville High School, and Biltmore Estate

This is a transient observation snapshot, not a retained historical dataset.

## Data pipeline

The server-side pipeline is under `lib/asheville-spread/`:

- `providers.js`: provider fetchers and common observation normalization
- `quality.js`: freshness and plausibility screening
- `pressure.js`: pressure-datum harmonization and elevation adjustment
- `service.js`: concurrent station collection and network summaries
- `stations.js`: station registry and public metadata

`lib/api-routes/asheville-spread.js` exposes the combined payload through the `asheville-spread` API route. The route is registered in `api/router.js`.

Provider roles currently include:

- Tempest/WeatherFlow for Huntington Chase and any separately authorized Tempest station
- Weather Underground for most neighborhood and corridor stations
- NOAA/NCEI for Grove Arcade
- NC ECONet/UNC Asheville for the Lookout Observatory station
- PWSWeather and WeatherLink entries remain unavailable until suitable authorized machine-readable access exists

`lib/tempest/normalize-observation.js` is shared normalization infrastructure used by the Microscope pipeline.

## Important data-access caveat

The locally stored Weather Underground credential currently receives a product-authorization rejection from the current-observations endpoint. A local prototype refresh successfully used the public dashboard's own client data route transiently, without storing the dashboard-provided key.

That transient route is useful for local design work but should not be treated as the production ingestion strategy. Before deployment, obtain or confirm durable authorized Weather Underground access and keep credentials server-side.

No secret values belong in this document or in committed source files.

## Interpretation rules

The project separates observation from explanation:

1. Report the observed difference.
2. Check active weather drivers such as rain.
3. Add elevation and exposure as context.
4. Avoid presenting correlation as a confirmed cause.

An actively raining station can be rain-cooled. Its temperature must not be used as evidence of an elevation-only effect. The public Microscope now labels such regional extremes as rain-influenced, and dry stations are preferred for terrain comparisons.

Pressure values are compared only after their datum is identified or provisionally normalized to sea-level pressure. Unresolved pressure observations are withheld from pressure comparisons.

## Language decisions

Audience-facing language should avoid unexplained statistical and network terminology.

- Use **reporting locations** or **Asheville's neighborhood stations**, not simply **the network**.
- Use **typical current reading** as compact shorthand for the median.
- When space permits, explain it directly: **The center line splits the current readings in half—half are lower and half are higher.**
- Keep terms such as median absolute deviation, Theil-Sen slope, IQR, and robust dispersion in analyst notes or expanded methodology.
- Prefer **cooler than typical** and **warmer than typical** over signed deviations alone.

## Recommended next public migration

The strongest Micronet concept to migrate next is the consensus story:

> Does one Asheville temperature tell the whole story?

Before migration, recalculate it using only the Asheville/core stations. The current Micronet regional calculation includes corridor locations such as Waynesville and Hendersonville and must not be labeled as an Asheville-neighborhood range.

Recommended public version:

- A plain-language verdict such as **Mostly—but not everywhere**
- The four-position agreement scale
- Typical Asheville neighborhood range
- Full Asheville neighborhood range
- An event-aware explanation of what is shaping the differences

Do not move the experimental 0–100 consistency index into the public page. Keep the full elevation-analysis module in the lab for now; a single restrained terrain conclusion may be used in the public briefing.

## Work still needed before deployment

- Establish durable authorized production access for Weather Underground observations.
- Decide how and where to retain synchronized observation history.
- Add temporal QC: jump detection, duplicate timestamps, rainfall-counter resets, and persistent-bias checks.
- Add neighbor-consistency checks and incorporate provider QC flags into interpretation gating.
- Make Micronet elevation analysis explicitly rain-aware throughout, not only in the public Microscope card.
- Recalculate the public consensus story using core Asheville stations only.
- Verify responsive layouts, keyboard interaction, color contrast, and screen-reader labels.
- Decide the final navigation relationship among the avlweather.com homepage, Microscope, and any public subset of Micronet.
- Run a final live-data and browser verification immediately before any deployment.

## Tests

Relevant tests:

- `test/asheville-spread.test.js`
- `test/asheville-microscope-lab-analysis.test.js`

At checkpoint time, the combined Asheville suite passed 11 tests.
