# Current FEELSCORE platform parity — October 16, 2026

Desktop, mobile web, and Android now consume `public/js/intel/current-comfort.js` for the Home FEELSCORE. A fresh station observation supplies the current score; nearby hourly guidance is the fallback. A period average is no longer presented as the current mobile/Android score. Missing readings remain unavailable instead of becoming zero-valued weather or a fabricated score.

The model shares observation unit conversion, timestamp normalization, current-score calculation, six-hour selection, upcoming weather copy, observed rain/lightning/radar priority, the 18-hour comfort curve, and its sustained best window. Mobile weather caching and the desktop refresh interval use the same one-minute constant. Desktop's separate camera sky card retains its existing camera interpretation; that interpretation no longer changes only desktop's FEELSCORE summary.

For identical weather, storm context, stored recent-rain state, and evaluation time, all three consumers return the same Home score and weather wording. Independently refreshed devices can briefly differ when they receive different observations. The calendar-day Today/Tomorrow detail windows retain their explicitly scoped summaries.

Regression coverage executes the actual desktop and mobile render functions with shared fresh/dry, rainy, nearby-storm, stale-observation, and missing-observation fixtures. The same tests can include Android's real mobile source via `ANDROID_MOBILE_SOURCE`. Model tests cover units, incomplete/stale inputs, rain/radar/lightning priority, curve anchoring, sustained windows, and different device time zones.

Android's native wrapper and navigation remain separate. Its build bundles the same seven shared source files as the web release; source hashes, bundle inputs, and the copied Android assets are checked. An already installed APK still needs an updated build and installation to receive packaged UI logic. No device or Play Store rollout is implied by copying assets.

Release uses current main, required rain/sky ancestors, the full suite, a verified staged production build, and the owner-authorized promotion. Automatic custom-domain assignment stays disabled; the fog experiment is excluded.
