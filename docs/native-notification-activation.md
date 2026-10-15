# Native Android push activation

Status: code implemented and tested with mocked delivery; NOT activated or proven on a phone.
iOS push remains disabled until Apple signing/APNs setup. AppDelegate forwarding hooks are prepared, but there is no APNs sender yet.

## Firebase owner steps

1. Create or select an owner-controlled project at https://console.firebase.google.com/ .
2. Add an Android application with package com.avlweather.app. This is the current provisional ID; confirm it before registering a store app.
3. Download google-services.json and place it at native/android/app/google-services.json. This file is ignored by Git.
4. Enable Firebase Cloud Messaging HTTP v1 API if necessary.
5. Create a server service-account credential with Firebase Cloud Messaging sending permission. Store its JSON as FIREBASE_SERVICE_ACCOUNT_JSON in the backend environment. Never put it in the app, a public file, chat or Git. Prefer least-privilege FCM permissions rather than a broad owner credential.

## Backend deployment

The new notifications/native route and combined web/native audience sender must be deployed through the normal production release guard. No backend has been deployed by this implementation. The app currently contacts https://avlweather.com, so local app configuration alone is insufficient.

For preview tests, use a properly configured accessible test backend and explicitly configure the native notification API origin. Do not embed Vercel protection-bypass secrets in a distributable app. Do not enable production domain assignment or promote a data-only build.

## Build and real-device acceptance

After google-services.json is installed:
- npm run sync --prefix native
- Rebuild and reinstall through Android Studio.
- More: choose Bulletin/Pulse, enable native notifications and grant Android permission.
- Send a test to this device.
- Verify receipt with the app open and backgrounded, then tap to open Pulse.
- Publish a genuine Pulse with Notify enabled; verify Pulse-only receives it, Bulletin-only does not.
- Disable notifications, repeat a genuine update and confirm silence.
- Test a Bulletin independently and verify its higher-importance Android channel.
- Confirm both web and native delivery diagnostics. Provider acceptance is not proof of display.

## Implementation

Native installation IDs use random device secrets. Server records store a hash of that secret; it is required to update preferences or send a device test. Android FCM tokens are stored separately from browser subscriptions. Tests are rate-limited per installation; tests never select all subscribers. Token rotation updates the existing installation record on registration. Disabling first saves both preferences false, then unregisters locally. Do not log registration tokens or credentials.

The existing admin publish checkbox invokes web and native audiences with the same topic. Legacy browser subscriptions remain Bulletin-only. Expired FCM registrations are pruned. No automatic subscription to either topic.

References:
https://capacitorjs.com/docs/apis/push-notifications
https://firebase.google.com/docs/cloud-messaging/android/get-started
https://firebase.google.com/docs/cloud-messaging/send/v1-api
