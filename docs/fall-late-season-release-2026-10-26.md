# Fall Explorer late-season release — October 26, 2026

Owner-approved production release of the reviewed elevation graphic, five-label weather legend, expandable visitor advice, readable short methodology, camera ordering/freshness labels, and past-window seasonal messaging. Adds a repository playbook for next fall.

Prepared on current origin/main bca73d58. Preserves main's solar-daylight cutoffs, missing-data behavior, September-input validation, camera sources and Howard Neufeld research credit. No sky logic, homepage fog integration, forecast API, scheduled refresh logic or production settings are changed. The existing API's available forecast horizon is shown by date; this release does not add the separate seven-day API/history proposal.

Validation before staging: all 559 JS/MJS tests across test/ and tests/ passed. Required ancestors b0da55e7 and f222a23d verified. Homepage has no fog-experiment integration. Automatic custom-domain assignment verified false. Production staging and promotion must use deploy-production and preserve its local .gitignore.
