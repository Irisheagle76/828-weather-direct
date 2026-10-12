# Asheville hiking score and observation freshness

This release scores typical Asheville-area hikes from the four nearby Asheville stations. Regional wind, moisture and strong sun remain separate route warnings; lightning anywhere in the reporting network still triggers an alert. UV and solar exposure share one deduction. Normal temperature differences between elevations or local microclimates no longer reduce the score.

The score label, main guidance and narrative use the same assessment. Near-saturated air is described as a station observation, not confirmation of fog. Current camera views remain independent visual checks.

The hiking page displays the report generation time beside the score and each station's observation time in Eastern time, with its age and fallback status. Reports older than 15 minutes do not display a current score. Missing Mount Mitchell comparisons remain unavailable rather than appearing as zero degrees. The local preview refreshes its upstream snapshot every minute.

Regression coverage includes the October 12 conditions (38 becomes 80 with the original readings), local adverse weather, regional lightning, unavailable observations and disclosed regional fallback scope. Production must be staged and verified before promotion; automatic domain assignment stays disabled.
