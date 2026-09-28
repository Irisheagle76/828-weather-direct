# JCC supplemental downtown observations

Tempest station 144737 is the JCC station on Clyde Street, Asheville, at
35.606299, -82.547881 (coordinates supplied by the owner). Its intended role is
supplemental observation coverage primarily for downtown Asheville.

This station was already registered as Lower Asheville. The existing registry
entry now identifies it as JCC / Downtown Asheville; its stable ID is retained
so hiking and elevation comparisons continue to use the same station without
double counting. The existing 2,137-foot elevation is retained and has not been
independently reverified.

The shared observation provider uses JCC_TEMPEST_TOKEN for direct station
observations from JCC, and WEATHERFLOW_API_KEY for other Tempest stations.
Without a dedicated token it retains the existing WeatherFlow API-key path.
The Tempest endpoint uses JCC_TEMPEST_TOKEN (or the existing TEMPEST_TOKEN when
absent) for its supplemental wind source and exposes the full metric observation
as downtown_station. Object and array observations are supported; direct JCC
readings older than ten minutes are rejected. Existing observation-network
health checks and last-good fallback behavior still apply.
The primary station remains selected by TEMPEST_STATION_ID;
do not change that setting to make JCC supplemental.

Personal-token access was verified locally on September 28, 2026. Keep tokens
in server-side secret storage, never in this document or public assets.
Set JCC_TEMPEST_TOKEN in the server deployment environment and the GitHub Actions
repository secrets for the hiking refresh before using the dedicated access
there. Local Node commands can load the ignored file with --env-file=.env.local.

These metadata changes do not deploy the site or refresh generated observations.
