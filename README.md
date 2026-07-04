# KitaMo Android

Expo SDK 54 React Native foundation for the local-first KitaMo Android MVP.

## Current Phase

Android Phase 7: Stock, Cook, and Alerts.

This phase adds the next operational layer for food sellers and stock-aware sellers: local-only owner alerts, a Notify Owner action in Kiosk Stock, a basic Cook/Niluto batch flow, Spoilage/Nasayang logging, and owner alert visibility in Home and Insights. Everything remains local-first SQLite; no push notifications, cloud sync, auth, AI, camera, Bluetooth, Customer/LGU mode, or release work was added.

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

- Expo SDK 54 React Native with TypeScript.
- Expo Router route structure for Owner and Kiosk areas.
- First-run choice for Fresh Business or explicit Demo Data.
- Owner Home setup guidance and pilot status.
- Owner Settings business profile form backed by SQLite.
- Owner Settings stores/stalls form backed by SQLite branches.
- Owner Inventory product setup and product list backed by SQLite products.
- Kiosk entry gate for active business, active stall, and product readiness.
- Kiosk Sell product list, stock-aware cart, and quantity controls.
- Bundle pricing parity for Kiosk cart, checkout, sale item totals, and receipts.
- Kiosk Checkout for cash, GCash, Maya, bank transfer, other payment methods, reference capture, and optional discount.
- Local sale transaction with sale items, stock decrement, inventory movement, receipt record, and pending offline queue entry.
- Receipt display with clipboard copy and native share sheet when available.
- Kiosk Orders, Stock, and current local Shift summary screens.
- Local-only Ask KitaMo suggested questions and deterministic answers.
- Owner Records tab for local sales, receipts, filters, and recent stock movements.
- Owner Insights tab for today's sales, payment breakdown, product counts, low-stock count, active alert count, and top products.
- Local-only owner alerts with severity, active/resolved status, and resolve action in Owner Home.
- Kiosk Stock low/out-of-stock badges with a Notify Owner action that creates a local alert.
- Cook/Niluto batch flow in Owner Inventory that records a recipe batch, increases finished product stock, and logs a cooked inventory movement in one transaction.
- Spoilage/Nasayang flow in Owner Inventory that decreases stock and logs a spoilage inventory movement with negative-stock protection.
- Online / Offline local-mode indicator using Expo Network.
- Pending offline queue visibility in Owner and Kiosk flows.
- Development-only local data verification panel hidden behind a disabled local dev flag.
- Shared KitaMo UI primitives for screen shells, cards, metric cards, pills, buttons, empty states, list rows, and icon-based bottom navigation.
- Theme token foundation with light, dark, and system-ready mode support.
- Zustand stores for app, kiosk, and theme state.
- SQLite client, migration runner, and initial local schema.
- Typed repositories for businesses, branches, products, sales, inventory movements, app settings, and local data reset.
- Manual demo seed function.
- Explicit Clear Local Pilot Data service function.

## SQLite Foundation

The local database is `kitamo_local.db`, opened through `src/db/client.ts`.

Migrations live in `src/db/migrations/` and are tracked in the `schema_migrations` table. `runMigrations()` is safe to call repeatedly. Migration `001_initial_schema` creates the local tables, migration `002_owner_setup_fields` adds owner setup notes fields to businesses and branches, and migration `003_owner_alert_fields` adds `severity` and `product_id` to `owner_alerts`.

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

Phase 5.8 presents this as a more compact seller dashboard with a smaller KitaMo top bar, active business context, Today's Kita hero card, controlled metric sizing, setup status, quick actions, and a polished empty state when no local sales exist.

Owner Settings supports creating and editing the local business profile, adding/editing stalls or stores, and selecting the active stall through `app_settings.activeBranchId`.

Owner Settings separates Business Profile, Store / Stall, Pilot App Status, and Data & Privacy. SQLite/native errors are logged in development and shown to users as short friendly messages.

Phase 5.7 adds a Business Profile-style summary card while preserving the same local create/edit flows.

Owner Inventory supports creating/editing local products and listing stock quantities with low-stock badges. It does not edit inventory movements yet.

Owner Inventory uses a cleaner product setup/list baseline with compact fields, product cards, stock, unit, price, and low-stock badges.

Phase 5.8 keeps Inventory summary cards for Products, Low Stock, and Stock Value, then prioritizes the product list before the Add Product form. The form expands when adding/editing products so saved products stay easier to scan. Recipe/batch cooking remains deferred.

## Ask, Records, And Insights

Ask KitaMo is local-only in Phase 6. It does not call Lis, OpenAI, Anthropic, or any remote API. Suggested questions answer from SQLite-backed local summaries:

- today's sales total
- today's transaction count
- pending saves
- product and low-stock counts
- top product from local `sale_items`

Records shows local SQLite records only. It includes summary cards, Today/All/Cash/GCash-Maya-Bank filters, local sale cards, receipt text expansion, and recent inventory movement rows where available. It does not export, edit, delete, or sync records.

