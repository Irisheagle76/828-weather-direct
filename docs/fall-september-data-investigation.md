# September temperature source investigation — October 5, 2026

## Findings

Howard Neufeld's original explanation defines monthly mean temperature as the average of each day's high and low, averaged over the month. His published historical anchors are September 2012 = 62.1°F and September 2018 = 69.4°F. His reference landscape is Boone–Grandfather, approximately 3,300 ft; the stated applicable elevation range is 2,500–4,000 ft. The explanation does not identify a weather station, station ID, observation-day convention, or weather-data provider.

Primary source: https://fallcolorguy.org/color-timing-trends

## Public records obtained

Calculated using mean((daily maximum + daily minimum) / 2), without rounding daily values.

| Dataset | September 2012 | September 2018 | September 2026 | Assessment |
| --- | ---: | ---: | ---: | --- |
| Neufeld's published values | 62.1°F | 69.4°F | Not established | Original calibration anchors |
| NOAA Boone 1 SE, USC00310982 | 60.43°F; 30 days | 67.05°F; 30 days | 65.57°F; **29 days only** | Historical values do not match; September 13, 2026 absent |
| Boone airport TNB/KTNB, IEM NC_ASOS daily summaries | 61.07°F; 30 days | 68.23°F; 30 days | 66.97°F; 30 days | Complete candidate monthly record, but historical values do not match |

NOAA attribute strings were `,,7` for 2012/2018 and `,,H` for 2026 (empty measurement and quality flags). Airport daily records did not have `tmpf_est` marked true. Complete airport daily-summary coverage does not establish full within-day sensor completeness, equivalence to a daily extreme thermometer, or the original model's observation-day convention. No missing values were imputed.

Saved raw responses:

- fall-boone-noaa-2012.json
- fall-boone-noaa-2018.json
- fall-boone-noaa-2026.json
- fall-boone-airport-2012.json
- fall-boone-airport-2018.json
- fall-boone-airport-2026.json

NOAA request pattern: https://www.ncei.noaa.gov/access/services/data/v1?dataset=daily-summaries&stations=USC00310982&startDate=2026-09-01&endDate=2026-09-30&dataTypes=TMAX,TMIN&units=standard&format=json&includeAttributes=true

Airport request pattern: https://mesonet.agron.iastate.edu/api/1/daily.json?station=TNB&network=NC_ASOS&year=2026&month=9

The NOAA candidate differs from the original historical anchors by about 1.67–2.35°F; the airport candidate differs by about 1.03–1.17°F. These differences are material for a regression moving roughly 1.90 days per degree. Neither candidate is a verified direct replacement. No correction offset was fitted from these two years.

## Next step

Request the station/data-provider identity and a complete September 2026 monthly value from Neufeld. His official Appalachian State directory lists neufeldhs@appstate.edu: https://biology.appstate.edu/directory/dr-howard-s-neufeld

No external message has been sent. No seasonal input, staged deployment, or production assignment has changed during this investigation.
