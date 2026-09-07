# Asheville Micronet Meteorological Audit

## September 6 pressure-normalization addendum

The ingest now preserves the pressure datum instead of assuming every provider field is already reduced to sea level. Explicit station pressure is converted to a common elevation-adjusted comparison using the NWS standard-atmosphere relationship. Weather Underground pressure is treated as ambiguous: the raw and elevation-adjusted candidates are compared with explicit sea-level references, and values without a decisive datum are withheld. The comparison field is `normalizedPressureMb`; reported, inferred, and unresolved provenance remains attached to every observation.

This corrects the categorical 934–945 mb versus 1,010–1,019 mb mismatch. It does not yet solve persistent individual sensor bias. Pressure-gradient storytelling should remain experimental until inferred datums and station offsets are validated over retained history against trusted references.

Date of audit: September 5, 2026
Project: `C:\Users\Tim\828codeproject\828-weather-direct`
Production presentation reviewed: `public/asheville-microscope.html`
Experimental presentation: `public/asheville-microscope-lab.html`

## Executive finding

The network is already much more than a temperature-spread display. Its current payload can support robust anomaly rankings, multi-variable spatial spreads, an experimental network-agreement score, a current elevation cross-section, pairwise neighborhood gradients, and cautious rainfall clustering. It cannot yet support responsible detection of inversions through time, cold-air drainage, fronts, outflows, urban heat, station fingerprints, or rolling rainfall because the Asheville micronet does not retain a synchronized history.

The central opportunity is to give the network memory. A two-minute append-only archive, combined with better terrain and siting metadata, would convert the current snapshot product into a boundary, rainfall, inversion, and microclimate observatory.

## Five most promising discoveries

1. **Network agreement and network spread answer different questions.** At the audited 4:28 PM snapshot, 26 fresh stations showed high robust agreement while still spanning 11.3°F. That combination describes an organized regional pattern containing meaningful local departures; KAVL alone cannot show it.
2. **Elevation is relevant but not sufficient.** The robust temperature gradient was -6.45°F per 1,000 feet, yet its spatial R² was only 0.04. The broad lapse signal existed, but elevation explained very little station-to-station variance. Exposure, shade, land cover, and neighborhood geography were dominating individual readings.
3. **Near-elevation pairs are unusually powerful.** Stations separated by only a few vertical feet can differ sharply. Ranking these pairs is a defensible way to spotlight exposure and neighborhood effects without over-crediting elevation.
4. **Rainfall localization is immediately visible but not yet measurable through time.** Twenty-four stations currently provide rain rate and daily accumulation. That is enough to identify a wet footprint and provisional multi-station clusters, but not onset, duration, rolling totals, propagation, or antecedent stress.
5. **The ingredients for boundary detection already exist.** Twenty-six current stations expose temperature, dew point, wind speed, gust, and wind direction. Adding synchronized history would make conservative outflow, frontal-passage, cold-wedge, and downslope signature experiments possible.

## Current network inventory

The registry contains 30 unique physical stations: 18 Asheville core stations, 4 Greater Asheville anchors, and 8 mountain-corridor stations. Grove Arcade is correctly represented once, with its Weather Underground and PWSWeather identifiers retained as aliases.

