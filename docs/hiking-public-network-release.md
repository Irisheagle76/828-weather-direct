# Restore Hiking with public observations

Replace active WU collection with NWS KAVL and NC State UNCA, FLET, WAYN, BURN, BEAR, FRYI and MITC. Preserve WU site definitions and historical fall calibration metadata. Retain three local Tempests. Hiking can refresh without a WU key; failed sources stay explicitly unavailable. Use the existing NC State current-observation adapter and hourly KAVL health limits.

Microscope/Terrain retain five non-WU sources and add KAVL as metro context. Archive 27 WU sources. Refresh desktop observation pages at :00/:30; server/CDN cache expiration follows half-hour boundaries. This is per-instance/CDN caching, not a global distributed quota lock. Scheduled artifact updates run at :00/:30 and may start late. Mobile report-age handling also supports half-hour snapshots.

Validation: full JavaScript, MJS and engine suites plus npm run check. Live public-network reads verified before staging. No sky-analysis or experimental fog integration changes.
