# Hiking Guidance scheduled refresh

The October 15–16, 2026 failures occurred in `Refresh hiking guidance`, before the commit and Fall Explorer sampling steps. Run `38864652723` at commit `6940f9a` reported 8 available sites out of 17 and 9 feed failures; runs `38833738425` and `38790580642` failed at the same coverage gate. Checkout and Node 24 setup succeeded. Node 20 action-runtime and Ubuntu migration warnings were not the cause.

A read-only live diagnostic reproduced 8/17: the nine stations using WeatherFlow's `better_forecast` endpoint returned HTTP 401. The separately authenticated North Downtown JCC station, Weather Underground, NC ECONet, and Mountain Air composite remained usable. The historical logs only recorded failure counts, so they cannot establish each historical feed's HTTP response.

The last successful run (`38755215225`, October 15 at 14:52 UTC) reported 17/17 sites with zero failures. The original WEATHERFLOW_API_KEY (before its local replacement) exactly matches TEMPEST_KEY on [line 10 of the kyzh0/zephyr scheduler example](https://github.com/kyzh0/zephyr/blob/f4640d6ce0540f3e9021faa755bd82036cb44941/server/apps/scheduler/.env.example#L10). It also matches the key embedded in the original hiking updater at commit `7bb8e80f` (May 9, 2026); commit `fd2f261f` (August 20) moved the updater to environment-based configuration. This supports the owner's recollection that it came from shared code. It does not establish the credential's original issuer, its intended access scope, or why it stopped being accepted. Its rejection does not establish a new provider policy or a change to each station's sharing settings. The same credential was rejected both as `api_key` and as `token`. Existing personal tokens only returned data for their respective owner stations, so substituting them would not recover the full network.

The updater now publishes usable live observations during partial outages, consistent with the live hiking API. It retains every configured site, marks missing or unhealthy sites unavailable without measurement values, includes quality and individual failure reasons, and adds reduced-coverage guidance. It keeps the existing health/freshness checks and scoring rules. Zero usable live observations and missing required credentials still fail without replacing the previous artifact. Writes use a temporary file and rename.

`hiking_refresh_coverage` logs show provider counts; `hiking_feed_failure` logs identify station, provider, and reason. WeatherFlow HTTP 401/403 includes a credential recovery hint. `hiking_refresh_failed` identifies fatal failures. Credential values and upstream URLs are redacted from these logs and published failure reasons.

The owner chose Weather Underground replacements rather than restoring broad WeatherFlow access. The eight non-owned Tempest sites are replaced by the following WU sites; the two owner stations remain on Tempest. The existing WU stations, Mountain Air composite, and NC ECONet sources remain. The network now contains 19 displayed sites, including the two added Asheville sites.

| Previous site | WU replacement | Elevation (ft) | Latitude | Longitude |
| --- | --- | ---: | ---: | ---: |
| Western Pisgah High Shoulder / 186088 | Park Place / KNCWAYNE323 | 4209 | 35.458 | -82.965 |
| Mount Mitchell East Slope / 100622 | Alpine Village / KNCBURNS167 | 3260 | 35.766 | -82.213 |
| Southern Haywood East / 85173 | Cold Mountain Station / KNCCANTO128 | 3445 | 35.428 | -82.820 |
| Southern Haywood West / 104977 | Camp Daniel Boone / KNCCANTO127 | 3257 | 35.392 | -82.898 |
| Black Mountain / 88141 | Wallace Mountain / KNCBLACK209 | 2625 | 35.652 | -82.341 |
| Waynesville / 128340 | Lake Junaluska / KNCLAKEJ3 | 2657 | 35.532 | -82.972 |
| High Asheville North / 157700 | Webb Weather / KNCASHEV482 | 3000 | 35.652 | -82.495 |
| High Asheville East / 160562 (regional substitute) | Windy Ridge Trail / KNCASHEV440 | 3209 | 35.666 | -82.497 |
| Added | BeaucatcherWx / KNCASHEV288 | 2550 | 35.589 | -82.540 |
| Added | Spivey Mountain / KNCASHEV307 | 3110 | 35.601 | -82.652 |

Each replacement has its own physical-site identity and coordinates; Windy Ridge is north of Asheville and is not labeled as the old eastern station. The shared registry also feeds Fall Explorer calibration: replacement sites retain the corresponding regional roles and weights, but their new identities prevent old observations being attributed to a different physical site.

All 19 sites contribute to guidance and remain in the station list. The elevation profile selects ten usable references spanning Asheville through Mount Mitchell; unavailable references are replaced with usable sites at distinct elevations. The existing horizontally scrollable mobile profile remains. WU readings do not supply the Tempest lightning fields; the page discloses that lightning observations now come from the two owner Tempest sites. No regional lightning coverage is implied.

The hourly `7 * * * *` schedule, manual dispatch, provider request formats, freshness checks, and Fall Explorer sampling step are unchanged. The workflow no longer requires `WEATHERFLOW_API_KEY`. Data commits include `[skip deploy]`; this workflow does not deploy or promote a release.

Local regression checks (no credentials or network required):

```sh
node --test test/update-hiking-guidance.test.js test/hiking-guidance.test.js test/hiking-profile.test.js test/mobile-hiking-data.test.js test/elevation-observations.test.js test/fall-observations.test.js
```

The workflow runs these checks before fetching data. Tests cover partial coverage, full coverage and lightning, stale readings, total outage, missing WU credentials, secret redaction, memory-fallback rejection, owner-token isolation, station metadata, profile selection, the mobile consumer, and the shared Fall registry. JCC failures preserve safe HTTP status codes and identify `JCC_TEMPEST_TOKEN` for authorization failures. The complete configured local suite passes 441 tests. A live writer check on October 16 at 12:56 UTC, with the shared WeatherFlow key disabled, retrieved 19/19 usable live sites with zero feed failures; all ten supplied WU stations reported successfully. This validates local credentials and provider access, not the presence of GitHub Actions secrets.

## Owner-station credentials

Residence station `127602` is owned by the same user as JCC. Its existing `TEMPEST_TOKEN` returned HTTP 200 during live testing, but the observation service previously ignored that token and used the rejected shared key. The updater now uses `TEMPEST_TOKEN` only when the requested station matches `TEMPEST_STATION_ID`; the workflow sets that ID to `127602` and reads the `TEMPEST_TOKEN` Actions secret. JCC `144737` keeps its separate `JCC_TEMPEST_TOKEN` path. Tokens are not sent to other configured stations.

Before the WU migration, a live local check retrieved both owner stations and 9/17 usable sites; the other eight Tempest sites returned HTTP 401. After migration, scheduled full coverage uses the existing `WEATHER_UNDERGROUND_API_KEY`, `JCC_TEMPEST_TOKEN`, and `TEMPEST_TOKEN` Actions secrets. A local `.env.local` value does not populate those secrets. No secret was uploaded or changed by this PR. A missing or rejected owner token produces a specific station failure and partial-coverage report while other sources continue. Zero usable live sites still fails without overwriting the previous artifact.

## Mobile and native app consumer

Mobile uses the same `hiking/current` API and station registry. The API retains all 19 configured site identities, strips unusable measurement values, and includes reduced-coverage guidance. Mobile shares the ten-site profile selector, expands each row to reveal conditions and observation time, and lists every site in an expandable full network section. It displays coverage and fallback provenance explicitly, distinguishes a recent partial report from an old report, and does not turn null comparisons into zero. The in-memory hiking response now expires after five minutes; background or manual refresh updates an open Hiking view when new data arrives.

The changes were also applied to the native development checkout while retaining its hourly-weather, comfort, and navigation work. Its local web bundle builds and includes the shared hiking modules; three native foundation checks and eleven focused hiking/navigation/hourly checks pass. A 390px browser review against the actual API retrieved 19/19 sites and verified expandable station details without page overflow. This verifies the source and bundle, not an installed Android/iOS build. Native builds read the hosted backend; existing installations require the approved backend release and a rebuilt app for the new bundled UI. No app was signed, installed, uploaded, or deployed.
