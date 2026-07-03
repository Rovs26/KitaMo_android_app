# KitaMo Android

Expo React Native foundation for the local-first KitaMo Android MVP.

## Current Phase

Android Phase 5: Offline Proof and Data Integrity.

This phase hardens the local Kiosk selling flow with visible offline status, pending queue visibility, persistence checks, duplicate-checkout protection, sale integrity verification, and local reset verification.

## Run

```sh
npm install
npm run typecheck
npm run lint
npm run start
```

For Android:

```sh
npm run android
```

## Included

- Expo React Native with TypeScript.
- Expo Router route structure for Owner and Kiosk areas.
- First-run choice for Fresh Business or explicit Demo Data.
- Owner Home setup guidance and pilot status.
- Owner Settings business profile form backed by SQLite.
- Owner Settings stores/stalls form backed by SQLite branches.
- Owner Inventory product setup and product list backed by SQLite products.
- Kiosk entry gate for active business, active stall, and product readiness.
- Kiosk Sell product list, stock-aware cart, and quantity controls.
- Kiosk Checkout for cash, GCash, Maya, bank transfer, other payment methods, reference capture, and optional discount.
- Local sale transaction with sale items, stock decrement, inventory movement, receipt record, and pending offline queue entry.
- Receipt display with clipboard copy and native share sheet when available.
- Kiosk Orders, Stock, and current local Shift summary screens.
- Online / Offline local-mode indicator using Expo Network.
- Pending offline queue visibility in Owner and Kiosk flows.
- Development-only local data verification panel with sale integrity checks.
- Theme token foundation with light, dark, and system-ready mode support.
- Zustand stores for app, kiosk, and theme state.
- SQLite client, migration runner, and initial local schema.
- Typed repositories for businesses, branches, products, sales, inventory movements, app settings, and local data reset.
- Manual demo seed function.
- Explicit Clear Local Pilot Data service function.

## SQLite Foundation

The local database is `kitamo_local.db`, opened through `src/db/client.ts`.

Migrations live in `src/db/migrations/` and are tracked in the `schema_migrations` table. `runMigrations()` is safe to call repeatedly. Migration `001_initial_schema` creates the local tables, and migration `002_owner_setup_fields` adds owner setup notes fields to businesses and branches.

The initial schema creates:

- `businesses`
- `branches`
- `products`
- `sales`
- `sale_items`
- `inventory_movements`
- `recipe_batches`
- `owner_alerts`
- `receipt_records`
- `offline_queue`
- `app_settings`

## Fresh Mode

Fresh mode is empty by default. The app does not auto-seed demo products, records, inventory, alerts, or pseudo business data.

The first-run screen offers:

- Start Fresh Business
- Try Demo Data

Choosing Start Fresh Business only marks first-run setup as complete and routes to Owner setup. It does not create a business, stall, product, sale, inventory movement, alert, or insight.

## Demo Data

`seedDemoData()` in `src/services/pilotData.ts` creates one demo business, one demo stall, and a small product list only when explicitly called. It is not called automatically at startup.

The first-run Try Demo Data action calls that seed function and then routes to Owner setup.

## Owner Setup

Owner Home reads the local database and shows:

- business profile status
- stall/store status
- product count
- active stall
- local database status
- pending offline queue count
- fresh/demo mode

Owner Settings supports creating and editing the local business profile, adding/editing stalls or stores, and selecting the active stall through `app_settings.activeBranchId`.

Owner Inventory supports creating/editing local products and listing stock quantities with low-stock badges. It does not edit inventory movements yet.

## Kiosk Selling

Kiosk Mode requires:

- an active business profile
- an active stall/store
- at least one local product

If products are missing, Kiosk shows: “Add products in Owner Inventory first.”

The Sell screen reads active-stall products from SQLite, shows stock and low-stock/out-of-stock status, and stores the cart in Zustand for simple navigation between Sell and Checkout.

## Checkout And Payments

Checkout supports:

- cash
- GCash
- Maya
- bank transfer
- other

Cash can complete without a reference number. Non-cash payments require a reference number before checkout completes. Duplicate checkout is guarded by both a synchronous save lock and a saving state so rapid repeated taps cannot create duplicate sales. Failed saves release the lock and re-enable checkout safely.

When checkout succeeds, one local SQLite transaction:

- inserts the sale
- inserts sale items
- decrements product stock
- inserts stock-out inventory movements
- inserts the receipt record
- inserts a pending `offline_queue` row for future sync

If any part fails, the transaction rolls back.

## Offline Proof

The app uses Expo Network to show:

- `Online`
- `Offline / Local mode`
- pending queue count

The indicator appears in the Owner Pilot Status card and Kiosk entry/sell screens. This is status-only; it does not start cloud sync.

## Pending Queue

Each completed local sale inserts one pending `offline_queue` row with `entity_type = sale` and `operation = create`.

Pending queue count is read from SQLite and shown in:

- Owner Home / Pilot Status
- Kiosk entry
- Kiosk Sell
- Kiosk Shift

Supabase/cloud sync is still deferred. Queue rows remain local proof of future sync intent.

## Persistence Expectation

Screens reload durable data from SQLite on mount/focus:

- products and stock
- active business/stall settings
- orders and receipt records
- shift totals
- pending queue count

Cart contents remain lightweight Zustand state and are not expected to survive a force close yet. Completed sales, stock decrements, receipts, and queue rows are durable.

## Sale Integrity Check

`verifySaleIntegrity()` in `src/services/kioskSales.ts` checks the latest or selected local sale for:

- sale items
- receipt record
- stock-out inventory movements
- offline queue row
- movement quantity matching sale item quantity
- nonnegative product stock

This is for local development verification only. It does not send telemetry.

## Receipts

Receipts are generated from structured local sale data and include business, stall, transaction number, sale ID, date/time, items, subtotal, discount, total, payment method, reference number when present, and a local/offline note.

Receipt text can be copied to the clipboard. The app uses the native share sheet when available; Bluetooth printing is still deferred.

## Local-Only Storage

All Phase 5 data is stored locally in SQLite on the device. There is no cloud sync, login, telemetry, remote AI, camera extraction, Bluetooth printing, or production staff security in this phase.

## Clear Local Pilot Data

`clearLocalPilotData()` clears local KitaMo SQLite tables, including businesses, branches, products, sales, sale items, inventory movements, recipe batches, owner alerts, receipt records, offline queue rows, and app settings.

Because `app_settings` is cleared, the first-run choice appears again when the app starts from the root. Demo data is not recreated unless Try Demo Data is selected again. In development builds, the Owner Settings dev panel can refresh counts, run the latest sale integrity check, and explicitly clear local pilot data.

## Intentionally Deferred

- Supabase sync.
- Login, Clerk, or auth.
- Lis API or live AI.
- Camera, OCR, voice, or file extraction.
- Bluetooth printing.
- Customer Mode.
- LGU Mode.
- Play Store production release work.
- Supabase sync processing for `offline_queue`.
- Full staff permissions and shift open/close workflow.
- Cook/Niluto recipe or batch production.

## PWA Safety

The reference PWA repo lives at `/Users/rovs/Documents/KitaMo`. Do not modify it from this Android project. Adapt only simple, safe domain ideas when explicitly needed.
