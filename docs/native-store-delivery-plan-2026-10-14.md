# Store delivery plan — October 14, 2026

Goal: independently installable 828 Weather apps distributed through Google Play and Apple's App Store.

Owner currently has neither store developer account and has no Mac. No accounts were created, subscriptions purchased, signing credentials generated or store submissions made.

## Milestone 1: native foundation — prepared, not compiled

Native Android and iOS projects now exist in native/. The weather interface is bundled into each project and live data comes from the existing website backend. Native configuration, API transport, external link handling and source packaging checks are in place.

Evidence: native build/sync succeeds; three foundation tests pass; existing 416 JS tests and 16 mobile checks still pass. No real native device test has occurred.

## Milestone 2: first Android development build — next

Configure Android Studio/JDK/SDK, build a debug APK, install it on the owner's Android phone and check the entire UI, API reads, loading/error behavior, media, links, accessibility and navigation. A Play developer account is not required for this debug milestone.

## Milestone 3: iOS development build

Arrange a Mac with Xcode or a reviewed macOS build service. Compile and sign an iPhone test build. Decide signing and device distribution after account access is available. No claim of iOS build readiness until this succeeds.

## Milestone 4: native notifications

Existing browser Web Push remains working and separate. Configure Android Firebase and iOS APNs credentials/capabilities, store native device registrations/preferences, and connect the admin publish event to native delivery without notifying opted-out users. Confirm receipt and tap behavior on both compiled apps. The plugin is installed but no native notifications are currently enabled.

## Milestone 5: store betas

Create owner-controlled Apple Developer and Google Play Console accounts. Confirm app identity before registering it. Prepare branded app icons/splash assets, privacy policy/disclosures, support contact, screenshots and store descriptions. Produce signed Android AAB/iOS archive and distribute through Play testing/TestFlight. Verify current account-specific testing requirements before submission.

## Milestone 6: submission and review

Address beta issues, complete release checks and submit for review. Approval is external and not guaranteed. Store publication is a separate approval from website deployment.

## Relationship to website

The staged /mobile release and shared API backend remain useful and reusable. Promoting the website does not create a signed app or submit to a store. Website and native delivery can progress separately. Existing production deployment remains unchanged; all deployment guards still apply.

No fixed launch date is asserted until the first native builds, account enrollment and testing requirements are established.

References:
- https://capacitorjs.com/docs/getting-started/environment-setup
- https://capacitorjs.com/docs/config
- https://developer.apple.com/app-store/review/guidelines/
