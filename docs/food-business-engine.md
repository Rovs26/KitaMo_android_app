# KitaMo Food Business Engine — Architecture Plan

Status: the full engine plan is now implemented. Phase 8B shipped the Grocery Pool (sections 5–6); Phase 8C+8D the Recipe Builder with selected-lot costing (sections 7–9); Phase 9 production per stall with ingredient deduction (section 10); Phase 10+11 cook-upon-order COGS and the finished-goods lifecycle (sections 11–12); Phase 12+13 fixed costs and per-stall/consolidated profit reports (sections 13–14). Remaining deferrals are listed in section 18 and the README.

## 1. Executive summary

KitaMo currently sells finished goods: products with a price, a cost, and a stock count. Food sellers work differently. They buy groceries centrally (rice, soy sauce, cucumber), cook batches or cook per order, split finished goods across stalls, and only know their real profit when ingredient costs are traced through to what was actually sold.

The Food Business Engine adds that layer in small, safe steps:

1. **Grocery Pool** (Phase 8B, this phase): record every grocery purchase as an ingredient lot with brand, source, quantity, and cost. The pool is central — it belongs to the business, not to any stall.
2. **Recipe Builder** (later): define what a finished product is made of, picking specific lots/brands from the pool, with custom-cost fallback when an ingredient is not in the pool.
3. **Production / Niluto with deduction** (later): cooking a batch deducts ingredients from the pool and moves cost onto the finished goods at the stall.
4. **Cook-upon-order** (later): kiosk sales of made-to-order items estimate COGS from recipes and recent prices without ever blocking the sale.
5. **Fixed costs and consolidated reporting** (later): stall rent, gas, labor spread into per-stall and whole-business profit views.

The engine is local-first SQLite throughout, consistent with the rest of the app. No cloud sync, auth, or AI is involved at any step of this plan.

## 2. Current app capabilities (as of commit 9541dc8)

- Business/branch (stall) setup; fresh vs demo first run; Clear Local Data reset.
- `products` table: finished/sellable goods with price, unit cost, stock, low-stock threshold, bundle pricing.
- Kiosk selling with bundle-aware checkout; one SQLite transaction per sale writing sale, sale_items, stock decrement, `stock_out_sale` inventory movement, receipt, and a pending offline-queue row.
- Cook/Niluto: transactional finished-goods stock-in creating a `recipe_batches` row and a `cooked` inventory movement. **No ingredient deduction** — `recipe_batches.total_batch_cost` currently uses the product's stored unit cost.
- Spoilage/Nasayang: transactional stock-out with negative-stock guard and `spoilage` movement.
- Owner alerts (low stock) with Notify Owner, resolve, and auto-resolve on restock.
- Records, Insights, Ask reading local summaries; QA-hardened flows with strict number input and duplicate-submit locks.

Key building blocks the engine reuses: the migration runner, transactional write pattern (`withExclusiveTransactionAsync`), typed repositories, strict input parsing, and the reset/count table registries.

## 3. New business workflow (target state)

1. Owner buys groceries anywhere (grocery, palengke, supplier) and records each item into the central Grocery Pool: "Rice, Japanese brand, grocery, 10 kg, ₱650."
2. The same ingredient concept (soy sauce) can have many lots with different brands, sources, and prices (Kikkoman 1L ₱180; local brand 1L ₱45).
3. Recipes reference ingredient lots by owner choice: Sushi uses Japanese rice + grocery cucumber + Kikkoman; Musubi sauce uses the local soy sauce.
4. When a batch is produced for a stall, ingredients are deducted from the pool and the batch cost flows onto the stall's finished goods.
5. Cook-upon-order products sell freely even when the pool is missing an ingredient; the engine estimates cost from recent purchase history and logs a shortfall note instead of blocking the sale.
6. Unsold finished goods stay assigned to their stall until sold, spoiled, or explicitly transferred.
7. Reports show per-stall margins and a consolidated business view once fixed costs land.

### Product rules (fixed decisions)

