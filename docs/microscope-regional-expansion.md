# Regional station expansion — November 4, 2026

Add NC ECONet FLET (Mills River), WAYN (Waynesville), BURN (Burnsville), BEAR (Bearwallow), and FRYI (Frying Pan) to the shared Microscope/Terrain network. Eleven active stations total. Regional observations populate the corridor display and Terrain corridor/all filters; the city summary retains five core sites plus hourly KAVL. Preserve archived Weather Underground definitions. Keep half-hour refresh scheduling.

Replace historical corridor display placeholders with usable observations, including mobile cards. Unavailable corridors explicitly show no usable reports.

## Additional source investigation

Bent Creek / NC Arboretum: NOAA USCRN Asheville 8 SSW, WBAN 53877, has an accessible unauthenticated hourly file:
https://www.ncei.noaa.gov/pub/data/uscrn/products/hourly02/2026/CRNH0203-2026-NC_Asheville_8_SSW.txt
Verified November 4: latest row 20261104 2300 UTC. Follow NOAA field definitions at https://www.ncei.noaa.gov/pub/data/uscrn/products/hourly02/README.txt . Use UTC date/time, T_CALC for last-five-minute air temperature, reject missing sentinels, honor measurement flags, convert Celsius to Fahrenheit, and preserve hourly precipitation as an accumulation. Use hourly freshness limits and a shared cached collection, not a download per visitor. Annual rollover must check the previous year until the new file is available. This station is a verified next integration candidate, not part of this five-station release.

CWOP candidates CW1465/CW5364 (Weaverville), GW0501 (Swannanoa), DW0892/DW5747 (Leicester): public findu wxpage requests returned HTTP 200 but no weather reports for each ID. A successful HTTP response or directory listing does not prove a usable station. Keep these inactive until current timestamped observations and metadata are verified. Synoptic metadata/latest services can help discover active replacement stations; authenticated access and redistribution terms must be established first. https://docs.synopticdata.com/services

No provider guarantees permanent availability. Keep adapters separate, retain last observation timestamps, and expose unavailable data honestly.
