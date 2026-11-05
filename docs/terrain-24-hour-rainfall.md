# Terrain rolling 24-hour rainfall

Terrain's rain layer now uses precipitation24HourIn (inches), never rain rate or since-midnight totals. Explicit zero remains zero; incomplete or unavailable totals remain missing. The map reports coverage and popups show the rainfall window ending time when separately collected.

ECONet and Grove Arcade already supply rolling totals. CWOP XML omits them, so one short raw report lookup (last=1 hour) shares each station's existing 30-minute distributed cooldown. APRS lowercase p reports the past 24 hours in hundredths of an inch; uppercase P is not substituted. Reject mismatched identities, stale packets, malformed fields and responses over 100 KB. Source: https://files.tapr.org/software_library/aprs/aprsspec/spec/aprs101m/APRS101m.pdf and http://www.findu.com/cgi.html .

Tempest uses the documented station-device metadata and minute history endpoints, sums interval rain in millimeters, and converts to inches. Only a continuous, non-overlapping full day qualifies. Metadata is cached for a day; history has a shared 30-minute cooldown. NWS history uses explicit quality-controlled hourly accumulation and requires a continuous full day. Missing hourly precipitation is never assumed to be zero. KAVL may therefore have no total even while its other conditions are usable. Source: https://weatherflow.github.io/Tempest/api/swagger/ and https://www.weather.gov/documentation/services-web-api .

History failures and cache outages leave temperature and other conditions intact. Supplemental totals expire after 90 minutes. Collection is demand-driven and cached across visitors; no change to page refresh timing. Existing sky fixes, release controls and fog exclusion are preserved.
