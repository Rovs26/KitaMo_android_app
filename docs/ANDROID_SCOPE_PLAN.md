# KitaMo Android Scope Plan

## 1. Android App Objective

Build a pilot-safe native Android version of KitaMo using the validated PWA pilot flows as the blueprint.

The first Android build should prove that a Filipino microbusiness seller can use a local-first phone app to set up a business, add products, sell quickly in Kiosk Mode, issue shareable receipts, capture GCash/Maya/bank reference numbers, and keep operating offline without data loss.

This is not the Play Store release build yet. It is a controlled Android pilot foundation.

## 2. What To Copy From The PWA

Copy the validated product behavior, not the web implementation.

- Owner Mode vs Kiosk Mode mental model.
- Pilot-safe local-first behavior.
- Business Profile setup.
- Stores/Stalls setup.
- Product setup with price, cost, stock, low-stock threshold, and bundle pricing.
- Kiosk Sell flow.
- Cash and GCash/Maya/bank transfer checkout.
- Reference number capture for digital payments.
- Structured text receipts.
- Share/copy receipt flow.
- Orders/history view.
- Inventory stock updates after sales.
- Stock/Cook flow for karinderia-style batch logging.
- Low-stock owner alerts.
- Records and basic Insights.
- Demo/local mode distinction.
- Clear Local Pilot Data behavior.
- Pilot App Status concept: local data, offline state, pending queue, future sync readiness.
- Lis/Ask as a bounded assistant/draft surface, not an autonomous agent.

## 3. What Not To Copy

Do not copy web-specific or future-facing complexity into the first Android build.

- Next.js App Router structure.
- Browser localStorage as the persistence layer.
- PWA service worker/offline shell.
- Clerk-first auth assumptions.
- Supabase-first data writes.
- Server routes as required runtime dependencies.
- Web-only layout patterns that do not fit touch-first Android screens.
- Customer Mode.
- LGU Mode.
- Bluetooth printing.
- Public menu/ordering.
- Full employee backend.
- Server-side staff permissions.
- True multi-agent Lis.
- AI receipt/photo extraction as a core dependency.
- Any Play Store release work.

## 4. MVP Android Scope

The MVP should be a local-first Android pilot app with these flows:

- First launch: choose Demo Data or Start Local Business.
- Owner Home: today sales, pending items, low stock, kiosk alerts, quick actions.
- Business Profile: business name, owner name, barangay/address, contact, business type, preferred language.
- Stalls: add/edit one or more stalls, choose active stall for kiosk.
- Products: create/edit products, stock quantity, unit, price, cost, low-stock threshold, bundle quantity/price/label.
- Owner Inventory: list products, low stock, manual stock adjustment.
- Kiosk entry: owner-controlled switch into Kiosk Mode with stall selection.
- Kiosk Sell: product grid/list, cart, quantity controls, discounts if already validated, checkout.
- Checkout: cash, GCash, Maya, bank transfer, other; require or strongly prompt reference for non-cash.
- Receipt: structured text receipt, copy, Android share sheet.
- Orders: recent sales, receipt re-open, payment/reference details.
- Kiosk Stock: stock view, notify owner, Cook/Niluto batch logging for recipe-backed items.
- Shift: basic current shift summary only.
- Owner Records: sales, inventory movements, batch logs, alerts.
- Owner Insights: simple totals for today/week, gross sales, estimated gross profit, low-stock summary.
- Offline indicator: device/local-first status and pending queue count.
- Clear Local Pilot Data: strong confirmation, wipe KitaMo local SQLite data, reset to fresh state.

## 5. Deferred Scope

Defer these until the Android pilot proves the core flows:

- Supabase sync and account login.
- Cross-device sync.
- Full role-based staff accounts.
- Employee approval/revoke flow.
- Customer Mode.
- LGU/Partner dashboards.
- Bluetooth thermal printing.
- Native camera receipt scanning.
- AI transcription and voice.
- AI file upload.
- Live Lis AI API integration.
- True multi-agent Lis architecture.
- Cloud backups.
- Play Store production release.
- Subscriptions/payments.
- Formal analytics/telemetry beyond local debug logs.

## 6. Recommended Tech Stack

- Expo React Native for fast Android development and device testing.
- TypeScript for shared domain safety.
- Expo Router for file-based navigation.
- expo-sqlite for local-first persistence.
- Zustand for lightweight app/session state.
- React Hook Form plus Zod for forms and validation.
- Expo SecureStore only for future tokens/secrets, not core business data.
- Expo Sharing and Clipboard for receipt sharing/copying.
- Expo Network for online/offline awareness.
- Expo Haptics for lightweight sale confirmation feedback.
- Native camera later through Expo Camera.
- Supabase later through explicit sync services.
- Lis AI API later behind a feature flag and usage guard.