- **No manual grocery allocation to stalls.** The pool is central; it is reduced only by actual production usage or cook-upon-order usage.
- **Recipes select lots/brands/sources chosen by the owner**, not just abstract ingredients.
- **Custom ingredient cost is allowed later** when no pool item exists (e.g., "mango, ₱30 per piece, typed by hand").
- **Unsold goods stay with the stall** by default.
- **Missing inventory never blocks kiosk selling** in cook-upon-order mode.
- **Recent/history price fallback** feeds estimates in later phases.
- **Ingredient deduction is not implemented in Phase 8B.**

## 4. Data model strategy

Principles:

- Ingredients are **not** products. `products` stays exactly what the kiosk sells; ingredients live in their own tables. Nothing forces a soy sauce bottle into the sellable list.
- Concept vs stock: `ingredients` is the searchable concept ("Soy sauce"); `ingredient_lots` is the purchased reality ("Kikkoman, 1L, ₱180, bought July 5, 0.4L left").
- Additive migrations only. Each phase adds tables/columns; no phase rewrites existing sale/stock logic.
- Every table follows the house pattern: TEXT id, business_id FK, created_at/updated_at, sync_status, deleted_at, registered in `resettableTables` and `countableTables`.
- All multi-row writes go through one `withExclusiveTransactionAsync`.

Planned table map across phases:

| Table | Phase | Purpose |
| --- | --- | --- |
| `ingredients` | 8B | Ingredient concept/category, default unit, low-stock threshold |
| `ingredient_lots` | 8B | Purchased stock: brand, source, qty, remaining, cost, cost/unit |
| `ingredient_movements` | 8B | Purchase + manual adjustment audit trail (usage/spoilage types reserved) |
| `recipes` | 8C | Finished-product recipe header (links to a product, yield qty) |
| `recipe_ingredients` | 8C | Lines: ingredient_id + preferred lot/brand, qty, unit, or custom-cost line |
| `production_runs` | 8D | Batch production per stall: deductions, batch cost, output qty |
| `cost_estimates` | 8E | Cook-upon-order estimated COGS + shortfall log per sale item |
| `fixed_costs` | 8F | Rent, gas, labor entries with period + stall scope |

## 5. Grocery pool model (Phase 8B — implemented)

`ingredients`:

- `id`, `business_id`
- `name` (unique per business in practice; matched case-insensitively when recording purchases so "rice" and "Rice" do not split)
- `default_unit` (`g`, `kg`, `ml`, `L`, `pcs`, `pack`) — set by the first purchase, editable later
- `category` (free text, default "General")
- `low_stock_threshold` (in default unit; 0 = no alerting)
- `is_active`
- house columns

`ingredient_lots`:

- `id`, `business_id`, `ingredient_id`
- `brand_name` (nullable — "Kikkoman", "Japanese brand")
- `source_name` (nullable — "grocery", "palengke", vendor name)
- `purchase_date` (ISO date; defaults to today)
- `purchased_quantity`, `remaining_quantity` (remaining starts equal to purchased; can never go below 0)
- `unit` (the unit this lot was bought in)
- `total_cost`, `cost_per_unit` (= total_cost / purchased_quantity, computed at save)
- `notes`, `status` (`active` / `depleted` / `archived`)
- house columns

`ingredient_movements` (purchase + adjustment only in 8B):

- `id`, `business_id`, `ingredient_id`, `lot_id`
- `movement_type`: `purchase` | `adjustment` now; `recipe_usage`, `spoilage` reserved for later phases
- `quantity`, `unit`, `unit_cost`, `total_cost`, `reason`
- house columns

Pool math:

- Remaining pool value = Σ over non-deleted active/depleted lots of `remaining_quantity × cost_per_unit`.
- Per-ingredient remaining = Σ of lot remaining quantities converted to the ingredient's default unit where the conversion is trivial (kg↔g ×1000, L↔ml ×1000, pcs↔pcs, pack↔pack). Lots in non-convertible units still count toward value but are excluded from the low-stock comparison (documented limitation until unit conversion lands).
- Low stock: per-ingredient remaining ≤ threshold, only when threshold > 0.

## 6. Ingredient lot / brand / source model

Why lots instead of a single running quantity per ingredient:

