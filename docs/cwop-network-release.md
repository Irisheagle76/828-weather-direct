# Seven CWOP stations for Microscope and Terrain

Add seven owner-selected regional stations without changing the local city summary. All use the shared network endpoint and CWOP / FindU attribution. Preserve half-hour UI cadence. CWOP acquisition uses shared KV cooldowns of 30 minutes per station across visitors and deployments, and fails closed if shared storage is unavailable. Collection is demand-driven after the half-hour slot changes, not a guaranteed scheduled fetch at :00/:30. Retain old timestamps when reusing a report; freshness limits 45/75 minutes.

Use documented FindU wxxml.cgi with last=1 instead of large raw packet histories. http://www.findu.com/cgi.html documents a maximum 20 stations at no more than one request per station per five minutes. This integration selects seven and waits at least 30 minutes per station. No uptime guarantee; HTTP transport is provided by this legacy source. XML timestamps are receipt times, labeled accordingly in Terrain. Rain1h is accumulation, never instantaneous rain rate. Daily totals unavailable in this feed remain null. Dew point is derived from temperature and humidity; measurements are not independently quality controlled.

Published station metadata from https://mesowest.utah.edu/cgi-bin/droman/side_mesodyn.cgi?stn=ID verified November 5, 2026 (IDs C7566,D8032,E8444,F9022,G3611,F8612,E5165). Elevations are registered metadata, not survey verification. Public residential coordinates remain rounded to three decimals.

| Call | Name | Latitude | Longitude | Elevation ft |
|---|---|---:|---:|---:|
| CW7566 | Montreat | 35.63946 | -82.30878 | 2640 |
| DW8032 | Black Mountain Southeast | 35.58683 | -82.26883 | 3293 |
| EW8444 | Alexander | 35.69667 | -82.63417 | 2041 |
| FW9022 | Biltmore Lake / Candler | 35.5236 | -82.6623 | 2151 |
| GW3611 | East Canton | 35.54133 | -82.80983 | 2796 |
| FW8612 | Fletcher | 35.469 | -82.47583 | 2234 |
| EW5165 | Flat Rock | 35.25867 | -82.45 | 2394 |
