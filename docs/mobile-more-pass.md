# Mobile More: Hiking, Sunset and Live Look

Latest navigation revision: Live Look is now a sixth standalone bottom destination (`#live`), between Pulse and More. Removed its More-menu entry; Hiking/Sunset/Weather Update remain there. Modified only mobile `index.html`, `mobile.js`, `mobile.css` and this report. Reuses the existing camera catalog, cached Chamber still and tap-to-open source behavior. No production navigation or APIs changed. Phone-width checks: six active-state destinations, Live Look cameras, More separation and 58×55px touch targets at 360px.

Latest Chamber interaction: tapping the cached still/play button now opens the existing camera player in a separate tab (`noopener,noreferrer`). The still remains on the mobile page; inline iframe playback is no longer used because it was unreliable in the user's in-app browser. Only `public/mobile/live-look.js` and this report changed for this revision. Capture caching is unchanged.

Local-only work in the C-drive feature checkout. No deployment or production page changes.

## Shared data

- Hiking reads `/data/hiking-guidance.json`, the same published stations, guidance and HikerScore consumed by `public/js/hiking-page.js`. The local preview now proxies the production snapshot rather than serving an outdated bundled copy. No scoring algorithm was added.
- Guidance older than 90 minutes is explicitly last-published, with its publication date/time. Home does not advertise a stale score. Station temperatures, elevations, sky and wind come directly from that snapshot, not an elevation interpolation.
- Sunset reads existing `sky/current` camera analysis and the existing weather payload's sunset time. Cloud context is analysis, not a Radiance score. The displayed sunset window remains a planning estimate.
- The authoritative Radiance engine is inline in `public/828-sunset-radiance.html`: `buildRadiance`, cloud-texture/moisture/clearing/timing functions, phase handling, precipitation overrides and shared dusk fallback. This pass does **not** clone it or change that production page. A tested, explicit shared-engine extraction is still needed to display the exact score on mobile.
- Live Look uses three existing camera sources from the desktop Sunset/Hiking pages. A single mobile camera catalog serves Live Look and the contextual Hiking/Sunset cards. Later centralize this catalog with desktop camera configuration.

## Changed files in this pass

Created:
- `public/mobile/live-look.js`: camera catalog, reusable thumbnail cards and unavailable-image handling.
- `docs/mobile-more-pass.md`: scope, architecture, limitations and verification.

Modified:
- `public/mobile/index.html`: Live Look destination under More; future-product text updated.
- `public/mobile/mobile.js`: Hiking station/camera context and freshness disclosure; clearer Sunset context and stale-analysis handling; Live Look view.
- `public/mobile/mobile.css`: bordered camera cards, station rows and status panels.
- `tools/mobile-preview/server.mjs`: read-only proxy for the existing published Hiking snapshot.

## Verification

- JavaScript syntax check passed.
- Local preview restarted and HTTP/browser loading verified.
- More navigation, Live Look, Hiking and Sunset rendered in browser.
- 390px and 360px phone-width overflow checks passed for all three detail views.
- Three Live Look camera previews loaded. Hiking's two mountain previews and Sunset's western preview loaded.
- Published Hiking snapshot was older than 90 minutes; last-published disclosure rendered and Home avoided the stale score.
- Simulated camera image failure displayed fallback text while retaining the source link.
- Browser page-error collection was empty. One browser-automation CLI process had a Windows allocation error; subsequent browser checks succeeded.

Limitations: no actual Radiance score on mobile yet; camera capture times cannot be independently verified; no live stream embeds/autoplay, auto-refreshing camera timers or new camera API calls. Fresh Hiking and stale Sunset branches are code safeguards, not both live-tested upstream states in this pass.

## Live Look lineup revision

Live Look now contains only Asheville western sky, Asheville Chamber of Commerce and UNC Asheville Tower. Mitchell and Pisgah remain in Hiking. Modified the existing four mobile files (`live-look.js`, `mobile.js`, `index.html`, `mobile.css`) and this report; no production files changed.

The Chamber uses the existing published Videstra player URL and loads an iframe only on a user tap. A direct-source link remains available. UNC Asheville uses the existing Cloudinary tower snapshot. At 390px the lineup, both image previews and no-horizontal-overflow checks passed. The Chamber click created exactly one correctly titled iframe; this verifies player mounting, not the upstream stream's availability. No new camera-analysis calls, refresh timers or publishing workflow were added. More cameras can be added to the catalog later.

## Chamber still-to-live revision

Created `tools/mobile-preview/chamber-snapshot.mjs`; modified preview `server.mjs`, mobile `live-look.js`, `mobile.css` and this report. Existing installed FFmpeg captures a 960px JPEG on local server startup and every five minutes, with single-flight capture, a 30-second timeout, size/JPEG validation and last-good retention. Capture stays in local server memory, shared by all preview visitors; no capture runs per HTTP request. No scheduled Windows task, Cloudinary upload, production endpoint or dependency installation was added.

Local `/mobile-preview/chamber.jpg` serves the cached image; `/mobile-preview/chamber-status.json` reports capture time and refresh failure. The timestamp describes frame extraction time, not a verified upstream camera clock. Opening Live Look shows the still with a play overlay; tap/keyboard activation replaces it with the existing live player. The card updates its displayed still/time when reopened; server capture refreshes independently every five minutes. Failed images retain a tap-to-live fallback. Older stills/refresh failures are labeled.

Verified successful real HLS frame extraction, 960px JPEG loading, capture-time rendering, no iframe before activation, exactly one iframe after activation, no horizontal overflow at 390px, and empty browser page-error output. Syntax checks passed. Five-minute recurrence and upstream outage retention were inspected in code, not timed end-to-end. Before deployment, move capture to an approved shared worker/publishing job and durable image store; the local helper is not a Vercel FFmpeg service.

## Tower preview cache fix

Modified only `public/mobile/live-look.js` and this report. Tower preview and click-through now use an identical 15-minute `v` cache bucket, matching desktop Sunset's existing approach. Other camera URLs and production files are unchanged. Rendering checks confirmed identical preview/link URLs, stable keys within a bucket and different keys at the next bucket. This updates the URL when Live Look is opened/rendered; it does not add a polling timer or guarantee the upstream image's capture freshness.