| Station | Scope | Latitude | Longitude | Elev. | Provider / station ID | Exposure | Audit snapshot |
|---|---|---:|---:|---:|---|---|---|
| Huntington Chase | Core | 35.615642 | -82.505577 | 2,331 ft | Tempest 127602 | Residential, trees | Fresh |
| Biltmore Forest | Core | 35.535242 | -82.541958 | 2,167 ft | WU KNCBILTM2 | Heavily forested, grass | Fresh |
| Five Points Neighborhood | Core | 35.606835 | -82.557007 | 2,147 ft | WU KNCASHEV275 | Trees, shrubbery | Fresh |
| Grove Arcade | Core | 35.595288 | -82.556713 | 2,240 ft | NOAA/NCEI; aliases KNCASHEV475/C9566 | Rooftop, little obstruction | Fresh |
| River Arts District | Core | 35.585890 | -82.574944 | 2,100 ft | WU KNCASHEV276 | Trees, shrubs | Fresh |
| West Asheville | Core | 35.584047 | -82.598074 | 2,174 ft | WU KNCASHEV461 | Residential | Fresh |
| Biltmore Lake | Core | 35.532517 | -82.652317 | 2,107 ft | WU KNCBILTM9 | Lakeside, forested | Fresh |
| Biltmore Park | Core | 35.489010 | -82.555990 | 2,200 ft | WU KNCASHEV400 | Residential, grass | Fresh |
| Asheville Municipal Golf Course | Core | 35.581130 | -82.504980 | 2,106 ft | WU KNCASHEV167 | Residential, grass | Fresh |
| Near AC Reynolds Middle School | Core | 35.554948 | -82.491854 | 2,245 ft | WU KNCASHEV419 | Heavily forested | Fresh |
| Bent Creek | Core | 35.510940 | -82.609800 | 2,200 ft | WU KNCASHEV389 | Grass, trees | Fresh |
| Grove Park | Core | 35.626530 | -82.545620 | 2,266 ft | WU KNCASHEV37 | Partly open | Fresh |
| Beaverdam / Country Club | Core | 35.640983 | -82.547020 | 2,165 ft | WU KNCASHEV431 | Minimal obstruction | Fresh |
| Sand Hill | Core | 35.553050 | -82.635040 | 2,175 ft | WU KNCASHEV455 | Grass, trees | Temporarily unavailable |
| Biltmore Village | Core | 35.565100 | -82.540160 | 2,048 ft | Tempest 131000 | Residential | Provider request failed |
| Asheville High School | Core | 35.574371 | -82.557913 | 2,129 ft | PWSWeather VICTORIA | Residential | Feed not configured |
| UNC Asheville | Core | 35.621802 | -82.566086 | 2,357 ft | NC ECONet UNCA | Unobstructed research tower | Fresh |
| Biltmore Estate | Core | 35.556629 | -82.580465 | 2,185 ft | WeatherLink UUID | Open agricultural field | Access not authorized |
| Woodfin | Greater Asheville | 35.630000 | -82.580000 | 2,089 ft | WU KNCWOODF17 | Grass, trees | Fresh |
| Swannanoa | Greater Asheville | 35.600000 | -82.400000 | 2,182 ft | WU KNCSWANN72 | Fairly unobstructed | Fresh |
| Arden | Greater Asheville | 35.474182 | -82.514275 | 2,295 ft | WU KNCARDEN41 | Trees, shrubbery | Fresh |
| Candler | Greater Asheville | 35.553288 | -82.706545 | 2,189 ft | WU KNCCANDL27 | Rural, mostly open | Fresh |
| Weaverville | North corridor | 35.691948 | -82.565973 | 2,107 ft | WU KNCWEAVE201 | Some trees | Fresh |
| Mars Hill | North corridor | 35.830308 | -82.521096 | 2,329 ft | WU KNCMARSH66 | Agricultural, mostly open | Fresh |
| Black Mountain | East corridor | 35.620114 | -82.296392 | 2,574 ft | WU KNCBLACK203 | Heavily forested | Fresh |
| Old Fort | East corridor | 35.629704 | -82.180129 | 1,444 ft | WU KNCOLDFO12 | Firehouse rooftop, open | Fresh |
| Fletcher | South corridor | 35.423839 | -82.509489 | 2,067 ft | WU KNCFLETC53 | Trees, shrubbery | Fresh |
| Hendersonville | South corridor | 35.321153 | -82.480590 | 2,200 ft | WU KNCHENDE608 | Trees, shrubbery | Fresh |
| Canton | West corridor | 35.529513 | -82.842261 | 2,585 ft | WU KNCCANTO154 | Rooftop, mostly open | Fresh |
| Waynesville | West corridor | 35.482100 | -82.999015 | 2,800 ft | WU KNCWAYNE342 | Trees, shrubbery | Fresh |

Residential coordinates are generalized in the public API according to each station's configured precision. Pair distances on the public page should therefore be treated as approximate.

## Sources, cadence, and available variables

The page requests a new network payload every 60 seconds. The API retains only a 60-second in-memory cache. Provider timestamps in the audit snapshot ranged from essentially current to 13.2 minutes old; median WU age was about 0.3 minute. This does not guarantee a fixed station cadence because PWS console upload intervals vary.

| Provider | Cataloged / reporting | Current variables normalized |
|---|---:|---|
| Weather Underground | 24 / 23 | Temperature, dew point, humidity, wind speed, gust, direction, reported pressure, rain rate, daily rain, solar radiation, UV, provider QC status |
| Tempest | 2 / 1 | Temperature, dew point, humidity, wind speed, gust, direction, station/sea-level pressure when supplied, rain rate, daily rain, solar, UV, lightning distance/count |
| NOAA/NCEI Grove Arcade | 1 / 1 | Temperature, dew point, humidity, wind/gust/direction, station and sea-level pressure, rain rate, daily/60-minute/24-hour rain, solar, UV |
| NC ECONet UNC Asheville | 1 / 1 | Temperature, dew point, humidity, wind/gust/direction, station pressure, hourly/24-hour/7-day rain, solar, WBGT |
| PWSWeather | 1 / 0 | No authorized machine-readable ingestion configured |
| WeatherLink | 1 / 0 | No authorized API access configured |

Audit-snapshot field coverage:

