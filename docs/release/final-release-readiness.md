# KitaMo Android - Final Release Readiness

Status: engineering release candidate for Google Play Internal Testing. The Android seller app is authoritative; the PWA remains frozen and unchanged.

## Release identity

- App: **KitaMo**
- Package: **`ph.kitamo.app`**
- Version: **`1.0.0`** (`versionCode` 1)
- Expo SDK 54 / React Native 0.81 / New Architecture
- Preview profile: standalone APK
- Production profile: signed Android App Bundle
- Branded launcher, adaptive, splash, Play icon, and feature graphic are present
- EAS project: `@kitamoandroidapp/kitamo-android`

## Security and privacy boundary

- SQLite is the local source of truth; Android backup is disabled.
- No Supabase runtime, endpoint, key, auth, analytics, ads, AI API, OCR/camera, Bluetooth, payment SDK, Customer Mode, or LGU Mode.
- Production export contains no `supabase`, `EXPO_PUBLIC_SUPABASE`, service-role, or anon-key strings.
- Owner Mode supports a salted local PIN, optional Android biometric confirmation, retry cooldown, background lock, and Kiosk-entry lock.
- Native prebuild removes internet, legacy external-storage, and system-overlay permissions.
- Expected merged release permissions: network/Wi-Fi state, vibration, biometric, and fingerprint fallback. Verify from the signed artifacts.
- The Owner lock protects against casual shared-device access; it does not encrypt SQLite or defend a rooted/compromised phone. Android backup is disabled to keep the local database out of device backups.

## Data integrity

- Checkout writes sale, items, COGS, stock, inventory movements, receipt, ingredient usage, and local queue data in one exclusive SQLite transaction.
- Migration `009_checkout_idempotency` adds a unique checkout token. A retry returns the original receipt and cannot decrement stock twice.
- Full local reset clears all business tables, settings, queue rows, demo flags, and Owner protection after confirmation.
- Demo data remains opt-in only.
- `offline_queue` has no cloud consumer in this release. It keeps one future-sync-intent row per local sale until the pilot data is reset, so its growth must be monitored during a long pilot.

## Profit contract

```text
Revenue
- Sold COGS
- Fixed Costs
- Spoilage
= Net Profit
```

All domain checks, the end-to-end pilot scenario, and the repeat-safe migration check pass without changing the accounting engine.

## Performance checkpoint

- Production Hermes export succeeds with dotenv disabled.
- Bundle: 3.87 MB.
- Icon fonts: one Ionicons font, 390 KB (previously nineteen font assets).
- Supabase runtime removal dropped its dependency chain.
- Large-list conversion and SQL pagination remain evidence-driven; do not change them until low-end device profiling shows a bottleneck.
- Home keeps sequential shared-handle SQLite reads because concurrent reads previously caused SDK 54 prepared-statement failures.
- `npm audit --omit=dev` reports 13 moderate advisories in Expo's bundled build/configuration toolchain (`postcss` and `uuid`). The offered fix is a breaking Expo 57 upgrade; no high or critical advisory was reported, and these packages are not part of KitaMo's shipped Hermes application logic. Reassess on the next supported Expo upgrade.

## Finished store assets

- `docs/play-store/assets/play-icon-512.png`
- `docs/play-store/assets/feature-graphic-1024x500.png`
- Release-candidate listing, release notes, privacy policy, Data Safety guide, screenshot plan, and tester guide under `docs/play-store/`

## Release-build evidence

- EAS authentication and project link complete: `@kitamoandroidapp/kitamo-android` (`d2ab769c-4916-4efa-ab1e-a2dfdc638607`).
- EAS-managed Android keystore created and retained on Expo's credential service.
- Preview APK build complete: `f3b64c64-04d0-4f71-ac54-1ceba8029403`.
- The preview environment contains no EAS plain-text or sensitive environment variables.
- Sanitized local native release compilation produced an APK and AAB with package `ph.kitamo.app`, version `1.0.0 (1)`, target API 36, `allowBackup=false`, and no Internet/camera/microphone/storage/location/Bluetooth permission.
- Local APK signature verification passed v2 signing. That local artifact uses the debug certificate and is engineering evidence only; the EAS-managed artifact is the distributable preview candidate.
- Local APK `zipalign -c -P 16 -v 4` passed. Local AAB `bundletool validate` passed and reports `PAGE_ALIGNMENT_16K`.
- Low-end API 28 / 2 GB AVD: clean-data first launch, explicit demo seed, Home, and sell-first Kiosk rendered without red-screen errors or system-bar overlap. Fresh database initialization took about 5.1 seconds; a warm launch measured about 0.7 seconds. The Kiosk displayed large product tiles, favorites, recent/category filters, and Add controls.
- Production AAB and its EAS/Play signing inspection remain pending. The desktop execution approval quota blocked the production command after the preview completed; this is an environment gate, not an app build failure.

## External gates still required

1. Supply the public support email and hosted privacy-policy URL.
2. Download/install the completed EAS preview APK on a low-end physical Android phone; complete the regression matrix below and capture real screenshots.
3. Run `eas build -p android --profile production`, then validate and upload the resulting AAB after the Play app exists.
4. Review the Play pre-launch report and resolve every Data Safety `REVIEW` item before rollout.

The release workstation now has Node 20, JDK 17, Android Studio, API 36 SDK/build tools, ADB, two test AVDs, and bundletool. A sanitized local release APK and AAB compile successfully; their final manifest, package/version, signature format, and 16 KB native-library alignment were inspected. EAS remains the authoritative source for the managed-keystore preview APK and production AAB. See `release-engineering-environment.md`.

Expo Doctor previously passed 17/17 with network access. The 2026-07-11 rerun passed all 15 local checks; the two remote schema/package-directory checks could not reach Expo from the sandbox and reported no dependency finding.

## Real-device regression matrix

- [ ] Fresh launch stays empty; Demo appears only after explicit selection.
- [ ] Favorites, recents, category/search filters, and quick quantity controls survive navigation/reopen as designed.
- [ ] Bundle checkout produces the expected amount and one stock decrement.
- [ ] Rapid repeated Confirm taps create one sale, receipt, movement set, and local queue row.
- [ ] Interrupt/background checkout; retry returns the same sale rather than a duplicate.
- [ ] Cash requires no reference; GCash/Maya/bank requires one.
- [ ] Orders, receipt, shift, reports, and local-save count survive force-close/reopen.
- [ ] Grocery -> Recipe -> Production -> Sale preserves ingredient deductions and sold COGS.
- [ ] Cook-upon-order remains sellable and flags estimated cost when appropriate.
- [ ] Transfers, spoilage, fixed costs, and reports preserve their existing calculations.
- [ ] Owner PIN locks after background/Kiosk entry; wrong-PIN cooldown and optional biometrics work.
- [ ] Clear All Local Pilot Data returns to first run with zero records and no automatic Demo data.
- [ ] Large font, small screen, keyboard, TalkBack labels, and gesture navigation remain usable.

## Verification commands

```sh
npm run typecheck
npm run lint
npm run check:pricing
npm run check:recipes
npm run check:production
npm run check:cogs
npm run check:fixedcosts
npm run check:pilot
npm run check:migrations
npx expo-doctor
EXPO_NO_DOTENV=1 npx expo export --platform android
eas build -p android --profile preview
eas build -p android --profile production
```
