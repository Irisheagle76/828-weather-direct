# Production deployment guard

- Before any production deployment, fetch `origin/main` and verify the deployment candidate contains commit `f222a23d` (`Handle bright pixels in sky analysis`). Do not deploy an older commit unless the user explicitly requests a rollback.
- Treat a replacement of the Sunset Radiance / Sky Snapshot logic as a recognized new update only when it is committed on top of `origin/main`, explains the intended behavior, and passes `test/current-sky-analysis.test.js` plus the shared sky-language tests.
- Scheduled sky-camera, hiking, and FEELSCORE refreshes are data/content updates. They must build on the current `origin/main`, must not rewrite `lib/api-routes/sky/current.js` or the shared sky-state modules, and must not trigger a production deployment by themselves.
- Use the dedicated `C:\Users\Tim\828codeproject\828-weather-direct-deploy` checkout only from its `deploy-production` branch, fast-forwarded to `origin/main`. Preserve its local `.gitignore` change.