| Variable | Stations |
|---|---:|
| Temperature, dew point, humidity | 26 |
| Wind speed, gust, direction | 26 |
| Reported pressure | 24 |
| Station pressure explicitly identified | 3 |
| Rain rate, daily rain | 24 |
| 60-minute / 24-hour rain | 2 |
| 7-day rain | 1 |
| Solar radiation | 19 |
| UV | 18 |
| Lightning | 1 |
| WBGT | 1 |

## What is already derived

The existing production microscope derives and presents:

- Core and regional temperature spreads and bookends
- Reporting/fresh counts and source availability
- High-versus-low elevation temperature averages
- A linear elevation-adjusted station baseline
- Closest-elevation station comparisons
- Temperature, dew-point, and wind display modes
- Moisture and wind leaders
- A current event-aware rain-rate callout
- Greater Asheville and four mountain-corridor comparisons
- Freshness and physical-range quality flags

The production page was not changed during this experiment.

## What can be derived immediately

| Analysis | Supported now? | Operational value | Public value | Safe to automate? | Notes |
|---|---|---|---|---|---|
| Median/MAD anomaly ranking | Yes | High | High | Yes, with QC | Works for temperature, dew point, wind, gust, rain, and solar. Pressure must wait for datum normalization. |
| Spread, IQR, MAD | Yes | High | High | Yes | Distinguishes uniform from spatially variable conditions. CV is useful for wind/rain but not especially meaningful for Fahrenheit temperature. |
| Network agreement | Yes | High | High | Experimental | Use variable coverage and robust dispersion; do not imply sensor quality. |
| Current elevation cross-section | Yes | High | High | With caveats | Theil–Sen slope is preferable to ordinary least squares; always show sample count and coherence/R². |
| Elevation vs dew point/wind/rain | Yes | Moderate | Moderate | Exploratory | Useful as a clue, not a cause. |
| Pairwise comparison | Yes | High | High | Yes | Especially valuable for nearby or matched-elevation pairs. |
| Current rainfall footprint | Yes | High | High | With caveats | Rain-rate clustering can require two or more agreeing stations for meaningful confidence. |
| Current moisture geography | Yes | High | High | Yes | Dew-point medians, anomalies, and geographic clusters reveal features KAVL cannot. |
| Current wind exposure clues | Partial | Moderate | High | No classification yet | Instantaneous differences cannot establish a station fingerprint. |
| Solar/shade contrast | Partial | Moderate | High | No classification yet | Strongly affected by clouds, shade, sensor cleanliness, and obstruction. |
| Pressure gradient | Not safely | Potentially high | Moderate | No | A common datum is not verified across all providers; the audited spread was physically implausible for this domain. |

## What requires retained history

The following should not be automated from current snapshots alone:

- Five-, 15-, 30-, and 60-minute rates of change
- Rolling 5-minute through 24-hour rainfall
- Rain onset, duration, and cluster propagation
- Cold-pool onset, peak, and erosion
- Valley/slope/ridge cooling rates after sunset
- Front, outflow, shallow wedge, and downslope passage timing
- Freezing-line movement
- Wind roses and persistent channeling
- Urban/suburban/rural nighttime heat signatures
- Station fingerprints and persistent bias
- Percentile or rarity of a current network state
- Seasonal inversion, rainfall-localization, and moisture climatologies

The repository contains a separate fall-observation shadow history with a bounded KV list, but it is not the Asheville micronet archive, covers a different registry/use case, and is not sufficient for these analyses.

## Metadata needed next

Elevation and free-text exposure are helpful, but the following structured metadata would materially improve interpretations:

1. Terrain class: valley floor, drainage, lower slope, midslope, ridge/shoulder, rooftop
2. Height above local valley floor, not only sea-level elevation
3. Sensor height above ground/roof and mounting type
4. Standardized exposure: open, partial, sheltered, forest canopy, rooftop, lakeside, agricultural
5. Land cover and urbanization within approximately 100 m and 500 m
6. Obstruction direction/height, especially for wind and solar
7. Rain-gauge type, maintenance date, heating capability, and known undercatch concerns
8. Watershed, sub-basin, nearest stream, and hydrologic response class
9. Station clock/cadence and provider reset semantics
10. Metadata version and effective dates so a moved sensor does not contaminate its earlier fingerprint

## Quality-control findings

### Existing strengths

- Fresh, delayed, and stale classes
- Future/missing timestamp detection
- Plausible ranges for temperature, dew point, humidity, wind, pressure, and precipitation rate
- Dew point above temperature check
- Unavailable stations remain visible rather than silently disappearing
- Residential coordinate precision is reduced publicly
- Grove Arcade aliases prevent physical duplication

### Gaps discovered

