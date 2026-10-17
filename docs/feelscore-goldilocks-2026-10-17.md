# Southeast Goldilocks investigation — October 17, 2026

Implemented locally in `C:\Users\Tim\828codeproject\828-weather-direct`, after reading its `AGENTS.md`. No deployment, publication, refresh, push or production setting change was performed. Existing unrelated working changes were preserved.

## Exact cause

The generator's precipitation-source contract contradicted the engine's Goldilocks gate. `parseDwmlBatch` always labeled precipitation as either `no-precipitation-weather-code` or `inferred-from-NDFD-weather-coverage`. `isGoldilocksHour` accepted only an absent source or `hourly-pop`. Consequently **no generated hour could reach category 5**, including dry hours with every ordinary ceiling/cap at 5. Classification explicitly demoted these hours from 5 to 4, but omitted this extra gate from diagnostics. Tests used unlabelled synthetic inputs and explicitly expected the generated dry source to fail.

The live API capture at `.tmp/goldilocks/captured-live.json` exactly matches the reported forecast: October 18, generated October 17 at **20:28:48.724 UTC**, 1,968 points, 789 category-4 points, zero category-5 points. All **1,965** category-4 hours whose reported ceilings/modifiers allowed 5 had the rejected dry source. This is a source-contract defect, not an accidental initial score of 4 or a missing promotion.

A separate unit defect understated wind: the English-unit NWS DWML response explicitly returns sustained wind and gusts in **knots**. The parser copied these values into `windMph`/`gustMph` without conversion. The checked-in Nashville DWML fixture was retrieved separately at 21:56:38 UTC and confirms these units and valid empty dry-weather records. The parser now converts knots to mph without rounding, supports explicitly labelled mph and meters/second, and treats unknown units as missing.

## Complete data path

1. `scripts/generate-feelscore.mjs` requests NWS multi-point DWML using `Unit=e`, temperature, dew point, sustained/gust wind, sky, weather codes and QPF. The 0.25-degree land grid, Southeast boundaries and local noon–3 PM window are unchanged.
2. `lib/feelscore/nws-dwml.js` resolves local timestamps and interval values. Temperature/dew point are Fahrenheit; cloud cover is percent; QPF is inches. Wind now converts the returned unit to mph. Rain/thunder probabilities are coverage-code estimates, **not measured hourly PoP**. A present empty weather record is a dry signal; a missing parameter, missing interval or `xsi:nil` record now yields `weather-unavailable`/null rain probability instead of a fabricated dry signal.
3. `lib/feelscore/summer-v1.6.js` applies temperature/dew point ceilings, wind and cloud downgrades, rain/thunder risk caps, and then strict Goldilocks eligibility. Version is now v1.6.1. Numeric comfort thresholds were not widened.
4. `scorePeriod` classifies each hour and aggregates the four hours. Every hour includes `reasoning.goldilocks` (individual check results and failed check names), `goldilocksCap`, and, when ordinary scoring completes, `categoryBeforeGoldilocks`. Existing ceilings/modifiers remain visible.
5. The generator serializes scored points, QA counts and the shared `goldilocksCriteria` into dated JSON, plus the existing CSV summary. The refresh workflow publishes dated data on main; it does not deploy the website. The API router loads `lib/api-routes/se-feelscore.js`, which validates and forwards the published JSON unchanged, adding the period label. It does not calculate comfort or strip diagnostics.
6. `public/se_feelscore.html` loads `public/js/se-feelscore-page.js`, which requests `/api/router?route=se-feelscore`, passes `finalCategory` to `buildCategoryLookup`, and renders the existing category colors. The generator's smoothed `displayValue` is not used to select map categories. The client blends neighboring category colors, which can soften tiny regions, but neither reclassifies points nor imposes a category-4 maximum. The existing inspector in QA mode now includes source/precipitation/thunder flags and the actual eligibility diagnostics. No layout, color, category name, geography or forecast-window change was made.

## Final Goldilocks criteria

All numeric boundaries below are inclusive, require finite numbers, and use unrounded inputs:

| Input | Required range / condition |
| --- | --- |
| Temperature | 67–76°F |
| Dew point | 35–53°F |
| Sustained wind | 0–10 mph |
| Gust | 0–15 mph |
| Precipitation probability | 0–10% |
| Precipitation source | Actual `hourly-pop` or valid `no-precipitation-weather-code`; unlabelled numerical inputs remain compatible with existing direct engine callers |
| Weather flags | No precipitation expected and no thunder indicated |
| Ordinary scoring | Temperature/dew ceilings and rain/thunder caps must allow 5; no wind/cloud downgrade |
| Period | All four local noon, 1, 2 and 3 PM hours must reach 5 and pass eligibility |

