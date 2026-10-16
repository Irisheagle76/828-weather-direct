# Hiking Guidance scheduled refresh

The October 15–16, 2026 failures occurred in `Refresh hiking guidance`, before the commit and Fall Explorer sampling steps. Run `38864652723` at commit `6940f9a` reported 8 available sites out of 17 and 9 feed failures; runs `38833738425` and `38790580642` failed at the same coverage gate. Checkout and Node 24 setup succeeded. Node 20 action-runtime and Ubuntu migration warnings were not the cause.

A read-only live diagnostic reproduced 8/17: the nine stations using WeatherFlow's `better_forecast` endpoint returned HTTP 401. The separately authenticated North Downtown JCC station, Weather Underground, NC ECONet, and Mountain Air composite remained usable. The historical logs only recorded failure counts, so they cannot establish each historical feed's HTTP response.

The last successful run (`38755215225`, October 15 at 14:52 UTC) reported 17/17 sites with zero failures. The owner confirmed that WeatherFlow issued the integration credential. Its rejection does not establish a new provider policy or a change to each station's sharing settings. The same credential was rejected both as `api_key` and as `token`. Existing personal tokens only returned data for their respective owner stations, so substituting them would not recover the full network.

The updater now publishes usable live observations during partial outages, consistent with the live hiking API. It retains every configured site, marks missing or unhealthy sites unavailable without measurement values, includes quality and individual failure reasons, and adds reduced-coverage guidance. It keeps the existing health/freshness checks and scoring rules. Zero usable live observations and missing required credentials still fail without replacing the previous artifact. Writes use a temporary file and rename.

`hiking_refresh_coverage` logs show provider counts; `hiking_feed_failure` logs identify station, provider, and reason. WeatherFlow HTTP 401/403 includes a credential recovery hint. `hiking_refresh_failed` identifies fatal failures. Credential values and upstream URLs are redacted from these logs and published failure reasons.

To restore the affected WeatherFlow stations, verify the integration credential's status with WeatherFlow and update the repository's `WEATHERFLOW_API_KEY` Actions secret if they issue a replacement. Keep the existing station IDs and requests. `JCC_TEMPEST_TOKEN` does not authorize the other stations. Confirm that subsequent runs show those stations reporting; publishing partial coverage alone does not repair upstream authorization.

The hourly `7 * * * *` schedule, manual dispatch, source registry, provider requests, and Fall Explorer sampling are unchanged. Data commits include `[skip deploy]`; this workflow does not deploy or promote a release.

Local regression checks (no credentials or network required):

```sh
node --test test/update-hiking-guidance.test.js test/hiking-guidance.test.js test/elevation-observations.test.js
```

The workflow runs these checks before fetching data. Tests cover the observed 401/partial-coverage failure, full coverage and lightning, stale readings, total outage, missing credentials, secret redaction, and memory-fallback rejection.