Insights shows simple local summaries only: today's sales, transactions, average sale, payment breakdown, product count, low-stock count, top products, and pending saves. It does not use fake sales data in fresh or demo mode; insights appear after real local sales exist on the device.

## Stock Alerts, Cook, And Spoilage

Phase 7 adds local-only operational flows on top of the existing tables. All alerts, batches, and spoilage records stay in SQLite on the device. There are no push notifications, background jobs, or cloud sync.

Owner alerts live in `owner_alerts` with severity (`info` / `warning` / `critical`) and status (`active` / `resolved`). The `src/db/repositories/ownerAlerts.ts` repository supports creating alerts, listing active and recent alerts, counting active alerts, and marking an alert resolved.

Notify Owner lives in Kiosk Stock. Low-stock and out-of-stock products show a Notify Owner action that creates a local owner alert (for example, "Low stock: Sushi Roll"). Duplicate protection works two ways: a synchronous tap lock prevents rapid double taps, and an existing active alert for the same product is reused instead of duplicated — the row then shows "Owner notified".

Owner Home shows active alerts with title, message, severity badge, created time, and a Resolve button, plus a compact active-count pill. Insights shows an active alert count metric.

Cook/Niluto lives in Owner Inventory. The seller picks a finished product, enters how many pieces were produced, and saves. One SQLite transaction inserts a `recipe_batches` row, increases the product stock, and inserts a `cooked` inventory movement. Ingredient deduction is intentionally deferred — cooking only increases finished goods stock and does not consume ingredient products yet.

Spoilage/Nasayang also lives in Owner Inventory. The seller picks a product, enters how many pieces were wasted, and optionally adds a reason. One SQLite transaction decreases the product stock and inserts a `spoilage` inventory movement. Spoilage can never push stock below zero; the save is blocked with a friendly message instead.

Cook and spoilage movements appear in Owner Records under recent stock movements with Niluto and Nasayang badges. Fresh mode starts with no alerts, batches, or spoilage records; demo products can be used with these flows, but demo mode never auto-creates alerts, batches, or spoilage rows.

## Kiosk Selling

Kiosk Mode requires:

- an active business profile
- an active stall/store
- at least one local product

If products are missing, Kiosk shows: “Add products in Owner Inventory first.”

The Sell screen reads active-stall products from SQLite, shows stock and low-stock/out-of-stock status, and stores the cart in Zustand for simple navigation between Sell and Checkout.

Phase 5.8 tightens Kiosk entry, Sell, and cart surfaces with smaller headers, compact product rows, clearer totals, and easier checkout scanning. Sale transaction behavior is unchanged.

## Bundle Pricing

Android Kiosk checkout matches the validated PWA bundle pricing rule. If a product has a valid bundle quantity and bundle price, checkout applies as many full bundles as possible, then prices the remaining units at the normal unit price.

Example: unit price `PHP 20`, bundle `8 for PHP 150`:

- quantity `7` = `PHP 140`
- quantity `8` = `PHP 150`
- quantity `9` = `PHP 170`
- quantity `16` = `PHP 300`
- quantity `17` = `PHP 320`

Bundle pricing never increases the line total above normal `unit price x quantity`. If a bundle is missing, invalid, or not cheaper than normal pricing, the line uses normal unit pricing.

Kiosk Sell displays available bundle offers on product rows and shows “Bundle applied” in the cart only when the bundle affects the line total. Checkout, receipt text, `sale_items.line_total`, and `sale_items.bundle_applied` use the same pure pricing helper in `src/domain/pricing.ts`.

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

Phase 5.8 keeps the checkout/receipt layout compact with clean payment options, a controlled total card, receipt summary, and copy/share actions. It does not change duplicate checkout protection or receipt generation.

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

For SDK 54, owner status and local count reads are performed sequentially on the SQLite handle to avoid native prepared-statement lifecycle errors during settings load.

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

The Phase 5.8 polish is UI-only. It does not change business logic, the SQLite schema, cloud services, AI, camera/OCR, Bluetooth printing, Customer/LGU modes, or release work.

## Clear Local Pilot Data

`clearLocalPilotData()` clears local KitaMo SQLite tables, including businesses, branches, products, sales, sale items, inventory movements, recipe batches, owner alerts, receipt records, offline queue rows, and app settings.

Because `app_settings` is cleared, the first-run choice appears again when the app starts from the root. Demo data is not recreated unless Try Demo Data is selected again. The local verification panel remains in code for development, but it is hidden by default with `showLocalDataVerificationPanel = false`.

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
- Real Lis AI or multi-agent Ask.
- Records export/download.
- Advanced analytics or chart libraries.
- Full staff permissions and shift open/close workflow.
- Recipe ingredient deduction and batch costing for Cook/Niluto.
- Push notifications for owner alerts.

## PWA Safety

The reference PWA repo lives at `/Users/rovs/Documents/KitaMo`. Do not modify it from this Android project. Adapt only simple, safe domain ideas when explicitly needed.