- Different brands/sources have different prices, and recipes need to reference the *specific* purchase ("Kikkoman", not "some soy sauce").
- Cost history falls out naturally: recent lots per ingredient are the price history that cook-upon-order estimation will use.
- FIFO or owner-picked deduction both become possible later without schema change.

Recording flow ("Add grocery" form): the owner types the ingredient name; the service finds an existing ingredient by case-insensitive name or creates one, then creates the lot and a `purchase` movement — all in one transaction. Two soy sauce purchases with different brands become one `ingredients` row + two `ingredient_lots` rows, which is exactly the tester's example.

## 7. Recipe builder design (shipped in Phase 8C+8D)

As built:

- `recipes`: id, business_id, output_product_id (links to sellable product), name, output_quantity, output_unit, production_mode (`prepared_before_selling` / `cook_upon_order`, informational until 8E), suggested_selling_price (column reserved), notes, is_active.
- `recipe_ingredient_lines`: recipe_id plus either
  - lot line: `ingredient_id` + `ingredient_lot_id` (the owner-selected brand/source) + quantity + unit, with save-time snapshots (`cost_per_unit_snapshot`, `line_cost_snapshot`, `source_label_snapshot`) so archived/depleted lots never break a saved recipe, or
  - custom line: `custom_name` + `cost_override` with `is_custom = 1` (see §9 — shipped).
- Costing rule enforced in `src/domain/recipeCosting.ts` (pure, verified by `npm run check:recipes`): a lot line prices from its selected lot only, after kg↔g / L↔ml conversion; incompatible units are rejected, never silently computed. No averaging across lots.
- Makeable quantity and bottleneck are computed live from current lot remaining quantities, aggregating lines that share a lot; custom lines never limit makeable quantity.
- Nothing deducts: saving, costing, and browsing recipes leave grocery stock untouched until 8E production lands.
- Line editing after save is deferred (archive + recreate); recipe metadata updates use a defaults-free schema.

## 8. Searchable ingredient selection design

- One search box matching `ingredients.name`, `ingredient_lots.brand_name`, and `ingredient_lots.source_name` (SQL LIKE, case-insensitive), returning lots grouped under their ingredient with remaining qty and cost/unit visible — so choosing between "Kikkoman ₱180/L" and "local ₱45/L" is a one-glance decision.
- Phase 8B ships this same search on the Grocery Pool screen (name/brand/source filter), so 8C reuses the query rather than inventing a new one.
- Recent/frequently used ingredients sort first in the picker (simple: order by latest purchase date).

## 9. Custom ingredient cost fallback design (Phase 8C)

- When search finds nothing, the recipe line switches to "I-type ang presyo" mode: name + quantity + unit + typed unit cost.
- Stored on `recipe_ingredients` as a custom line (no ingredient row is force-created, so the pool stays honest).
- Later purchases of the same name can be linked by the owner ("use pool item from now on") — a one-field update from custom line to ingredient_id line.

## 10. Production per stall design (shipped in Phase 9)

As built:

- `production_batches`: business_id, branch_id (stall), recipe_id, output_product_id, recipe_name snapshot, output quantity/unit, batch_multiplier (fractional allowed — 12 pcs from a 5-per-batch recipe = 2.4 batches, everything scales linearly), total_batch_cost, cost_per_output_unit, notes. `production_ingredient_usages` records each line's scaled quantity, cost, lot, and label snapshot.
- One transaction: insert the batch, deduct each selected lot (lines sharing a lot aggregated first), write `recipe_usage` ingredient movements, insert usage rows, increase finished product stock, write a `cooked` inventory movement under the stall, and auto-resolve the product's low-stock alert when restocked above threshold. The existing simple `recipe_batches`/Niluto flow is untouched and remains available for products without recipes.
- Deduction only touches the recipe's selected lots — never other lots of the same ingredient, and never a FIFO fallback (the owner picked the brand on purpose). Lots can hit exactly 0 (status `depleted`) but never negative, guarded in the plan and again at the SQL level.
- **Design deviation from the original sketch**: production BLOCKS on insufficient selected lots with a friendly "Not enough X. Need A, available B." message instead of estimating through the shortfall. Production is planned ahead of time, so the owner can restock or adjust; the no-blocking estimation rule is reserved for cook-upon-order at the point of sale (§11).
- Finished goods live under the stall (existing `products.stock_qty` per branch) until sold/spoiled/transferred; transfers remain deferred. Pure planning math lives in `src/domain/productionMath.ts`, verified by `npm run check:production`.

