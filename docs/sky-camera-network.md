# Asheville sky camera network

Intended update: expand the Sky & Sunset camera read to six directional views, expose per-camera contribution/freshness, and add Fairview as separate regional context. Preserve the North Asheville image as analysis-only.

## Views

| Camera | Direction | Contribution |
| --- | --- | --- |
| Downtown courthouse | West, rotating view | Local sky and western sunset context |
| North Asheville | South-southeast toward downtown | Local sky; never display the image |
| East Asheville | East-northeast | Resolve the verified current @tballisty live broadcast; never pin an expired ID |
| UNC Asheville tower | South toward downtown | Original Cloudinary image; excludes stale images |
| Chamber | Southwest toward Mt. Pisgah | Scheduled HLS frame capture |
| Fairview | Due north toward Swannanoa | Regional view; excluded from the downtown cloud/fog/sunset aggregate |

Fairview metadata supplied by the user: 35.51220208502947, -82.39874320739332, elevation 2,435 feet, station KNCFAIRV101. The supplied map establishes the general northward view, not calibrated left/right bearings or a measured field of view.

## Acquisition and limitations

The API fetches JPEGs with bounded time, byte size and decoder memory. East Asheville first resolves the current verified live video and falls back to a scheduled capture. The `Sky camera network captures` GitHub workflow captures East Asheville and Chamber every ten minutes. It writes only `public/sky-camera-observations/` and does not deploy. Each capture has a source, observation/retrieval time and SHA-256 pairing; mismatched image/manifest pairs fail closed. Unchanged captures retain the previous image time. No private North Asheville image enters these public artifacts.

Cloud estimates are excluded after fifteen minutes, at night (approximate sun elevation below -3 degrees), or when the image classifier cannot obtain a usable sky sample. Retrieval time is explicitly labeled when the source supplies no capture timestamp. HTTP timestamps still depend on the source behaving correctly; they are not an independent verification of the timestamp printed inside the image. Cold serverless instances cannot detect an unchanged direct snapshot across earlier instances.

Use the original UNCA Cloudinary asset for analysis: transformation Last-Modified headers can date the resize rather than the underlying camera capture. At the local check on October 2, the original was dated October 1 at 8:15 PM and was correctly excluded.

These are visible sky slices, not a complete all-sky measurement. Source-specific crops avoid obvious timestamp/ground contamination but require daylight review when the cameras move or their composition changes. The Fairview station link does not add a new weather-observation feed.

## Verification and release

Live local tests successfully fetched Fairview, UNCA, North Asheville and both YouTube thumbnails. A real FFmpeg capture of the Chamber HLS feed and a verified East Asheville capture both succeeded. At test time it was before sunrise, so current dark views were excluded, as intended. The browser displays six source statuses and the Fairview image/card. Shared sky-language, image analysis, network provenance, geographic separation and card tests pass.

Before release, follow AGENTS.md's main/commit/test/staging/promotion gates. Include these code, workflow, UI and documentation changes in a recognized release, preserving unrelated work. After the workflow lands on main, dispatch it to seed current artifacts and verify both manifests through the staged API. Do not promote the resulting data-only refresh as a new release. The approved October 2 release includes the six-camera network, readable observation cards, and the verified scheduled-capture workflow. Both Chamber and East Asheville captures succeeded on GitHub Actions run 37024060131. The complete production-checkout suite passed 385 tests. East Asheville thumbnail resolution verifies public main-video live metadata when playback requires sign-in, without changing the evergreen embed.

## UNC source repair
The October 2 follow-up replaces the stalled Cloudinary mirror with https://www.atms.unca.edu/currwx/towercam.jpg for both display and analysis. The university source is current, while the former mirror depended on a Windows refresh task absent from this machine. The top-aligned display crop and stale-image exclusions remain in place. No local task or Cloudinary upload is required for this camera now.