## 7. Folder Structure

Recommended initial structure:

```text
app/
  _layout.tsx
  index.tsx
  owner/
    _layout.tsx
    index.tsx
    ask.tsx
    records.tsx
    inventory.tsx
    insights.tsx
    settings.tsx
  kiosk/
    _layout.tsx
    index.tsx
    sell.tsx
    checkout.tsx
    receipt/[saleId].tsx
    orders.tsx
    stock.tsx
    shift.tsx
src/
  components/
    common/
    owner/
    kiosk/
    forms/
  db/
    client.ts
    migrations/
    schema.ts
    repositories/
  domain/
    types.ts
    pricing.ts
    receipts.ts
    inventory.ts
    insights.ts
    ids.ts
  features/
    owner/
    kiosk/
    products/
    sales/
    inventory/
    recipes/
    ask/
    settings/
  state/
    appStore.ts
    kioskStore.ts
  theme/
    colors.ts
    spacing.ts
    typography.ts
  services/
    offlineQueue.ts
    syncStub.ts
    shareReceipt.ts
    pilotData.ts
  fixtures/
    demoData.ts
```

Keep screen files thin. Put business behavior in `src/domain`, database access in `src/db/repositories`, and feature orchestration in `src/features`.

## 8. Data Model Approach

Start with normalized SQLite tables, plus a small metadata table for app settings.

Core tables:

- `businesses`
- `branches`
- `products`
- `sales`
- `sale_items`
- `inventory_movements`
- `recipes`
- `recipe_ingredients`
- `recipe_batches`
- `finished_food_inventory`
- `owner_alerts`
- `shifts`
- `receipt_records`
- `offline_queue`
- `app_settings`

Use stable IDs generated locally. Every business record should include:

- `id`
- `business_id` where applicable
- `branch_id` where applicable
- `created_at`
- `updated_at`
- `sync_status`: `local`, `pending`, `synced`, `failed`
- `deleted_at` for future soft-delete sync compatibility

Keep PWA type names where they are already seller-domain concepts: `Product`, `Sale`, `SaleItem`, `InventoryMovement`, `Recipe`, `RecipeBatch`, `Branch`, `PaymentMethod`.

Do not mirror the full PWA `LedgerState` as one JSON blob. SQLite should support durable queries, records, insights, and future sync.

## 9. Offline-First Approach

Offline-first is the default, not an error state.

- All MVP actions write to SQLite first.
- Sale confirmation is complete once the local transaction succeeds.
- Stock decrement and receipt creation happen in the same local transaction as the sale.
- A local `offline_queue` row records future sync intent, even before Supabase exists.
- Pending count comes from unsynced rows/queue rows.
- The app must survive force close/reopen with no data loss.
- The checkout button must guard against duplicate submissions.
- Failed future sync must never undo a completed local sale.
- Clear Local Pilot Data wipes local business tables, queue rows, settings, alerts, and demo/local data.

Critical invariant: a seller must be able to complete a sale offline and reopen the app with the sale, stock movement, receipt, and pending status still intact.

## 10. Theme Approach

Use a native theme derived from KitaMo PWA identity, but redesigned for Android ergonomics.

- Keep the warm Filipino microbusiness tone.
- Prioritize large tap targets, readable numbers, and fast selling.
- Support light mode first; dark mode can follow once the design tokens are stable.
- Use semantic tokens: background, surface, border, text, mutedText, primary, danger, warning, success.
- Avoid one-note color palettes.
- Use status colors sparingly for payments, stock, sync, and alerts.
- Keep cards compact and functional; no marketing-style landing page.
- Make Kiosk Mode visually distinct from Owner Mode with header treatment and mode label.

## 11. Owner Mode Scope

Owner Mode is the private cockpit.

MVP Owner screens:

- Home: today sales, weekly sales, low stock, pending queue, kiosk alerts, quick actions.
- Ask: local helper/draft surface only.
- Records: sales, receipts, inventory movements, batch logs.
- Inventory: products, stock, low stock, manual adjustments.
- Insights: simple totals and summaries.
- Settings: Business Profile, Stalls, Pilot App Status, Privacy/Data, Switch Mode.

Owner Mode must make it clear that data is local on this phone during the pilot.

## 12. Kiosk Mode Scope

Kiosk Mode is the selling counter.

MVP Kiosk screens:

- Entry: choose owner-controlled kiosk session and active stall.
- Sell: fast product selection and cart.
- Checkout: payment method, reference number, confirm.
- Receipt: share/copy structured text.
- Orders: recent sales and receipt reopen.
- Stock: product stock, low-stock notify owner, Cook/Niluto.
- Shift: current shift totals, start/end placeholder if needed.