## 11. Cook-upon-order design (shipped in Phase 10)

As built (design deviation: mode is derived from the latest active recipe instead of a product flag, and COGS lands on `sale_items` + `sale_ingredient_usages` instead of a separate `cost_estimates` table):

- A product whose latest active recipe has `production_mode = 'cook_upon_order'` sells made-to-order: the Sell screen shows a "Made to order" badge, cart and checkout skip the finished-stock guard, and finished stock is never decremented for these items.
- Checkout computes recipe COGS per sold item inside the existing single sale transaction. Each line deducts what its selected lot actually has (never other lots, never negative); the missing part is estimated at the same lot's price; a fully missing lot falls back to the line's save-time snapshot cost. Custom lines scale in cost and never deduct.
- `sale_items` carries `cogs_total/per_unit/source/is_estimated`; `sale_ingredient_usages` records per-line used quantity, shortfall quantity, cost, and label. Estimation is surfaced in Insights as a friendly note, never as a block at the counter.
- Pure math in `src/domain/orderCogs.ts`, verified by `npm run check:cogs`. Lots drained by one cart item are seen as drained by the next (shared working map).
- Prepared-before-selling items get COGS from the average produced unit cost (`production_average`), falling back to the owner-entered product cost (`simple`). FIFO cost layers remain deferred.

## 12. Unsold goods / spoilage / transfer design (shipped in Phase 11)

As built:

- Unsold finished goods remain on the stall's product stock; their value = stock × average produced unit cost, shown in Insights.
- Spoilage (Nasayang) values the loss at the average produced unit cost when production history exists, else the owner-entered product cost; recorded on the spoilage movement's cost fields.
- Transfers: the Transfers screen moves quantity between stalls in one transaction — source product decremented (guarded), a same-named product on the destination stall incremented (cloned if absent), a `product_transfers` row records the moved value, and paired `transfer_out`/`transfer_in` movements land in Records with "Lipat" badges.

## 13. Fixed cost design (shipped in Phase 12)

As built:

- `fixed_costs`: business_id, optional branch_id (null = whole business), name, category, amount, frequency (`daily`/`weekly`/`monthly`/`one_time`), anchor due date, optional end date, active/archived. `fixed_cost_payments` records each paid occurrence.
- Occurrences are computed on the fly from the anchor (pure math in `src/domain/fixedCostSchedule.ts`; monthly clamps to month end). An occurrence is an expense of the period its due date falls in, paid or not; payments are cash-flow visibility. Mark-paid settles the oldest unpaid occurrence and is duplicate-guarded.
- **Design deviation**: business-wide costs are NOT proportionally split across stalls — they appear only in the consolidated report, labeled. Proportional allocation was judged more confusing than helpful for sellers; revisit if testers ask.
- Pure reporting math — fixed costs never touch stock or sale writes. Reminders are in-app status only (no push, no background jobs).

## 14. Per-stall and consolidated reporting design (shipped in Phase 13)

As built (`src/services/profitReports.ts`, ranges: today / week / month / all):

- Per stall: revenue, sold COGS, gross profit, the stall's own fixed costs, spoilage loss, net profit, plus informational production spend, unsold goods value, transfer in/out value, best seller, and estimated-COGS count.
- Consolidated: totals across everything (including rows with no stall), business-wide fixed costs, unsold goods value, remaining grocery value, transfer activity, best stall, top products, and warning counts.
- Accounting rules enforced in `src/domain/profitMath.ts` (verified by `npm run check:fixedcosts`): net = revenue − sold COGS − fixed costs − spoilage; unsold goods and groceries are inventory, not expenses; transfers never touch profit; production spend is shown but never added to expenses (sold COGS already covers it — no double-counting).
- Estimated COGS is included in COGS and flagged ("Estimated cost used" warnings), never hidden.
- Builds on Insights' local-summary pattern — no chart library, no cloud.

