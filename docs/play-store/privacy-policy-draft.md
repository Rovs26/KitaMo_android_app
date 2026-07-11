# Privacy Policy (DRAFT) — KitaMo

> **Status: release candidate. Not legal advice.** Review with a qualified person and host at a public URL before Play Console submission. Last updated: 2026-07-10.

## The short version

KitaMo stores everything you enter **on your own phone only**. The app has no account system, no cloud, no ads, no analytics, and it does not send your data anywhere.

## What data the app handles

You may enter, and the app stores locally on your device:

- Business details: business name, owner/contact name, contact number (optional), address/location text, stalls.
- Selling records: sales, receipts, payment method, and manually typed payment reference numbers (e.g. a GCash reference).
- Inventory data: products, prices, costs, stock, grocery purchases (brand/source/price), recipes, production, transfers, spoilage.
- Money records: fixed costs (rent, wages, bills) and payment history you mark yourself.
- Local preferences: favorites, recent Kiosk products, theme, and active business/stall.
- Owner access protection: a salted hash of the local Owner PIN and whether biometric unlock is enabled. The PIN itself is not stored.

## Where the data lives

- All data is stored in a local database file on your device. Nothing is uploaded to KitaMo or anyone else by the app.
- Android cloud/device backup is disabled for KitaMo. There is **no backup or sync**. If the app is uninstalled or the device is lost or reset, the data is gone.

## What the app does NOT do

- No account, login, or registration.
- No transmission of your data to any server operated by KitaMo (the app's own logic makes no network requests).
- No selling of data. No sharing with third parties by the app.
- No ads and no third-party analytics or tracking SDKs.
- No access to your camera, microphone, location, contacts, photos, or Bluetooth.
- No payment processing — payment references are text you type; the app never connects to GCash, Maya, or banks.

## Device features the app uses

- **Local storage** for the database.
- **Clipboard and the Android share sheet**, only when you tap Copy/Share on a receipt — you choose where the receipt text goes; anything you share leaves the app through the app you pick.
- **Network status indicator**: the app checks whether the device is online only to show an Online/Offline badge. It does not send data.
- **Optional device unlock**: if you turn it on, KitaMo asks Android to confirm an enrolled fingerprint or face before opening Owner Mode. KitaMo receives only success/cancel; it cannot read or store biometric data.
- **Haptic feedback** for selected Kiosk actions.
- The release manifest is reviewed before upload. KitaMo does not request camera, microphone, location, contacts, photos, or Bluetooth permissions.

During development-only testing through Expo Go, the app loads over the local Wi-Fi network from the developer's machine. This is not part of the installed production/internal-testing app behavior.

## Deleting your data

Uninstalling the app deletes all app data. In Owner Settings, **Clear All Local Pilot Data** removes business data, sales, inventory, receipts, settings, the local save queue, and Owner access protection after a confirmation prompt. Demo data does not return unless you choose Demo mode again.

## Children

KitaMo is a business tool intended for adults (18+). It is not directed at children.

## Changes

If a future version adds accounts, backup/sync, or any data transmission, this policy will be updated first and the change will be clearly announced in release notes.

## Contact

`support@REPLACE-ME.example` (placeholder — set before submission)
