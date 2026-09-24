# Forecast-aligned mobile FEELSCORE copy

## Latest: consolidated Comfort Timeline

The dedicated tab now has one Today/Tomorrow Comfort Timeline with the four requested windows. The period-average ring, explanatory caption, separate horizontal hourly-strip panel and duplicate curve were removed. Home's existing curve remains. Published forecast narrative is displayed without instructional add-ons; FEELSCORE interpretation and Best Window methodology live in a closed-by-default More info disclosure. Earlier Today windows are in a separate collapsed disclosure.

Each window shows min/max hourly FEELSCORE and temperature, plus a concise practical takeaway. Today excludes elapsed forecast timestamps and labels ongoing windows as remaining hours. Missing coverage is explicit. Windows are half-open Eastern intervals: 05:00–09:00, 12:00–15:00, 17:00–20:00, 21:00–24:00. Intentional gaps are not filled or averaged. These are hourly forecast samples, not observations of every trail/location.

Best Window chooses the strongest consecutive two-hour stretch *within* these windows, ranked by minimum hourly score (earliest wins ties). It never bridges missing hours; limited-comfort best windows are qualified. No new API calls or weather/scoring implementation: every hourly score comes from existing `calculateComfort`.

Created: `public/js/intel/comfort-time-buckets.js`, `test/comfort-time-buckets.test.mjs` (started during the paused work and finalized here). Modified: `public/mobile/index.html`, `mobile.js`, `mobile.css`, additive `public/js/intel/forecast-comfort-context.js`, existing `test/mobile-forecast-comfort-context.test.mjs`, and this report. No production consumer was changed.

Verification: eight automated tests passed, covering editorial alignment, exact window boundaries, late-night midnight rollover, elapsed/partial/missing windows and continuous Best Window selection. Browser checked Today/Tomorrow at 390px/360px: Tomorrow has four windows; Today had two remaining with earlier windows collapsed; More info starts closed and opens; no duplicate curve, no horizontal overflow, no reported page errors. Live Tomorrow sample: morning 83–89, afternoon 37–58, Best Window 6–8 AM at 86–89. Local-only; no deployment.

Cause: the existing shared engine uses the first period-hour snapshot for narrative ingredients, while the numeric score averages period hours. Tomorrow's first snapshot is around midnight. That produced a mild/pleasant narrative despite an authored 89°F afternoon forecast. Today also inherited generic afternoon phrasing into evening.

Created `public/js/intel/forecast-comfort-context.js`: reusable presentation helper, no scoring changes. It uses exact Eastern-date published forecast fields, preserves the authored headline/narrative, and explicitly qualifies a period-average score. Without an authored forecast it summarizes actual hourly temperature ranges rather than reusing a midnight narrative. Evening Today uses the next six hours rather than past-afternoon copy. Unavailable data remains unavailable.

Modified `public/mobile/mobile.js`: Home and dedicated FEELSCORE copy consume that helper; dedicated score caption identifies period-average scope. Re-render after authored forecast loading ensures editorial data takes precedence. Scores, curves, maps, publishing stores and production pages are unchanged.

Created `test/mobile-forecast-comfort-context.test.mjs`: four passing tests for published 89°F heat, tomorrow peak/date filtering, evening wording and unavailable data. This document is also new.

Browser checked at 390px using live local preview: Tomorrow headline “Hot and sunny,” exact near-90° authored text, period-average qualification and no horizontal overflow. Today evening narrative uses upcoming hours. No page errors reported. No deployment. Desktop integration of the additive helper is a later explicitly approved task; this does not fix the original engine's snapshot-driven narrative on production surfaces.
