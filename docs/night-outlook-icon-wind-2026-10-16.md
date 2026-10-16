# Night outlook icons and wind guidance

Use forecast sunrise and sunset to select night icons for clear or partly cloudy hours and rain chances. Fall back to Asheville local time when solar guidance is unavailable. Include notable forecast gusts (20 mph or higher) with their peak timing in the visible rolling narrative; otherwise mention a sustained breeze of 12 mph or higher. Use only upcoming hours and explicitly identify times after midnight. Shared presentation logic serves desktop, mobile web, and the Android bundle without changing FEELSCORE calibration.

Regression coverage includes seasonal daylight, overnight mixed skies and rain chances, gust timing, elapsed gust exclusion, and missing/light winds. Release verification includes all repository test suites, Android bundle source parity, and staged weather/API checks.
