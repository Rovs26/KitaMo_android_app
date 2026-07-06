# Google Play — Internal Testing Execution Plan

How KitaMo reaches testers on Google Play, and why Internal Testing is the correct target now (not public production).

## What Google Play does and does not do

- Google Play **distributes** the KitaMo app (the installable Android bundle) to devices. That's it.
- Google Play does **not run** KitaMo and does **not provide any backend, server, database, or auth** for it. KitaMo is local-first: all data lives on the tester's phone. Uploading to Play changes nothing about how the app stores or computes data.
- Because there is no backend, "publishing" here only means "make the installable app available to a chosen set of testers."

## Recommended release route

1. **Internal Testing (now).** Fastest track, up to 100 testers by email, available within minutes of upload, no Google review wait for the first internal release. This is the correct target tonight.
2. **5–10 real seller testers** for the pilot (night-market/karinderia owners). See `tester-plan.md`.
3. **Prepare 12–15 total tester emails** in advance — this matters for the next step.
4. **Closed Testing** if/when you want public production. New **personal** Play Console developer accounts (created 2023 or later) generally must run **Closed Testing with at least 12 testers opted in for 14 continuous days** before production access is granted. Internal Testing does **not** count toward that 14-day requirement, but it's the right place to shake out bugs first.
5. **Production / Public** only after testing, the 12×14 requirement (if it applies), and Google review. Not the immediate target.

## Why not production tonight

- A brand-new personal developer account likely cannot ship to public production immediately — the 12-tester / 14-day closed-testing gate applies first.
- Even without that gate, production goes through Google review (hours to days). Internal Testing is instant and is where pilot feedback should come from anyway.
- Nothing about KitaMo's value needs public production for the pilot — the sellers you hand-pick install from an internal opt-in link.

## DECISION REQUIRED BEFORE FIRST UPLOAD — package name

The Android **package name is permanent and immutable once the first bundle is uploaded** to any track. It also *is* the app's identity across Internal → Closed → Production (they are tracks of one app, one package).

Current value: `ph.kitamo.pilot` (in `app.json` → `android.package`).

Consequences of uploading with `ph.kitamo.pilot`:

- The production app forever carries `.pilot` in its package ID (invisible to users, but unchangeable).
- You could **not** later ship "the real KitaMo" under `ph.kitamo` as an update to this same listing — that would be a **separate** Play app, losing this listing's testers, history, and any reviews, and restarting the closed-testing clock.

**Recommendation:** if this app is intended to become the real production KitaMo, change the package to a clean permanent id — `ph.kitamo` or `ph.kitamo.app` — **before the first upload**. If it is a genuinely throwaway pilot that a fresh app will replace later, `ph.kitamo.pilot` is fine.

This was **not changed automatically** — it is your call because it is irreversible. To change it: set `android.package` in `app.json`, then rebuild. (The user-facing app title is separate and editable in the Play Console at any time; only the package id is permanent.)

## Current config snapshot (audited)

- App label: `KitaMo (Pilot)` — editable later; Play listing title is set in the Console.
- versionName `0.1.0`, versionCode `1` — ready for the first build.
- `permissions: []`; no camera/location/contacts/microphone/Bluetooth/storage/SMS/ads/analytics/payment. Framework-only INTERNET (unused by features), ACCESS_NETWORK_STATE (online/offline badge), VIBRATE (haptics).
- Expo SDK 54 / RN 0.81.5 → target API 35 (Android 15) by default, meeting Play's current new-app target requirement. **REVIEW**: confirm the target API in the EAS build output before submitting.
- `eas.json` `production` profile builds an Android App Bundle (`.aab`) — the required format for Play.
