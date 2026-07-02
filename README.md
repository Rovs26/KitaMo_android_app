# KitaMo Android

Expo React Native foundation for the local-first KitaMo Android MVP.

## Current Phase

Android Phase 2: Local Data Foundation.

This phase contains placeholder navigation, theme tokens, lightweight state stores, and a local-first SQLite foundation.

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
- Placeholder screens only.
- Theme token foundation with light, dark, and system-ready mode support.
- Zustand stores for app, kiosk, and theme state.
- SQLite client, migration runner, and initial local schema.
- Typed repositories for businesses, branches, products, sales, inventory movements, app settings, and local data reset.
- Manual demo seed function.
- Explicit Clear Local Pilot Data service function.
- Development-only local data verification panel on the welcome screen.

## SQLite Foundation

The local database is `kitamo_local.db`, opened through `src/db/client.ts`.

Migrations live in `src/db/migrations/` and are tracked in the `schema_migrations` table. `runMigrations()` is safe to call repeatedly; migration `001_initial_schema` uses `CREATE TABLE IF NOT EXISTS` and records itself once.

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

Fresh mode is empty by default. The app does not auto-seed demo products, records, inventory, or pseudo business data.

Future first-run UI should offer:

- Start Fresh Business
- Try Demo Data

For now, the development panel exposes manual verification actions only.

## Demo Data

`seedDemoData()` in `src/services/pilotData.ts` creates one demo business, one demo stall, and a small product list only when explicitly called. It is not called automatically at startup.

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

## PWA Safety

The reference PWA repo lives at `/Users/rovs/Documents/KitaMo`. Do not modify it from this Android project. Adapt only simple, safe domain ideas when explicitly needed.