The existing extra dew-point restriction (35–53°F versus the ordinary category-5 ceiling through 57°F) remains. The cloud downgrade remains: within Goldilocks temperatures, 90%+ cloud cover downgrades hours at 67–72°F; the existing model has no cloud downgrade at 73–76°F. Missing cloud cover retains its existing no-downgrade behavior. Thunder indication blocks Goldilocks; the existing numerical thunder cap starts at 50%. No season/date-dependent exception was added.

## Aggregation retained

Ordinary aggregation sorts the four hourly categories and selects the second lowest, meaning **three of four hours must meet or exceed a category**. Persistent rain/thunder caps and the two-likely-rain-hours exclusion still apply.

There is a separate intentional Goldilocks exception: **four-for-four**, otherwise a maximum of 4. Thus `[4,4,5,5]` and `[4,5,5,5]` both produce 4; `[5,5,5,5]` produces 5. Diagnostics now show `qualifyingHours`, `requiredHours: 4`, eligibility and the period Goldilocks cap. Retained because fixing provenance already makes sustained exceptional weather attainable without reducing persistence.

Nashville at 36.25, -86.75 changes from `[3,4,4,4]` to **`[3,4,5,5]`**. Its 68°F/37°F dew point afternoon hours were blocked only by precipitation provenance. Noon (62°F) and 1 PM (66°F) still fail temperature eligibility. Its period correctly stays **4**, with only two Goldilocks hours. Knot conversion does not change these categories.

## Captured forecast replay

Run `node scripts/replay-feelscore.mjs .tmp/goldilocks/captured-live.json --legacy-knots`. This is a read-only replay; it does not publish or alter public forecast files. `--legacy-knots` is restricted to v1.6 captures to prevent double conversion. Summary also saved at `.tmp/goldilocks/replay-results.json`.

| Period category | Original | Eligibility fix only | Including correct wind units |
| --- | ---: | ---: | ---: |
| 0 — Unshaded | 136 | 136 | 204 |
| 1 — just alright | 326 | 326 | 394 |
| 2 — Fine, I guess | 530 | 530 | 458 |
| 3 — Nice! | 187 | 187 | 160 |
| 4 — B.E.A. utiful | 789 | 674 | 656 |
| 5 — Goldilocks | 0 | 115 | 96 |

Hourly category counts, 0 through 5: original `[608,1236,1626,1037,3365,0]`; eligibility only `[608,1236,1626,1037,1822,1543]`; including wind conversion `[869,1453,1362,983,1804,1401]`.

These are observations, not distribution targets. Stronger wind penalties after conversion explain the increases in categories 0 and 1. The replay reuses captured inputs; the old JSON cannot distinguish missing weather from a real empty weather record. Fresh generation from DWML additionally applies the missing-weather guard. The full 1,968-point grid was not downloaded again, so replay counts are not a claim about a newly generated forecast.

## Files and validation

- `lib/feelscore/summer-v1.6.js`: source contract, strict shared criteria, hourly and period diagnostics, patch version.
- `lib/feelscore/nws-dwml.js`: correct wind units; distinguish missing and dry weather.
- `scripts/generate-feelscore.mjs`: serialize shared Goldilocks criteria.
- `public/js/se-feelscore-page.js`: expose all eligibility inputs in the existing QA inspector.
- `tests/feelscore-engine.test.js`: correct obsolete dry-source expectation.
- `test/se-feelscore-goldilocks.test.js`: ideal conditions; every numeric boundary; source/flag vetoes; Nashville; two/three/four-hour persistence; adverse weather; real DWML conversion/missing data/wet weather; API serialization through map contour sampling.
- `test/fixtures/feelscore/nashville-2026-10-18.json` and `.dwml`: captured Nashville API point and independently retrieved NWS response.
- `scripts/replay-feelscore.mjs`: reproducible read-only before/after report.
- This investigation report.

The complete repository suite passed **517/517 tests**, with zero failures or skips, using `node --test test/*.test.js test/*.test.mjs tests/*.test.js` (includes the separate engine suite and `.mjs` tests). See `.tmp/goldilocks/full-tests.log` for the result. Focused checks also cover live date rollover, validation, refresh scheduling, and contour behavior.

## Release still required

Code remains local and has not been published or deployed. The engine/parser changes must be reviewed and land on current main, then a guarded forecast refresh must regenerate/publish dated data. The live API consumes that data without needing a backend deployment. A website deployment is needed for the expanded inspector JavaScript. Production promotion remains a separate explicitly approved action under `AGENTS.md`; automatic custom-domain assignment stays disabled.
