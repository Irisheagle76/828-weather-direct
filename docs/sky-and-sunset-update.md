# Sky & Sunset update

Production release requested by the user. Prepared on current origin/main; stage and verify before explicit promotion.

The existing Sunset Radiance URL becomes Asheville Sky & Sunset. Sky Now leads the daily experience; the evening phase emphasizes Sunset Radiance. Shared navigation uses Sky & Sunset. East Asheville outbound links use the evergreen YouTube channel live URL.

Atmosphere Now interprets the existing normalized North Downtown supplemental station observations: temperature/dew-point spread, humidity, solar radiation, surface wind, rain and lightning. Observations expire after three minutes, with separate rain freshness and a 15-minute lightning lookback. No vertical sounding, citywide precipitation, cloud motion or definitive fog is inferred from a surface station alone.

North Asheville remains an analysis-only source. Its snapshot URL is updated to the supplied IPCamLive stream; no image or stream URL is added to public HTML. The center bearing is south-southeast; uncalibrated east/west edge bearings are removed. A conservative top-20% image crop replaces the old deep crop pending field-of-view calibration. North Asheville is not substituted for a missing west-facing cloud measurement.

Stale camera analysis no longer produces a current sunshine narrative or current-looking camera metrics. Forecast sunset scoring is an existing separate subsystem, not recalibrated in this update.

Validation: 61 focused tests pass (atmosphere, current camera analysis, shared sky language, preview, homepage synchronization, camera desk and shared sky timing). Browser preview verified the rendered page and unavailable/stale-data behavior. IPCamLive returned HTTP 200 image/jpeg with a current Last-Modified timestamp on October 1, 2026. Live station rendering was not verified: the production API used by the local preview did not supply fresh supplemental observations. Release validation: npm test passes 349 tests; the complete JS/MJS and shared sky-time suite passes 374 tests. Both required rain and bright-pixel fixes are ancestors. autoAssignCustomDomains remains false. Staged verification is required before promotion.

Interpretation references: https://www.weather.gov/lmk/humidity and https://weatherflow.github.io/Tempest/api/swagger/
