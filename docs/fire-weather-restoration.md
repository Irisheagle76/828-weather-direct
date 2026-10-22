# Temporary fire weather restoration — October 22, 2026

The homepage seasonal switch `DROUGHT_FIRE_MODULE_ENABLED` is enabled in the working copy. Set it to `false` to hide the card again. No automatic expiry was selected because no end date was requested. Production has not been deployed or promoted.

The existing local 0–100 guidance model is retained. This is not the Canadian Fire Weather Index, an official fire danger rating, or a burn authorization. The card links to NWS Greenville-Spartanburg fire weather guidance.

## Corrections

- Roll the seasonal precipitation period to the latest September 1 rather than September 2025.
- Anchor rainfall totals and matching normals to the newest available CPC analysis; display rainfall and soil dates.
- Require complete rainfall history and recent soil data. Missing files no longer count as dry days; invented soil values and hardcoded homepage scores are removed.
- Derive dry-spell length from observed daily rainfall through the published analysis date, using a 0.10-inch wetting threshold. Publication lag is visible; this does not claim observations for the intervening days.
- Convert Tempest millimeter rainfall measurements to inches. Require observations no more than 30 minutes old and valid temperature, humidity, and gust inputs.
- Keep forecast rain out of the current score's wet-weather cap; include it in the separate six-hour outlook.
- Bound NOAA fetches, limit parallel precipitation requests, and cache complete background analyses for one hour per runtime.
- Refresh the homepage card every ten minutes; show an unavailable state on failure. Label above-normal rainfall correctly.

## Verification

The live route calculation succeeded on October 22 at 11:27 UTC in 2.3 seconds. Fire potential was 13/100 (Low), drought stress 35/100 (Dry). Rainfall and soil analyses were dated October 20. Ninety-day rainfall was 10.66 inches versus 12.70 inches normal; September 1–October 20 rainfall was 3.65 inches versus 6.30 inches normal. These are a verification snapshot, not persistent fallback values.

Regression coverage includes season boundaries, CPC little-endian decoding and missing values, observed dry spells, forecast-versus-observed rain, unavailable observations, and homepage success/failure transitions. Run `node --test test/*.test.js test/*.test.mjs tests/*.test.js lib/drought-fire/normalize.test.js`. Run `node tools/fire-index-live-check.mjs` for a fresh live check.

Review snapshot: `.tmp/fire-index/review.html`. Full test output: `.tmp/fire-index/full-tests.log`.

## Release boundary

This working tree contains substantial unrelated changes. Release only the fire restoration changes on current `origin/main`, retaining the required rain and bright-pixel fixes. Follow `AGENTS.md`: use the dedicated deployment checkout on `deploy-production`, keep automatic domain assignment disabled, verify the staged build and complete tests, and obtain explicit approval before promotion. Keep the unfinished fog integration out of the release.

NOAA CPC data format: https://ftp.cpc.ncep.noaa.gov/precip/CPC_UNI_PRCP/GAUGE_CONUS/DOCU/PRCP_CU_GAUGE_V1.0CONUS_0.25deg.README

Official local fire weather: https://www.weather.gov/gsp/fire_new

## October 22 outlook review

The headline and primary fire badge now describe the maximum local guidance score in a complete upcoming 24-hour forecast window. The current score remains separately identified in the summary and chart. This corrects the misleading prominence of a humid morning reading without setting an arbitrary Moderate floor or changing category thresholds.

The live check at 8:28 a.m. Eastern returned a current fire score of 13 (Low) and a forecast peak of 38 (Moderate) at 4 p.m., with 20% RH and 18.1 mph gusts. Drought background was 35 (Dry). These values are an example snapshot, not fixed outputs.

The two-line chart uses a common 0–100 scale, an orange fire line with area shading, a dashed teal drought line, a peak marker, pointer inspection, and a keyboard/touch-compatible hour slider. Drought stays flat over this weather outlook because soil and rainfall analyses are daily; the display does not fabricate an hourly drought cycle. Fire varies with hourly temperature, humidity, gusts, and forecast rain. A gap or missing hourly field stops the forecast; incomplete coverage cannot produce a 24-hour peak headline. The older six-hour extrapolation now uses the same outlook calculations.

The preview can be rebuilt with `node tools/fire-index-review.mjs` after refreshing live data. It is self-contained and works when opened as a local file. Automated browser visual inspection was blocked by the browser tool's local-file URL policy; regression checks cover the rendered SVG, peak/current presentation, and slider/hover behavior, but are not a substitute for screenshot verification.

## Autumn adjustment — provisional local model

**Superseded in configuration by `seasonal-v1-preview`:** the fall coefficients below are retained and now shared with an automatic spring profile. See the seasonal switching section below.