1. **Pressure datum mismatch:** reported pressure values are not demonstrably comparable across providers. The 4:28 PM snapshot ranged from roughly 934 to 1019 mb, which is a datum/normalization signal, not a real Asheville pressure gradient.
2. **No temporal jump QC:** the micronet service does not retain the prior observation, so temperature, humidity, pressure, wind, and rain jumps cannot be screened.
3. **No duplicate-timestamp suppression:** a station may be fetched repeatedly without a new provider observation.
4. **No rain-counter reset logic:** daily accumulation resets or console restarts can create false negative/positive increments once history is added.
5. **No neighbor-consistency test:** a gross local departure is not compared with nearby stations before it drives a headline.
6. **No persistent-bias model:** station-specific warm/cool or wet/dry tendencies are unknown.
7. **Provider QC is not decisive:** WU QC status is retained but not used to block or downgrade a network interpretation.
8. **Wind direction needs circular handling:** calm winds and 359°/1° transitions cannot be treated with ordinary arithmetic.
9. **Daily rainfall semantics may differ:** local-day reset conventions and gauge behavior need validation across providers.
10. **Four stations were unavailable in the audit snapshot:** Sand Hill, Biltmore Village, Asheville High School, and Biltmore Estate.

## Experimental analyses implemented

The separate lab page implements:

- Robust per-variable median, IQR, MAD, spread, and CV where displayed
- “Most unusual stations” ranking using robust z-scores
- Network-agreement score based on coverage and robust temperature/dew-point dispersion
- Theil–Sen elevation relationship with classification and spatial R²/coherence
- Actual-coordinate spatial gradient explorer for eight current variables
- Any-two-station comparison with distance and multi-variable differences
- Provisional eight-mile rainfall connected-component clustering
- Current rain-localization state
- Up-to-three conservative “interesting now” signals
- Readiness matrix separating snapshot-ready from history-dependent analyses
- Visible QC gaps and unavailable-station reporting

All experimental interpretation remains outside `asheville-microscope.html`.

## Most valuable operational experiments

1. **Rain cluster and rainfall stress monitor**, after rolling accumulation is stored
2. **Outflow/front/wedge arrival sequence**, using synchronized multi-variable change points
3. **Cold-pool/inversion lifecycle**, keyed to sunset, wind, and cloud/solar conditions
4. **Network consensus and anomaly engine**, with neighbor and persistent-bias QC
5. **Pressure tendency and boundary tracking**, after datum normalization

## Most valuable public storytelling experiments

1. “Most unusual neighborhood right now”
2. Matched-elevation neighborhood contrasts
3. “Where Asheville is wet—and where it is not”
4. Cold-pool formation/erosion timeline on clear nights
5. A conservative “what is meteorologically interesting right now?” feed

## Recommended history design

Store raw normalized samples rather than only derived headlines.

- **Cadence:** ingest every 2 minutes; keep provider observation time and ingest time separately
- **Raw retention:** two-minute observations for at least 30 days
- **Aggregates:** five-minute data for at least two years; hourly and daily aggregates indefinitely
- **Core fields:** station ID, metadata version, source timestamp, ingest timestamp, QC state/flags, temperature, dew point, humidity, wind speed/gust/direction, station pressure, sea-level pressure, pressure datum flag, rain rate, raw cumulative rain counter, derived increment, solar, UV, lightning
- **Derived after ingest:** 5/15/30/60-minute changes; 5/15/30/60-minute and 3/6/24-hour rain; vector-mean wind; neighbor residuals; network median/MAD; elevation residual
- **Storage:** use a time-series-capable database or append-only object files. The existing KV lists are useful for small bounded histories, but are not ideal as the long-term micronet archive.
- **Sampling discipline:** do not manufacture a new observation when the provider timestamp has not advanced
- **Metadata:** retain effective dates for moves, sensor replacements, and exposure changes

## Recommended next steps

1. Review the experimental lab and select the two or three analyses worth pursuing.
2. Normalize pressure to explicit station or sea-level pressure before any pressure comparison.
3. Add structured terrain and exposure metadata, beginning with valley/slope/ridge and sensor mounting.
4. Implement an append-only observation archive with two-minute polling and duplicate suppression.
5. Add temporal QC, rainfall reset handling, and neighbor-consistency checks before boundary or flood experiments.
6. Accumulate at least 30 clear nights before evaluating cold-air drainage and at least one warm season before judging rainfall fingerprints.
7. Keep all automated event language conservative and confidence-qualified; never present the flood experiment as an NWS warning.

## Files created or changed by this experiment

Created:

- `public/asheville-microscope-lab.html`
- `public/js/asheville-microscope-lab-analysis.js`
- `test/asheville-microscope-lab-analysis.test.js`
- `docs/asheville-micronet-meteorological-audit.md`

Not changed:

- `public/asheville-microscope.html` (SHA-256 at start and completion: `153F3D679AA8A3187BB80B1F95CA06E68CB6F08B27383A12A1F01F6532E80E6D`)
