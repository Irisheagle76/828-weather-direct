# Focused mobile FEELSCORE map

The FEELSCORE tab replaces the four-city diagram and its per-city weather requests with a geographic view of eastern TN, western NC, Upstate SC and northeast GA. The existing Today/Tomorrow control selects the regional forecast date. This product represents noon–3 PM local comfort categories, not current 0–100 FEELSCORE observations.

GET `/api/router?route=mobile/feelscore-map&date=YYYY-MM-DD` is an additive, read-only presentation adapter. It reads the same published daily JSON files used by the desktop `se-feelscore` endpoint, retains final categories unchanged, trims unneeded hourly/debug fields and crops grid points with a three-cell interpolation margin. Four-state boundaries come from the desktop GeoJSON. There are no new forecast calculations or publish workflows.

The desktop API automatically locks to today's map before 3 PM and tomorrow's thereafter. The adapter reads that API's published daily source directly to allow explicit day selection without changing the desktop route. Tomorrow may not yet have a published file; in that case mobile shows a clear unavailable message and never substitutes today's map. Source age is limited to 36 hours and dates must match. Five-minute server/CDN/browser caches and in-flight deduplication reduce overhead. Map data loads only when FEELSCORE is opened or its day changes.

`public/js/feelscore-map-field.js` is restored additively from the current C-drive publication checkout at its existing canonical path. It is the unchanged desktop color lookup, contour sampler and opacity implementation. Mobile imports it; no separate smoothing/scoring implementation is introduced. The mobile canvas renderer performs only geographic projection and presentation. No new library or tile-service dependency is required.

Changed files:

- Created `lib/api-routes/mobile/feelscore-map.js`: focused published-data adapter.
- Created `public/js/feelscore-map-field.js`: existing canonical shared presentation utility restored to this older checkout.
- Created `public/mobile/regional-map.js`: focused canvas presentation.
- Created `test/mobile-regional-map.test.js`: unchanged category/color and crop coverage tests.
- Created this document.
- Modified `api/router.js`: one additive route registration.
- Modified `tools/mobile-preview/server.mjs`: execute the new undeployed adapter locally.
- Modified `public/mobile/index.html`, `mobile.js`, `mobile.css`: replace the regional diagram, wire date selection, style map and legend.

Production HTML, navigation, existing APIs, scoring engines and deployment state remain unchanged. Local URL: http://127.0.0.1:4174/mobile/#feelscore .
# State-label positioning correction

Mobile-only `regional-map.js` now centers state abbreviations on anchors inside the visible TN/NC/SC/GA regions. The previous NC anchor was in Tennessee. City coordinates, state outlines and contour rendering were not changed. Phone-width visual inspection passed; all four new anchors passed point-in-polygon checks against the existing state boundary dataset.
