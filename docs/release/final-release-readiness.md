# KitaMo Android — Final Release Readiness

Status as of Chapter 2 Phase 6. This closes the engineering work before Google Play **Internal Testing**. Nothing here publishes the app.

## Current release status

- Branch `main`, local-first Android app, Expo SDK 54, new architecture enabled.
- Full Food Business Engine implemented (grocery → recipe → production → sale COGS → transfers → spoilage → fixed costs → per-stall & consolidated Kita Report).
- Finance-manager Home dashboard, Logbook timeline, and simplified Kita Report (Phase 4).
- Six pure-math check suites plus an end-to-end pilot scenario check — all green.
- `app.json`: name "KitaMo (Pilot)", package `ph.kitamo.pilot`, version `0.1.0`, versionCode `1`, portrait, `permissions: []`.
- `eas.json` profiles ready (development / preview / production).

## What is ready

- All seller flows work end to end on Expo Go and compile to a full Android Hermes bundle (`npx expo export --platform android`).
- Local-first data with Clear Local Data covering all tables; Fresh mode empty; Demo only after Try Demo Data.
- Safe-area shell, bottom nav above the gesture bar, keyboard-safe forms, large-font-scaling caps on titles.
- Seller-facing Taglish labels: Grocery Stock, Paninda, Recipe Cost, Niluto, Bayarin, Logbook, Kita Report, Puhunan / Cost, Natirang paninda, Nasayang.
- Play Store draft materials in `docs/play-store/` (listing, privacy, data safety, tester guide, screenshots, release notes).

## What is NOT yet included (moved to Chapter 3)

- Bluetooth printing.
- Supabase / any backend, cloud sync, accounts/auth.
- Real Lis AI, OCR/camera, payment gateway, Customer Mode, LGU dashboard.
- FIFO finished-goods cost layers (average produced cost is the documented MVP).
- Automatic bill reminders / push notifications.
- Real app icon & splash branding (Expo placeholders in use).

## Features in internal testing

Owner setup, Kiosk selling (cash/GCash/Maya/bank, bundle pricing, discounts, receipts, orders, shift), Grocery Stock, Recipe Cost, Niluto/Production, cook-upon-order COGS with estimated-cost flagging, Transfers, Nasayang, Bayarin, Kita Report, Logbook, Insights, Local Helper, Pilot Guide.

## Known limitations

- Data lives on one device only; uninstall or device loss = data loss (no backup).
- No multi-user, no roles.
- Payment references are typed manually; the app moves no money.
- Not a BIR/official-receipt or tax-compliance tool.

## Manual steps before Play upload

1. Add real adaptive app icon foreground and splash assets.
2. Host the privacy policy at a public URL; set the real support email in the listing.
3. `eas login` then `eas build:configure` (writes `extra.eas.projectId` to `app.json`; commit it).
4. `eas build -p android --profile production` (cloud build — first paid/queued build; run only when ready).
5. In Play Console: create the app, complete Data Safety (from `docs/play-store/data-safety-draft.md`, resolving REVIEW items against the pre-launch report), content rating, and target audience.
6. Upload the `.aab` to Internal testing, add tester emails, send the opt-in link with `docs/play-store/internal-tester-guide.md`.

## Real-phone QA checklist (do before upload)

- [ ] Fresh launch → no content under the status bar; bottom tabs clear of the gesture bar.
- [ ] Try Demo Data → Home dashboard shows money grid, stalls, Needs Attention.
- [ ] Sell 8 bundle items → receipt total ₱150; stock decremented; Logbook shows the Benta.
- [ ] GCash sale requires a reference; cash does not.
- [ ] Double-tap Confirm Checkout → exactly one sale.
- [ ] Grocery → Recipe → Niluto: ingredient stock drops, product stock rises, Kita Report reflects it.
- [ ] Cook-upon-order sells at zero stock; low grocery shows "Estimated cost used".
- [ ] Bayarin overdue shows on Home; Mark paid works once per occurrence.
- [ ] Long forms: save buttons reachable with keyboard open.
- [ ] Large system font (Settings → Display → Font size max) → titles wrap, no overlap.
- [ ] Kill & reopen app → data persists.

## Final build command checklist

```sh
npm run typecheck
npm run lint
npm run check:pricing
npm run check:recipes
npm run check:production
npm run check:cogs
npm run check:fixedcosts
npm run check:pilot
npx expo export --platform android   # must succeed
# then, when ready to build for Play:
eas build -p android --profile production
```

## Privacy / Data Safety reminders

- The app's own code makes zero network requests; no analytics/ads/auth/payment SDKs.
- Manifest permissions after build: INTERNET (framework default, unused by features), ACCESS_NETWORK_STATE (online/offline badge), VIBRATE (haptics). Verify against the Play pre-launch report before answering Data Safety.
- Treat every **REVIEW** flag in `docs/play-store/data-safety-draft.md` as a required manual confirmation.
