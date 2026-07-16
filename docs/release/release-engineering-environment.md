# KitaMo Android Release Engineering Environment

Last verified: 2026-07-14 (Asia/Manila)

This document records the workstation and account prerequisites for the `1.0.0 (1)` Internal Testing candidate. It contains no passwords, tokens, keystore material, or Play credentials.

## Installed workstation tools

- macOS arm64
- Node.js `20.20.2` (Homebrew `node@20`, first in shell `PATH`)
- npm `10.8.2`
- OpenJDK `17.0.19` (`JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home`)
- Android Studio Quail `2026.1.1 Patch 2`
- Android SDK: platform/API 36, Build Tools 36.0.0 and 35.0.0
- Android Platform Tools / ADB `37.0.0`
- Android Emulator `36.6.11`
- Android NDK `27.1.12297006`, CMake `3.22.1`
- bundletool `1.18.3`
- Watchman `2026.07.06.00`
- EAS CLI `20.5.1`

Shell configuration defines `JAVA_HOME`, `ANDROID_HOME`, `ANDROID_SDK_ROOT`, and places Node 20, the emulator, platform tools, and command-line tools on `PATH`.

## Android virtual devices

- `KitaMo_LowEnd_API28`: Android 9 / API 28, Nexus 5 profile, 2 GB RAM, 2 CPU cores.
- `KitaMo_16KB_API35`: Android 15 / API 35, Pixel 6 profile, 16 KB page-size system image.

These support constrained-device and 16 KB compatibility checks. A real low-end phone remains required before rollout because an emulator cannot reproduce vendor firmware, thermal throttling, storage pressure, or real biometric behavior.

## Expo and EAS

- Signed-in user: `rawbeans`
- Organization: `kitamoandroidapp`
- Project: `@kitamoandroidapp/kitamo-android`
- EAS project ID: `d2ab769c-4916-4efa-ab1e-a2dfdc638607`
- Android credentials: EAS-managed keystore; never store or commit the keystore in this repository.
- `preview` profile: internal-distribution APK.
- `production` profile: Android App Bundle for Google Play.
- No EAS environment variables are configured for preview or production. This is intentional for the local-only release.
- Preview build complete: `f3b64c64-04d0-4f71-ac54-1ceba8029403`.
- Final production AAB complete: `362a9631-f557-4ac4-9b0c-b770c10ea637`, built from commit `376b2f12598d36939d25dd8cd61398ab7bb93746` with the EAS-managed upload keystore.
- Final build page: `https://expo.dev/accounts/kitamoandroidapp/projects/kitamo-android/builds/362a9631-f557-4ac4-9b0c-b770c10ea637`.
- Final artifact URL: `https://expo.dev/artifacts/eas/TgXP3hkOEQ2gZrfJ_4IgV_XpcWMsm9TKFIaH0fnNGr4.aab`.
- Downloaded ignored artifact: `release-artifacts/KitaMo-1.0.0-production-eas-376b2f1.aab`.
- SHA-256: `51c515df2b9da82687f68fd553e4f4936801c77bea650c44190ae4538fa6efcd`.
- Validation passed: bundletool structure/config, EAS AAB upload-key signature, package `ph.kitamo.app`, version `1.0.0 (1)`, min API 24, target API 36, `allowBackup=false`, approved permission set with no Internet/camera/microphone/storage/location/Bluetooth permission, QA universal-APK v2/v3 signatures, clean emulator install/launch, APK 16 KB zip alignment, and ELF load-segment alignment across all 40 arm64/x86_64 libraries.

## Human-owned prerequisites before Play upload

1. A verified Google Play Console developer account with access to create/manage KitaMo.
2. A Play Console app named `KitaMo` using package `ph.kitamo.app`. The package cannot be changed after the first upload.
3. A final public support email monitored by the KitaMo team.
4. A public HTTPS privacy-policy URL hosting the approved content from `docs/play-store/privacy-policy-draft.md`.
5. Final website URL if one will be shown in the store listing; it is optional, unlike the support email and privacy policy.
6. A tester email list and the people authorized to receive the Internal Testing opt-in link.
7. Final owner review of the Data Safety and content-rating answers.
8. Real-phone screenshots captured from the signed candidate, following `docs/play-store/screenshot-plan.md`.
9. Play App Signing enabled when the first AAB is uploaded.
10. Owner approval to start the Internal Testing rollout after the Play pre-launch report is reviewed.

Do not put Play Console credentials, Google service-account JSON, passwords, or keystore files in this repository. EAS Submit is intentionally not configured until the Play app exists and the owner chooses whether to provide a narrowly scoped Google service account.

## Release artifact handling

Downloaded APK/AAB files belong under ignored `release-artifacts/`. Validate their package, version, permissions, signature, and 16 KB alignment, but do not commit binaries or signing material.

Inspect the completed release artifacts with:

```sh
eas build:view f3b64c64-04d0-4f71-ac54-1ceba8029403
eas build:view 362a9631-f557-4ac4-9b0c-b770c10ea637
```

The exact final AAB is ready for an Internal Testing upload. Do not run `eas submit` until the Play Console app, privacy URL, support email, tester list, and owner-approved Data Safety answers exist.
