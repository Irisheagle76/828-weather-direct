# Fall Explorer staged release — October 5, 2026

Candidate: `9cc85124` on origin/main, following maintenance commit `970dfb2e`.

Staged deployment: https://828-weather-direct-d0qq0knv7-timothys-projects-bab4af31.vercel.app/fall.html

Deployment ID: `dpl_GDchEzgKREvgteV9UwzWczFiP3YW`, READY, production target with custom domains unassigned. Created using the dedicated deploy-production checkout, fast-forwarded to origin/main, preserving its existing .gitignore modification. Required fixes b0da55e7 and f222a23d are ancestors.

Changes: historical-baseline peak headline and seasonal-warmth explanation; frostless-night color explanation; actual solar-daylight viewing windows; explicitly labeled twilight photography; useful-duration preference over brief sunset fragments; graceful unavailable daylight guidance after dark; September-input year/completion guard; official Pisgah Inn hosted-stream link.

Validation: all 371 repository tests passed in both the isolated candidate and deployment checkout. Staged browser rendered live forecasts, milestones, outlook, and camera links; console-error scan was empty. Desktop screenshot verified seasonal copy. Mobile viewport had matching document/content widths (375 pixels) and no horizontal overflow. Final live browser recommendation changed from the original Craggy 7–8 PM to 6 PM–7:07 PM, capped at sunset; photography was separately labeled sunset/twilight.

September mean remains unset. The regression's original station and monthly averaging definition could not be established, so no substitute temperature or revised 2026 peak date was supplied.

Temporary share-link creation was rejected by automatic approval review because it would widen access. No bypass link was created. Verification succeeded using the browser's existing access.

Production promotion has not been performed. autoAssignCustomDomains remains false and the current production target remains dpl_BMdaKeLrsGfPo7ykkn7qXEvM9LC5. Before an approved promotion, fetch current origin/main again; if it advanced, rebuild from the current main and repeat required validation under AGENTS.md. Do not promote the earlier 970dfb2e build.
