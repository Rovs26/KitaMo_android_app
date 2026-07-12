# Play Store Internal Testing Checklist — KitaMo Android

Goal: get the first internal-testing build into a small trusted tester group's hands. Internal testing comes FIRST — before closed testing, open testing, or production. Nothing in this checklist publishes the app publicly.

## Prerequisites

- [ ] Real-phone QA pass complete (see `docs/pilot/android-seller-pilot-checklist.md`).
- [x] All local checks green: `typecheck`, `lint`, Expo Doctor 17/17, seven regression commands including `check:migrations`, Metro start, and production Android export.
- [x] App icon, adaptive icon, splash, Play icon, and feature graphic added and visually checked.
- [ ] Privacy policy hosted at a public URL (draft: `privacy-policy-draft.md`; Play Console requires a URL, not a document).
- [ ] Final support email supplied and added to the listing/privacy policy.
- [ ] Signed build tested on a low-end physical Android device.

## Google Play Console account

- [ ] Google Play Console developer account created ($25 one-time) under the owner's Google account.
- [ ] Developer identity verification completed (can take days — start early).
- [ ] "KitaMo" app created in the Console: App → Create app → App/Game: App, Free, package `ph.kitamo.app`.
- [ ] Data Safety form filled using `data-safety-draft.md` (final answers reviewed by the owner).
- [ ] Content rating questionnaire completed (business/productivity app, no user-generated public content).
- [ ] Target audience: 18+ (business tool).

## App signing

- [ ] Use Play App Signing (default; Google holds the app signing key).
- [ ] Let EAS manage the upload keystore (recommended: accept the default when running the first `eas build`). Record where the credentials live: EAS servers under the Expo account.
- [ ] Do NOT commit any keystore file to the repo.

## Build artifact (EAS)

One-time setup:

- [x] `eas login` completed as `rawbeans`, with owner access to organization `kitamoandroidapp`.
- [x] `eas build:configure` and project link completed for `@kitamoandroidapp/kitamo-android`.
- [x] Confirm `app.json`: name `KitaMo`, package `ph.kitamo.app`, versionCode `1`, version `1.0.0`, backup disabled, release permissions minimized.

Build:

- [x] Standalone preview APK built with the EAS-managed keystore (`f3b64c64-04d0-4f71-ac54-1ceba8029403`).
- [ ] Download/install that EAS APK and complete the full physical-device regression.
- [ ] Internal Play AAB: `eas build -p android --profile production` (app-bundle, required by Play).
- [ ] Download the `.aab` artifact from the EAS dashboard.
- [ ] Verify APK/AAB permissions and 16 KB native-library alignment.

## Upload to internal testing

- [ ] Play Console → Testing → Internal testing → Create new release.
- [ ] Upload the `.aab`.
- [ ] Release name: `1.0.0 (1) - pilot`. Release notes: paste from `release-notes-internal.md`.
- [ ] Save → Review release → Start rollout to Internal testing.

## Tester list

- [ ] Create an email list (Testing → Internal testing → Testers): up to 100 testers; start with 3–10 trusted people.
- [ ] Each tester's Google account email added to the list.
- [ ] Copy the opt-in URL and send it with `internal-tester-guide.md`.

## Install/test

- [ ] Tester opens the opt-in URL, accepts, installs from the Play Store link.
- [ ] Tester follows the smoke test below, then the full guide.

## Smoke test (5 minutes)

1. Launch → choose Try Demo Data → Home loads with the selected demo business and stall context.
2. Enter Kiosk from Home → explicitly choose/confirm the demo stall → sell 8 Sushi Rolls → receipt shows ₱150 (bundle price).
3. Records shows the sale; Insights shows the kita.
4. Kill the app, reopen → Owner context and data remain, but Kiosk requires stall confirmation again.
5. Business/stall context does not overlap the status bar, bottom tabs, or large text on a 360×800 device.

## Issue reporting

Use the format in `internal-tester-guide.md` (screen, steps, expected, actual, screenshot, phone model + Android version). Collect in one shared chat/thread.

## Next build / rollback

- Next build: bump `version` (e.g. 1.0.1) and `versionCode` (2) in `app.json`, rebuild, upload as a new internal release. versionCode must always increase.
- Rollback: internal testing has no true rollback; upload a fixed higher-versionCode build instead. Testers get it automatically from the Play Store.
- Promote to closed testing only after internal feedback is folded in — not part of this phase.
