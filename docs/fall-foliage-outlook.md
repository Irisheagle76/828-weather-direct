# Automatic foliage consequence outlook

The page presents one short consequence headline per destination and one regional category. Expanded analysis follows the requested Primary Category, Impact Level, Confidence, Headline, Weather Cause, Expected Visual Result, Beneficiaries, and Next 7 Days format. No owner color-report workflow is required.

## Decision framework

`foliage-consequences.js` evaluates weather combinations and estimated seasonal stage, rather than mapping a minimum temperature directly to a damage label. It supports Color Enhancement, Color Preservation, Color Acceleration, Color Arrest, Color Degradation, Premature Leaf Drop, Patchy Elevation Impacts (regional), Foliage Reset Event, and Season Shutdown.

Examples tested:

- Sunny, cool nonfreezing nights during the estimated developing stage favor enhancement.
- A sharper cool-down or repeated light freezing during development can favor acceleration.
- Gentle weather during an estimated mature stage favors retention, without claiming observed peak color.
- The same sustained colder freeze suggests arrest before full color and degradation later.
- Wind after colder exposure or sustained rain on mature leaves can make leaf drop the primary consequence.
- Contrasting destination categories plus a weather contrast across elevation bands yield Patchy Elevation Impacts.
- Reset requires prolonged severe cold combined with strong winds. Shutdown also requires repeated freezing nights and an estimated post-peak stage. Public wording describes risk, not verified widespread canopy loss.

Operational numeric diagnostics include uninterrupted hourly cold runs, consecutive sampled freezing nights, cooling between forecast days, sunshine fraction, rain totals and wet-hour duration, and gusts before/after freezing. These screening choices are editorial heuristics, not fitted biological thresholds, calibrated probabilities or a validated end-date model. A first-freeze milestone alone cannot diagnose injury. Isolated historical temperature samples cannot establish cold duration.

## Stage and confidence

The automatic stage estimate uses a deliberately broad seasonal reference from [NPS Smokies guidance](https://www.nps.gov/grsm/planyourvisit/fallcolor.htm): color develops above 4,000 ft in early/mid October, and the lower/mid-elevation display commonly falls between mid October and early November. The implementation uses Oct 1–15 and Oct 15–Nov 7 as broad editorial planning windows; before the window is developing/early change, during is near peak, and after is post-peak. These windows are not a validated local stage model. Actual trees, aspects and individual years can differ substantially.

All current consequence assessments have Low confidence because current canopy stage is inferred and drought/soil moisture are unavailable. The existing drought/fire endpoint can silently use an older or dry-biased soil fallback, so it is not reused as observed foliage moisture health. Missing sunlight, wind/rain coverage, and forecast days are disclosed. No verified peak, tissue damage, canopy loss or season end is claimed.

The existing Boone–Grandfather September regression remains unchanged and is not extrapolated to these destinations. A future automated phenology source could improve stage confidence without requiring owner reports. It would need dated, local evidence and validation before enabling confident peak/leaf-off claims.

## Data and preview

The Fall API requests up to seven days of NWS grid hours, reuses retained observation shadow samples for a 14-day aggregate, and loads current-season confirmed milestones. Historical aggregation publishes counts/minima rather than raw batches or credentials. Read failure falls back to fresh observations/milestones. Stale forecasts are excluded. Gaps are never interpolated into observed freeze duration.

The local preview consumes the existing published forecast API, which may provide only five days and no history aggregate. It explicitly reports an incomplete seven-day outlook in that case. The updated API's seven-day request and history path require the normal staged-release process before production. Nothing in this feature promotes a deployment.

## Scientific scope

[NOAA](https://www.noaa.gov/stories/cool-autumn-weather-reveals-nature-s-true-hues) and [NPS](https://www.nps.gov/blri/learn/nature/fall-colors.htm) support directional relationships between sunlight, moisture, temperature and leaf retention. They do not validate the implementation's numerical cutoffs or specific local outcomes. Historical canopy/phenology outcomes paired with local weather would be required for a calibrated remaining-season model.
