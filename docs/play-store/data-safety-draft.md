# Play Console Data Safety — Draft Answer Guide (KitaMo Pilot)

> Draft prepared from a code and dependency audit of commit `4cd69dc`+. Conservative by design; items marked **REVIEW** need a final human check in the Play Console at submission time. Google's definitions of "collected" (transmitted off device) and "shared" are what matter — data that never leaves the device is generally NOT "collected" under Play's definition.

## Audit basis (what the code actually does)

- The app's own logic makes **zero network requests** (verified: no fetch/axios/XHR in `src/` or `app/`; `expo-network` is used only to read connectivity state for the Online/Offline badge).
- Dependencies: Expo runtime, expo-sqlite (local DB), expo-clipboard, expo-sharing + React Native Share (OS share sheet), expo-haptics, expo-network, expo-router, react-native UI libraries, zod, zustand. **No analytics, ads, crash-reporting, auth, or payment SDKs.**
- Android permissions in the manifest after build: `INTERNET` (framework default; unused by app features at runtime), `ACCESS_NETWORK_STATE` (online/offline badge), `VIBRATE` (haptics). `android.permissions` in `app.json` adds nothing. No camera, location, contacts, microphone, Bluetooth, or storage permissions.

## Suggested form answers

**Does your app collect or share any of the required user data types?**
→ Suggested answer: **No** — all user-entered data is stored locally and never transmitted by the app. **REVIEW**: confirm on the final build (see verification step below) and confirm Google's current guidance on locally-stored data at submission time.

If reviewers prefer declaring locally-stored data anyway, the fallback per-type answers:

| Data type | Collected? | Shared? | Notes |
| --- | --- | --- | --- |
| Personal info (name, contact number) | No (stored on device only; owner-entered business contact) | No | Never transmitted |
| Financial info (sales amounts, payment references) | No (local records; references typed manually) | No | No payment processing |
| Location | No | No | No permission, no API use |
| Photos/videos/audio | No | No | No permission, no API use |
| Contacts / calendar | No | No | No permission |
| App activity / analytics | No | No | No analytics SDK |
| Device or other IDs | No by app logic | No | **REVIEW**: see platform note |
| Messages, health, browsing | No | No | Not applicable |

**Is data encrypted in transit?** Not applicable (no transmission by the app). **REVIEW** if any answer above changes.

**Can users request data deletion?** Data lives only on the device; uninstalling deletes everything. In-app full reset exists (support-assisted during pilot).

## Platform/tooling caveats (be honest about these)

- **Expo/EAS runtime metadata — REVIEW**: standard Expo builds may include the `expo-updates`-style runtime or framework code that could contact Expo infrastructure in some configurations. This project does not use `expo-updates` (not in dependencies) and has no update URL configured, but verify the final `.aab`'s behavior and Google's pre-review report before answering "no collection" definitively.
- **Google Play itself** collects install/diagnostic data outside the app's control; the Data Safety form covers the app, not the store.
- **Share sheet**: receipt text a user shares leaves the app via the app they choose — user-initiated, not app collection.

## Final verification step before submission

1. Build the internal `.aab` with EAS.
2. Run Play Console's pre-launch report / app-bundle analysis and read the detected-permissions list — it must show only INTERNET, ACCESS_NETWORK_STATE, VIBRATE (plus any benign framework additions; investigate anything else before submitting).
3. Fill the form from this document, resolving every **REVIEW** item against what the Console detects.
