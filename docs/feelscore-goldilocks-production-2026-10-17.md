# Goldilocks production release — October 17, 2026

Owner authorized production release for desktop and mobile. This recognized code release includes engine fix 8770836a39cf0d407fb4d1fa9157b12eae70cd18, the subsequent guarded October 18 forecast refresh, and an updated inspector script cache version. It accepts valid NDFD dry-weather evidence, rejects missing weather as dry evidence, converts knots to mph, and exposes strict Goldilocks eligibility diagnostics. Numeric comfort thresholds, four-for-four Goldilocks persistence, penalties, colors, geography and forecast hours remain unchanged.

Desktop and mobile regional maps consume the same published category values; the mobile focused payload does not rescore. Android's regional view reads the same API, so this server-side data correction needs no APK change. The full Southeast page inspector receives its updated JavaScript through this website release.

Fresh forecast: 2026-10-17T22:15:47.742Z; 1968 land points; zero missing; category counts 0–5: {"0":211,"1":390,"2":455,"3":160,"4":656,"5":96}. These are live inputs, not a distribution target.

The release requires a complete passing suite on current origin/main, required rain/sky ancestors, staged production verification and owner-authorized promotion. Keep autoAssignCustomDomains=false. Preserve the dedicated checkout's .gitignore, unrelated working changes, and the excluded fog experiment. Deployment and live verification results are retained in the task's local release records.
