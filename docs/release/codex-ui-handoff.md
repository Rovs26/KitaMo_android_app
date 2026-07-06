# Codex UI Handoff — KitaMo Android

For Codex (or any agent) doing **UI/visual polish only** after Claude/Fable. KitaMo's money math is verified by check scripts; the danger is not UI bugs, it's silently changing business logic or seller labels. Read this before editing.

## The one rule

**Change how it looks and reads, never how it computes.** If a change would alter a number the app shows (a total, a cost, a profit, a stock count), it is out of scope — stop and leave it.

## Safe to edit (UI polish welcome)

- Screen layout & JSX in `app/owner/*.tsx` and `app/kiosk/*.tsx` (spacing, order, cards, colors, icons).
- Shared UI in `src/components/ui/KitaMoUI.tsx` and `src/components/common/*` (styles, layout — but keep `formatPeso`/`formatQuantity` output format unchanged).
- Theme tokens: `src/theme/colors.ts`, `src/theme/spacing.ts`, `src/theme/typography.ts`.
- Copy/text strings (keep the preserved labels below).
- Everything under `docs/`, screenshots, checklists.

## Do NOT edit (business logic — off limits)

- `src/db/migrations/*` — SQLite schema.
- `src/db/repositories/*` — all data access.
- `src/services/*` — especially `kioskSales.ts` (checkout), `production.ts`, `groceryPool.ts`, `recipes.ts`, `transfers.ts`, `fixedCosts.ts`, `profitReports.ts`, `stockOps.ts`, `localAnalytics.ts` (read-only aggregator — do not add writes).
- `src/domain/*` — `pricing.ts`, `recipeCosting.ts`, `productionMath.ts`, `orderCogs.ts`, `fixedCostSchedule.ts`, `profitMath.ts` (all pure math, covered by checks).
- `scripts/check-*.js` — the verification suites.
- `app.json` android block, `eas.json` (release config).

If a screen file imports from a service and you only touch the JSX/styles, that's fine — just don't change the imported values or how they're computed.

## Seller-facing labels to preserve (do not rename)

Grocery Stock · Paninda · Recipe Cost · Niluto (Production) · Bayarin · Logbook · Kita Report · Puhunan / Cost · Natirang paninda · Nasayang · Estimated cost · Start Selling · Local Helper · Made to order · Pending saves. Bottom tabs: Home · Helper · Logbook · Inventory · Insights. Keep "Tubo = Benta − Puhunan − Bayarin − Nasayang" exact on the Kita Report.

Avoid in seller-facing UI: schema, migration, queue, engine, lifecycle, debug, dev, "phase", and raw "COGS" outside the Kita Report's Advanced details.

## Screens that could use final visual polish

- **Home** (`app/owner/index.tsx`) — long screen; consider tightening card spacing or making Quick Add / Quick Tools more compact. Above-the-fold priority: business pill → Start Selling → Today's Money.
- **Kita Report** (`app/owner/reports.tsx`) — the Advanced details block could be a collapsible section.
- **Logbook** (`app/owner/records.tsx`) — date-group headers and event rows; keep it scannable.
- **Kiosk Sell/Checkout** (`app/kiosk/sell.tsx`, `checkout.tsx`) — cart density on small screens.
- **Fixed Costs / Bayarin** (`app/owner/fixed-costs.tsx`) — long form + list on one screen.

## Known UI risks

- **Nested scrolling**: screens use `ScreenScroll` (a ScrollView). Do NOT put a `FlatList` inside it — it triggers the VirtualizedList-nesting warning and breaks scroll. Pilot lists are small; plain `.map` is intentional.
- **Safe area**: top/bottom insets come from `ScreenScroll` + `react-native-safe-area-context`. Don't hardcode status-bar or nav-bar padding.
- **Large fonts**: titles cap at `maxFontSizeMultiplier={1.3}`; keep that when editing headings.
- **Keyboard**: `android.softwareKeyboardLayoutMode: "resize"` keeps save buttons visible; don't change it.

## Commands Codex must run before committing

```sh
npm run typecheck
npm run lint
npm run check:pricing
npm run check:recipes
npm run check:production
npm run check:cogs
npm run check:fixedcosts
npm run check:pilot
npx expo export --platform android
```

All must pass. The `check:*` scripts passing is proof the math was not touched — if any fails after a "UI-only" change, that change reached business logic and must be reverted.

## Final screenshot checklist

Capture per `docs/play-store/screenshot-plan.md` (11 shots: Home, Kiosk Sell, Receipt, Grocery Stock, Recipe Cost, Niluto, Logbook, Insights, Bayarin, Kita Report, Pilot Guide). Light mode, demo-plus data, clean status bar.
