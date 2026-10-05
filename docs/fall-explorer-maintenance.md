# Fall Explorer autumn maintenance

This release labels October 17 as a historical midpoint when no verified seasonal September mean is supplied. It explains that warm nights can delay progression and that freezing is not required for color. It clips viewing recommendations to forecast sunrise/sunset, explicitly labels sunset photography's 15-minute twilight allowance, and replaces the failed Pisgah Inn still image with its official hosted-camera page.

Seasonal input now requires FALL_SEPTEMBER_MEAN_F, FALL_SEPTEMBER_MEAN_YEAR matching the current Eastern-time year, and optional FALL_SEPTEMBER_MEAN_SOURCE. It is accepted only after September finishes. Values are rejected at annual rollover. No production environment input has been changed.

The original regression's station identity and averaging definition were not found in repository history or the available source material. Public Boone observations cannot safely be substituted until their relationship to that calibration is verified. The date therefore remains a clearly labeled historical baseline; no measured 2026 peak date is claimed.

Pisgah Inn's official page embeds https://live2.brownrice.com/embed/pisgahinn1. Source: https://www.pisgahinn.com/live-video-camera/

Validation includes daylight boundaries in October and after November's DST change, late-day requests, twilight, absent solar data, after-dark forecasts, seasonal-input rollover, baseline wording, and camera routing. Production promotion requires explicit user approval under AGENTS.md.
