# Downtown I-240 camera release — October 23, 2026

Owner-requested production update to the Sky & Sunset camera desk:

- Replace the unavailable Chamber player with DriveNC camera 4204 and the supplied NCDOT HLS stream.
- Label it Downtown I-240 traffic camera, describing the west-facing Charlotte Street view.
- Load live video on request with native HLS or pinned HLS.js 1.6.13, a still preview, playback controls, and failure/retry handling.
- Temporarily remove the unavailable UNC Asheville tower camera card and its display references. Preserve the source registry and refresh infrastructure for later restoration.
- Preserve automated sky analysis, sunset scoring, other camera cards, and the unfinished fog experiment. No homepage fog integration is released.

Prepared on current origin/main (45c16bc3), containing b0da55e7 and f222a23d. Full JS/MJS suite: 537 passing, zero failures. Live NCDOT playlist and frame decoding succeeded; local browser playback verified. Production build must remain staged until verification and promotion for this approved release; autoAssignCustomDomains remains false.
