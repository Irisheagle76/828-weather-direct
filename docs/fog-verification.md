# Fog verification and threshold calibration

The authenticated admin page `/admin/fog/index.html` records direct observations
and human-reviewed webcam evidence for Haw Creek and North Downtown/JCC. It is
available from the admin landing page. No public crowd reports or automatic
camera classifications enter the ground-truth dataset.

## What is predicted?

The index itself remains a current radiation-fog setup index. This experiment
tests whether that saved score can predict **fog present one hour later**. It
does not yet predict onset, duration, or visibility. A report verifies a point
in time, not whether fog appeared anywhere during an entire hour or night.

Authenticated collection stores both the original score bounds and component
values, model version, source observation time, archive issue time, and the
one-hour target time. Records are immutable within each station's five-minute
sampling slot. Delayed collection uses its actual issue time; it cannot create
a backdated forecast. Stale and missing core observations are not archived.
The existing public fog endpoint remains read-only.

## Observations

Choose a station, actual observation time, fog/no-fog/uncertain, and direct or
webcam-reviewed evidence. Times are entered in the device's clearly displayed
timezone and stored as UTC instants. Label times must be within the past 30 days.
Saving the same station/minute explicitly updates its label, never its forecast.

For webcam review, select a registered camera and describe visible neighborhood
landmarks. Fog/no-fog requires a confirmed location and a frame timestamp within
five minutes of the observation. An uncertain label may omit an unknown frame
time. Regional cameras do not automatically verify either station: ensure the
neighborhood is actually visible. The links open current images, not a historical
archive; never use a new image as evidence for an earlier observation. This
version stores the review, camera ID, timestamp and notes, not the image itself.

Uncertain reports are retained but excluded from scoring. Missing reports never
mean no fog. Review clear periods as well as fog events, independently of score,
to reduce selective reporting. Reports are human judgments, not instrumented
visibility measurements. No dense-fog or measured-visibility label is inferred.

## Matching and evaluation

Only same-station predictions with targets within ten minutes of an observation
are eligible (roughly 50–70 minutes lead). Choose the nearest target, breaking
ties with the earlier prediction. Never reconstruct a forecast after observing
its outcome. Unmatched reports stay stored for inspection.

The current model version is evaluated separately. Use one earliest eligible
case per station per Asheville noon-to-noon episode, preventing repeated reports
from a single fog event from dominating. This is an episode-level guard, not a
proof that adjacent weather events are statistically independent.

Baseline threshold: lower score bound >=61. Show hits, false alarms, misses,
correct negatives, and balanced accuracy (mean fog detection and no-fog
specificity). Display source counts and retain separate direct/webcam summaries.
No probability calibration or claims of forecast superiority are made.

After at least 30 episodes, fit thresholds 31/41/51/61/71/81 using the earliest
70%, with baseline 61 winning ties. Require at least five fog and five no-fog
training cases and three of each in the later 30% holdout. Compare the selected
candidate with 61 on that untouched chronological holdout. These are provisional
minimums, not statistical significance criteria. Repeated examination of the
same holdout can overfit decisions; confirm any proposed change on subsequent
new nights and across seasons before releasing it.

Candidates are review-only. This module never changes model weights, live scores,
homepage visibility rules, alerts, or deployment settings. Future weight fitting
can replay the saved component values once more balanced, independently reviewed
evidence is available.

## Storage and release setup

- Uses the existing server-side `@vercel/kv` connection. There is no silent local
  file fallback. A failed write/readback is shown as an error; reload before retry.
- Forecasts and observations are stored in separate daily hashes under
  `fog:verification:v1:*`, expiring 400 days after their UTC day. Analysis reads
  the last 120 days of labels and only matching forecast slots, plus recent
  forecasts for the review page. Notes are limited to 500 characters.
- GET `tempest/fog-verification` and POST with `action=review` require the existing
  admin session. POST `action=sample` accepts an admin session or CRON_SECRET
  bearer token. The sampler cannot read or submit labels.
- The local-only workflow file `fog-verification.yml` is gated by repository
  variable `FOG_VERIFICATION_ENABLED=true`. After an approved release, verify KV
  access through the admin page, confirm repository CRON_SECRET matches the
  deployment, then enable that variable. Collection runs every 15 minutes when
  GitHub scheduling permits; delays/gaps are visible and never synthesized.
- The collector calls the live endpoint only. It does not commit, build, promote,
  or change deployment configuration. No workflow has been enabled by this code
  change. No production samples or ground-truth labels were written during tests.

Run `node --test test/fog-verification.test.js test/fog-index.test.js`.
For a safe interactive demo, run `node tools/fog-verification-preview.mjs` and
open http://127.0.0.1:4194. It uses synthetic predictions and in-memory reports,
clearly labeled as a demo, with no production storage or credentials. Its local
authentication bypass exists only inside that loopback preview tool.