Version `autumn-v1-preview` adds seasonal behavior informed by [NC State fire climatology](https://climate.ncsu.edu/fire/learn/climatology/) and the [September 23, 2026 NC Forest Service bulletin](https://content.govdelivery.com/accounts/NCFS/bulletins/42c0dd5). These sources describe leaf litter, dry vegetation, low humidity and wind during the fall fire season. They do **not** prescribe the numerical weights below. This is a local heuristic, not an imported official rating algorithm or an empirically validated fuel-moisture model.

- Seasonal strength increases from zero on October 1 to full on October 15, remains full through December 1, and falls to zero December 15, using Eastern calendar dates. The schedule is a modeling choice approximating seasonal fuel availability, not observed leaf fall. Outside this window the original formula applies.
- At full strength the weather component is 60% low-humidity score and 40% gust score, replacing the original 40% humidity / 35% gust / 25% absolute-temperature split. The weights blend continuously through the ramps. Temperature still has its existing small role in the measured drought-background calculation.
- A bounded fine-fuel-drying proxy adds at most 12 points: `12 × seasonalStrength × clamp(observedDryDays / 14, 0, 1) × humidityScore × (0.5 + 0.5 × gustScore)`. Missing dry-spell data, RH at/above 40%, a measured wetting day of at least 0.10 inch, or active rain at/above 0.01 inch/hour disables this contribution. The 14-day saturation and 12-point bound are explicit local assumptions requiring retrospective evaluation.
- Existing wet-weather caps apply after the seasonal adjustment. No minimum category is forced. The adjustment does not change drought scores, claim measured fine-fuel moisture, or infer site-specific storm debris. Current and forecast scores use the same implementation and their own timestamps.
- Removed a stale `trendInput` argument left behind in the API route after the prior six-hour-outlook refactor. The live route now completes successfully with the shared hourly model.

The fixed October 22 afternoon comparison (69.4°F, 20% RH, 18.1 mph gust, drought 35, nine analyzed dry days) changes from 38 to 47. At 50°F with those same humidity/wind/background inputs, the previous score was 35 and the autumn score is also 47. The humid-morning example remains 13; the wet-day example remains capped at 28. These scenario checks establish intended behavior, not agreement with observed fire outcomes. Full replay against historical fire-weather events and non-events is still needed for empirical calibration.

`node tools/fire-index-autumn-review.mjs` writes nine comparisons to `.tmp/fire-index/autumn-comparison.json`. The live refresh at 9:40 a.m. Eastern produced current fire 15 and a peak of 51 (Elevated) at 5 p.m., with 24% RH and 21.3 mph gusts. This newer forecast differs from the fixed comparison inputs. All 552 tests passed, including season boundaries, cool-weather sensitivity, moisture suppression, hourly parity and missing-data behavior. The refreshed local review includes the seasonal explanation; no production release has occurred.

## Automatic fall/spring switching

`seasonal-v1-preview` selects a profile using Eastern dates. The default is `auto`; no annual code edit is required.

| Profile | Ramp in | Full strength | Ramp out |
| --- | --- | --- | --- |
| Spring | March 1–15 | March 15–April 15 | April 15–May 15 |
| Fall | October 1–15 | October 15–December 1 | December 1–15 |
| Standard | Applies outside the spring/fall windows | Original weights | Blends with seasonal weights during ramps |

Spring represents exposed fuels before green-up; fall represents leaf-litter season. Both use the same provisional cool-season weather coefficients and dry-spell proxy; there is not yet evidence to justify separate numerical fuel calibrations. Calendar windows are local approximations informed by NC State climatology, not observed vegetation or fuel moisture. The transition advances in small daily steps. Standard mode still reacts to drought, dry air and wind; it does not turn off fire risk in winter or summer.

The server setting `FIRE_WEATHER_SEASON` accepts `auto`, `fall`, `spring`, or `standard`. Unset means `auto`. An explicit season override applies that profile at full strength and is carried into every forecast point. Use it for an unusually early/late season; return it to `auto` afterward. Changing an actual hosted setting follows the site's normal configuration/release process; no hosted setting was changed here. Invalid values fail explicitly rather than silently selecting a different profile. `DROUGHT_FIRE_MODULE_ENABLED` remains a separate homepage visibility switch.

API calibration metadata reports version, requested mode, effective profile and seasonal strength. The graph explanation follows the effective profile, so spring does not retain fall-specific wording. Current and hourly calculations share `seasonalFireComponents`; forecast timestamps select their own automatic blend even across midnight. Drought is unchanged by profile selection.

Validation: 556 tests passed, including a full-year fixed-weather sweep (no transition jump larger than two rounded points), spring/fall/year/leap-day boundaries, Eastern-date handling, manual overrides, wet-weather suppression, spring forecast parity, and profile-specific copy. This validates switching mechanics, not empirical fire-outcome calibration. Production remains unchanged.
