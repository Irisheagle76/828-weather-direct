# Regional Comfort Map feasibility

Status: postponed after Phase 7 investigation.

## What exists today

- The primary weather route accepts one latitude/longitude pair and returns normalized hourly temperature, dew point, humidity, wind/gust, precipitation, cloud cover, UV, and weather code.
- The water intelligence backend already demonstrates batched Open-Meteo requests for many known points.
- The fall system has a curated WNC destination/elevation model plus an observation network for Waynesville, Black Mountain, Mount Mitchell approaches, Burnsville/high country, Pisgah/Craggy references, and other mountain sites.
- The public FeelScore engine can score any normalized hour, but it currently lives in the browser-facing intelligence layer and is not part of a cached regional product.
- Existing Leaflet/map projection utilities can be reused for presentation after the data product is trustworthy.

## Why a regional comfort map is not implemented yet

The current systems do not expose one versioned payload containing comparable, current FeelScores for a defined set of WNC towns and elevation destinations. Calling the single-location weather route repeatedly from the browser would add avoidable network load, produce non-atomic update times, and create a parallel client-side weather pipeline. The elevation observation network is valuable context, but station coverage and siting are intentionally uneven; it cannot support invented geographic interpolation between sensors.

## Smallest honest backend addition

1. Define a reviewed location registry with coordinates, elevation, terrain role, and display priority for Asheville, Hendersonville, Black Mountain, Brevard, Waynesville, Burnsville, Mount Mitchell, and selected Pisgah/high-elevation points.
2. Refactor the existing normalized hourly fetch and the existing FeelScore calculation into server/client shared modules rather than copying either algorithm.
3. Add one server-side batched, cached endpoint that returns a single observation/forecast timestamp, source quality, and 12–24 hourly FeelScores for every available location.
4. Preserve missing values. Do not infer a destination score from a distant or elevation-adjusted station unless that adjustment is separately calibrated and disclosed.
5. Version the location registry and FeelScore calibration in the response so map colors and labels remain auditable.
6. Test stale-source behavior, partial location failures, elevation extremes, and cross-location timestamp consistency before rendering a map.

## Recommended first visualization

Start with labeled point markers or an elevation-aware location list, not a continuous heat surface. A continuous surface would imply spatial precision the current data does not support. Only consider interpolation after verifying dense, representative coverage and a documented interpolation method.
