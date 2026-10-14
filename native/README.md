# 828 Weather native app foundation

This is the Android/iOS app project, separate from the installable mobile website. It reuses the existing mobile UI and shared weather logic, bundles that interface locally, and reads live public data from https://avlweather.com.

## Commands

From the repository root:

    npm ci --prefix native
    npm run sync --prefix native
    npm test --prefix native
    npm run android --prefix native
    npm run ios --prefix native

The last two commands require Android Studio or macOS/Xcode respectively. Sync copies the built UI into both native projects. Generated web assets are ignored; rebuild before opening or compiling.

## Current status

- Android Studio project generated in native/android.
- iOS Xcode/Swift Package Manager project generated in native/ios.
- Shared interface bundles successfully.
- Explicit native HTTPS transport reads public API routes; native writes are intentionally not configured.
- Website links and camera sources open through the native browser plugin.
- Android back navigation returns to Home before exiting.
- Browser service-worker registration is excluded from the native bundle.
- Push plugin installed; Apple/Android credentials and native token registration/delivery are NOT configured.
- Native notification controls are deliberately disabled and explain that integration is pending.
- Native app ID com.avlweather.app is provisional and must be confirmed before store registration.
- Icons and splash screens are generated template assets; branded store assets remain to be created.

## Build limitations

No APK, Android App Bundle or signed iOS archive has been built yet. The current Windows environment has no detected Java/Android SDK; it cannot run Xcode. Generating these projects is not equivalent to compiling or device testing them.

Do not use server.url for production builds. This project packages local assets. Website backend deployment remains separately gated.

## Dependencies

Runtime packages are pinned. npm audit --omit=dev currently reports zero findings. The CLI development dependency chain currently reports three moderate findings involving xcode/uuid; reassess before establishing build CI. Do not apply a forced major/downgrade audit fix blindly.

## Before device testing

1. Install/configure Android Studio, required SDK/JDK and a device or emulator.
2. Build an Android debug APK and verify all screens, network failures, external links and back navigation.
3. Arrange Mac/Xcode access or a reviewed macOS build service for iOS compilation.
4. Confirm the app ID and signing identities.
5. Connect native push, then test admin publishing on native builds (web tests do not prove native push).
