# KitaMo Android

Expo React Native foundation for the local-first KitaMo Android MVP.

## Current Phase

Android Phase 3: Owner Setup.

This phase contains the first real Owner setup flow on top of the local-first SQLite foundation.

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
- Theme token foundation with light, dark, and system-ready mode support.
- Zustand stores for app, kiosk, and theme state.
- SQLite client, migration runner, and initial local schema.
- Typed repositories for businesses, branches, products, sales, inventory movements, app settings, and local data reset.
- Manual demo seed function.
- Explicit Clear Local Pilot Data service function.
- Kiosk routes remain placeholders.

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

## Local-Only Storage

All Phase 3 data is stored locally in SQLite on the device. There is no cloud sync, login, telemetry, remote AI, camera extraction, or printer integration in this phase.

## Clear Local Pilot Data

`clearLocalPilotData()` clears local KitaMo SQLite tables, including business data, sales, products, queues, receipts, alerts, and app settings. It is not wired to a production UI yet.

## Intentionally Deferred

- Supabase sync.
- Login, Clerk, or auth.
- Lis API or live AI.
- Camera, OCR, voice, or file extraction.
- Bluetooth printing.
- Customer Mode.
- LGU Mode.
- Play Store production release work.
- Kiosk selling, checkout, and receipt issuing.

## PWA Safety

The reference PWA repo lives at `/Users/rovs/Documents/KitaMo`. Do not modify it from this Android project. Adapt only simple, safe domain ideas when explicitly needed.
