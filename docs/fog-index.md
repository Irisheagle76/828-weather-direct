# Neighborhood fog potential v1

The calibration release computes separate experimental radiation-fog setup indices for Haw
Creek (Tempest 127602) and North Downtown/JCC (144737), refreshed every five
minutes through GET `/api/router?route=tempest/fog`. This is a current-conditions
index, not a calibrated probability, timed forecast, visibility estimate, dense
fog warning, or evidence that fog is present. It is most useful for nighttime
valley cooling; daytime readings and other fog mechanisms require caution.

The owner's supplied Copilot proposal inspired these provisional weights:

| Input | Maximum points | Rule |
| --- | ---: | --- |
| Temperature minus dew point | 40 | 40 at <=1°F, linearly decreases to 0 at 5°F |
| Wind | 20 | <=2 mph: 20; >2 through 5 mph: 10; >5 mph: 0 |
| Cooling over 3 hours | 15 | >8°F: 15; >5°F: 9; otherwise 0 |
| Rolling 24-hour rain | 10 | >0.10 inches: 10; otherwise 0 |
| Station pressure rise over 6 hours | 10 | >=2 hPa: 10; positive: 5; otherwise 0 |
| Current modeled cloud cover | 5 | <=20%: 5; <=50%: 2.5; <=80%: 1.25; otherwise 0 |

Humidity is used in deriving dew point when necessary, not scored a second time.
The undefined rapid-pressure threshold in the proposal is provisionally 2 hPa
over six hours. Pressure comparisons use the same sensor's station pressure,
never a mixture of station pressure and sea-level pressure. No unvalidated
terrain multiplier, automatic learning, or assertion of superiority to other
forecasts is included. Each neighborhood has its own score.

Missing components produce a lower-to-upper possible score range, without
renormalizing the available weights. The coverage percentage describes available
weights, not predictive confidence. The range is not a statistical confidence
interval. Dry spreads >5°F cap both bounds at 30; spreads >3°F or wind >6 mph cap
them at 60. Bands are Low 0–30, Moderate 31–60, Elevated 61–80, High 81–100.

Current core observations must be within ten minutes and no more than one minute
in the future. Missing/invalid core observations suppress the score. Historical
baselines must be within ten minutes of the target 3-hour/6-hour time. Rain needs
1,440 unique, contiguous minute observations with valid rainfall, ending within
two minutes of the current observation. Gaps or aggregated records leave rain
unknown. Local-day rain is never substituted for rolling rain. Cloud cover uses
Open-Meteo at each station's rounded public coordinates, with a 30-minute
freshness limit and explicit attribution. Source failures remain independent.

The endpoint uses server-only TEMPEST_TOKEN for Haw Creek and JCC_TEMPEST_TOKEN
(falling back to TEMPEST_TOKEN) for JCC. Station IDs are fixed to the registry's
two intended sites and responses are checked for identity. It does not change
TEMPEST_STATION_ID or mix supplemental station observations. Each refresh fetches
station metadata and up to 24 hours of device history; a five-minute per-instance
cache coalesces concurrent requests. Cached observations still expire at ten
minutes. There is no persistent archive or scheduled job.

Validation: `node --test test/fog-index.test.js test/jcc-tempest.test.js`.
The public homepage card is intentionally excluded from this release. Use the admin verification page to archive and review predictions. Credentials are never served to the browser.

Future calibration should pair timestamped scores with independently reviewed
local webcam/visibility labels across both fog and non-fog nights, then evaluate
held-out events before changing weights or presenting probabilities. This
release does not create labels or train automatically.

The optional [fog verification workflow](fog-verification.md) now provides
manual and webcam-reviewed labels, immutable prospective snapshots, and a
review-only threshold comparison. Its collector requires release setup; it does
not automatically alter this index.

References:
- https://www.weather.gov/safety/fog-radiation
- https://www.weather.gov/safety/fog-mountain-valley
- https://apidocs.tempestwx.com/reference/getobservationsbydeviceid
- https://weatherflow.github.io/Tempest/api/udp/v171/
- https://open-meteo.com/en/docs

Production requires a separately reviewed release and the repository's approved
promotion gate. This feature does not modify the sky analysis or deployment settings.
