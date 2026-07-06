# Play Store Internal Testing Checklist — KitaMo Android

Goal: get the first internal-testing build into a small trusted tester group's hands. Internal testing comes FIRST — before closed testing, open testing, or production. Nothing in this checklist publishes the app publicly.

## Prerequisites

- [ ] Real-phone QA pass complete (see `docs/pilot/android-seller-pilot-checklist.md`).
- [ ] All repo checks green: `typecheck`, `lint`, `check:pricing`, `check:recipes`, `check:production`, `check:cogs`, `check:fixedcosts`, `check:pilot`, `npx expo export --platform android`.
- [ ] Real app icon + splash assets added (currently Expo placeholders — required before upload looks presentable, and adaptive icon foreground is missing).
- [ ] Privacy policy hosted at a public URL (draft: `privacy-policy-draft.md`; Play Console requires a URL, not a document).

## Google Play Console account

- [ ] Google Play Console developer account created ($25 one-time) under the owner's Google account.
- [ ] Developer identity verification completed (can take days — start early).
- [ ] "KitaMo (Pilot)" app created in the Console: App → Create app → App/Game: App, Free, package `ph.kitamo.pilot`.
- [ ] Data Safety form filled using `data-safety-draft.md` (final answers reviewed by the owner).
- [ ] Content rating questionnaire completed (business/productivity app, no user-generated public content).
- [ ] Target audience: 18+ (business tool).

## App signing

- [ ] Use Play App Signing (default; Google holds the app signing key).
- [ ] Let EAS manage the upload keystore (recommended: accept the default when running the first `eas build`). Record where the credentials live: EAS servers under the Expo account.
- [ ] Do NOT commit any keystore file to the repo.

## Build artifact (EAS)

One-time setup (interactive, requires the owner's Expo account — not scripted):

- [ ] `npm install -g eas-cli` and `eas login`.
- [ ] `eas build:configure` — links the repo to an EAS project (`extra.eas.projectId` gets written to `app.json`; commit that change).
- [ ] Confirm `app.json` android block: package `ph.kitamo.pilot`, versionCode `1`, version `0.1.0`.

Build:

- [ ] Internal test APK/AAB: `eas build -p android --profile production` (app-bundle, required by Play) — this is a cloud build; run only when ready.
- [ ] Download the `.aab` artifact from the EAS dashboard.

## Upload to internal testing

- [ ] Play Console → Testing → Internal testing → Create new release.
- [ ] Upload the `.aab`.
- [ ] Release name: `0.1.0 (1) — pilot`. Release notes: paste from `release-notes-internal.md`.
- [ ] Save → Review release → Start rollout to Internal testing.

## Tester list

- [ ] Create an email list (Testing → Internal testing → Testers): up to 100 testers; start with 3–10 trusted people.
- [ ] Each tester's Google account email added to the list.
- [ ] Copy the opt-in URL and send it with `internal-tester-guide.md`.

## Install/test

- [ ] Tester opens the opt-in URL, accepts, installs from the Play Store link.
- [ ] Tester follows the smoke test below, then the full guide.

## Smoke test (5 minutes)

1. Launch → choose Try Demo Data → Home loads with demo stall.
2. Tap Start Selling → sell 8 Sushi Rolls → receipt shows ₱150 (bundle price).
3. Records shows the sale; Insights shows the kita.
4. Kill the app, reopen → data still there.
5. Nothing overlaps the status bar or the Android navigation area.

## Issue reporting

Use the format in `internal-tester-guide.md` (screen, steps, expected, actual, screenshot, phone model + Android version). Collect in one shared chat/thread.

## Next build / rollback

- Next build: bump `version` (e.g. 0.1.1) and `versionCode` (2) in `app.json`, rebuild, upload as a new internal release. versionCode must always increase.
- Rollback: internal testing has no true rollback; upload a fixed higher-versionCode build instead. Testers get it automatically from the Play Store.
- Promote to closed testing only after internal feedback is folded in — not part of this phase.