Employee Kiosk remains a pilot preview only. Do not build production staff security in MVP.

## 13. Lis/Ask Scope

Lis/Ask should be scoped as a safe local assistant surface for the first Android build.

MVP behavior:

- Provide canned/local guidance for common business questions.
- Summarize local data using SQLite queries.
- Create draft suggestions only where deterministic and reviewable.
- Require explicit Save for any draft.
- Never auto-write business records from AI/chat.
- Show that live AI is not enabled in the first build.

Deferred:

- Lis AI API.
- Voice input.
- Photo/file extraction.
- Memory across devices.
- Multi-agent routing.
- Autonomous corrections.

## 14. Receipt, GCash, And Reference Flow

Receipt flow is a core MVP path.

Checkout requirements:

- Cash can complete without reference.
- GCash, Maya, bank transfer, and other digital methods should capture `external_reference_number`.
- If reference is missing, show a clear prompt and allow a deliberate skip only if the pilot team wants that behavior.
- Receipt must include business name, stall, transaction number, date/time, items, quantities, discounts, total, payment method, and reference number when present.
- Receipt is stored as structured sale data plus generated text.
- Android share sheet sends receipt text.
- Copy receipt puts text on clipboard.
- Orders can reopen any recent receipt.

Avoid receipt images and printing in MVP.

## 15. Play Store Readiness Path

Do not start Play Store release yet. Prepare in layers:

1. Local Android pilot build through Expo development build or internal APK/AAB testing.
2. Device QA on small Android screens, offline, force-close/reopen, weak network, and long selling sessions.
3. Internal test track only after MVP gates pass.
4. Add privacy policy, data safety answers, app icon, adaptive icon, splash, screenshots, and store copy.
5. Add crash reporting only after privacy language is ready.
6. Add Supabase sync/account model only after local-first invariants are stable.
7. Production Play Store release only after pilot metrics support wider beta.

## 16. Development Phases

Phase 0: Scope approval

- Approve this plan.
- Confirm MVP/non-MVP boundaries.
- Confirm whether the first build uses demo data, empty local setup, or both.

Phase 1: Project foundation

- Create Expo TypeScript app.
- Add Expo Router.
- Add SQLite, Zustand, forms, validation, and theme tokens.
- Add empty navigation for Owner and Kiosk.

Phase 2: Local data foundation

- Build SQLite schema and migrations.
- Add repositories.
- Seed demo data.
- Add Clear Local Pilot Data.
- Add local IDs and timestamps.

Phase 3: Owner setup

- Business Profile.
- Stalls.
- Product setup.
- Inventory list.
- Pilot App Status.

Phase 4: Kiosk selling

- Kiosk session.
- Sell/cart.
- Checkout.
- Duplicate-submit protection.
- Sale transaction.
- Stock decrement.
- Receipt generation.
- Share/copy.

Phase 5: Offline proof

- Offline indicator.
- Pending queue stub.
- Force-close/reopen survival.
- Offline sale test.
- Local data integrity tests.

Phase 6: Stock, Cook, and alerts

- Kiosk Stock.
- Low-stock notify owner.
- Owner alerts.
- Recipe/batch logging.
- Finished food update.

Phase 7: Records and insights

- Sales records.
- Receipt reopen.
- Inventory movements.
- Basic totals.
- Low-stock summaries.

Phase 8: Ask/Lis local helper

- Local-only Ask UI.
- Deterministic summaries.
- Reviewable drafts only.
- Live AI disabled flag.

Phase 9: Android pilot QA

- Real-device dry run.
- Timed sale test.
- GCash reference test.
- Offline sale survival.
- Clear Local Pilot Data.
- Issue log and fix pass.

## 17. Risks

- Data-loss risk if sale, stock movement, receipt, and queue writes are not atomic.
- Duplicate-sale risk if checkout does not lock while saving.
- Scope creep from copying all PWA features instead of the validated pilot subset.
- SQLite migration mistakes before schema stabilizes.
- Slow Kiosk UX if product selection is too form-heavy.
- Confusion if Owner Mode and Kiosk Mode look too similar.
- Trust risk if "local data only" is not clear.
- Future sync conflict risk if local IDs and timestamps are not designed early.
- AI trust risk if Lis appears more capable than it is.
- Play Store readiness risk if release work starts before pilot behavior is stable.

## 18. First Coding Task After Approval

Scaffold the Expo React Native TypeScript app in this folder with Expo Router, no business logic yet.

Acceptance criteria:

- App launches on Android through Expo.
- Owner and Kiosk route groups exist as placeholder screens.
- TypeScript is configured.
- Lint/format scripts exist.
- No PWA repo files are modified.
- No Supabase, Lis API, camera, Bluetooth printing, Customer Mode, LGU Mode, or Play Store release work is started.
