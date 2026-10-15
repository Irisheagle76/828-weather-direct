# Android native notification backend release — October 15, 2026

This recognized release adds the Android native registration/preferences/test endpoint and Firebase Admin SDK delivery. Admin Bulletin and Pulse publishing now routes to browser and native audiences using the existing opt-in topics. It excludes native project files, native credentials, camera scheduling changes and unmerged interface updates.

Firebase configuration was installed as a Vercel Secret in production and preview. Direct Firebase authentication was verified without sending a message. Actual Android delivery remains to be proven after backend promotion and phone rebuild.

Validation: 422 JS suite tests, all 10 MJS tests, 16 mobile checks and forecast syntax checks passed. Includes native device-secret authorization, opt-out, test rate limiting, expired-token cleanup and shared audience result checks.

The production build must remain staged until explicit promotion approval. The previous mobile release is also still pending promotion, so the staged artifact contains that mainline mobile release as well. No neighborhood fog homepage integration is included.