## 15. Phase-by-phase roadmap

| Phase | Scope | Ships |
| --- | --- | --- |
| **8B (shipped)** | Grocery Pool foundation | ingredients/lots/movements tables, grocery repos + service, Grocery Pool screen, Home/Insights hooks |
| **8C+8D (shipped)** | Recipe Builder + costing | recipes + recipe_ingredient_lines, searchable lot picker, custom-cost lines, selected-lot costing, makeable quantity + bottleneck (no deduction) |
| **9 (shipped)** | Production per stall | production_batches + usages, selected-lot deduction with blocking shortfalls, fractional batches, COGS per stall (transfers deferred) |
| **10+11 (shipped)** | Selling COGS + lifecycle | cook-upon-order no-block COGS with shortfall records, prepared-goods average COGS, unsold value, spoilage value, transfers |
| **12+13 (shipped)** | Fixed costs + reports | fixed_costs + payments, deterministic recurrence, per-stall margin, consolidated profit view |
| Next | Polish/QA | end-to-end hardening pass over the engine, copy, edge cases; FIFO cost layers; reminders |

Each phase is independently shippable and keeps all earlier flows intact.

## 16. Risks and edge cases

- **Unit mismatches** (bought in kg, recipe in g): 8B stores units as entered and converts only kg↔g and L↔ml for low-stock math; recipe costing must use the same trivial conversions and refuse silently-lossy ones (pack→g needs owner-defined pack size first).
- **Same ingredient, different names** ("soya", "soy sauce"): case-insensitive match helps; a later merge tool may be needed. Not blocking — worst case is two concept rows.
- **Zero/absurd quantities**: strict parsing rejects commas/garbage; totals and quantities must be > 0; cost/unit division is guarded against zero quantity.
- **Depleted lots in recipes**: never block; fall back to recent price; label estimates clearly.
- **Deleting an ingredient with lots**: soft-delete only, and only via deactivate; lots keep their history for reports.
- **Clock changes / purchase dates**: purchase_date is informational; ordering falls back to created_at.
- **Migration on existing installs**: additive tables only; migration runner already proven across 003.
- **Double-tap on Add grocery**: same synchronous lock pattern as checkout/cook/spoilage.
- **Pool value drift** once deduction lands: movements table is the audit trail to reconcile against.

## 16.5 Pilot test path (Phase 15)

The seller pilot walkthrough lives in two places: the in-app Pilot Guide (Settings → Pilot Guide) and `docs/pilot/android-seller-pilot-checklist.md` for testers. The canonical path: setup → groceries → products → recipe → production → select a stall → kiosk sale (bundle + cook-upon-order + estimated-cost case) → records → insights → fixed cost → profit reports. `npm run check:pilot` verifies the same story's math end to end.

## 17. Test strategy

- Keep `npm run typecheck`, `npm run lint`, `npm run check:pricing` green every phase.
- Extend the pure-check pattern (like `scripts/check-pricing.js`) when pure math appears: cost-per-unit and unit conversion in 8B+ (`check-grocery-math` candidate), recipe costing in 8C, FIFO deduction in 8D.
- Manual acceptance walkthroughs per phase against fresh mode, demo mode, and Clear Local Data.
- Data-integrity spot checks: every multi-row write is one transaction; remaining quantities never negative; existing sale integrity checker still passes.

## 18. Deferred features (explicitly out of 8B)

- Recipe builder, recipe costing, and ingredient search-in-recipe UI.
- Ingredient deduction of any kind (production or cook-upon-order).
- Cook-upon-order COGS estimation and shortfall logging.
- General unit conversion beyond kg↔g and L↔ml equivalence for low-stock math (pack sizes, cups, tbsp).
- Custom ingredient cost fallback (designed in §9, built with recipes).
- Finished-goods transfers between stalls.
- Fixed costs and consolidated profit reporting.
- Any cloud sync, auth, AI, OCR/camera grocery capture, or printing.
