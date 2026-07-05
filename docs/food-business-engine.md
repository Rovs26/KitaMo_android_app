# KitaMo Food Business Engine — Architecture Plan

Status: Phase 8A planning document. Phase 8B implements only the Grocery Pool and Ingredient Inventory foundation described in sections 5–6. Everything else in this document is design for later phases.

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

## 7. Recipe builder design (Phase 8C, not in 8B)

- `recipes`: id, business_id, product_id (links to sellable product), name, yield_quantity ("makes 20 pcs"), notes, is_active.
- `recipe_ingredients`: recipe_id, then either
  - pool line: `ingredient_id` + optional `preferred_lot_id` (owner-selected brand/source) + quantity + unit, or
  - custom line: `custom_name` + `custom_unit_cost` + quantity (fallback when the pool has nothing — see §9).
- Costing preview at edit time: pool lines price from preferred lot's cost/unit, else the ingredient's most recent lot; custom lines use the typed cost. Preview only — nothing deducts.
- A recipe never hard-fails when a lot is depleted; it downgrades to recent-price estimation and shows a gentle "wala na sa pool" hint.

## 8. Searchable ingredient selection design

- One search box matching `ingredients.name`, `ingredient_lots.brand_name`, and `ingredient_lots.source_name` (SQL LIKE, case-insensitive), returning lots grouped under their ingredient with remaining qty and cost/unit visible — so choosing between "Kikkoman ₱180/L" and "local ₱45/L" is a one-glance decision.
- Phase 8B ships this same search on the Grocery Pool screen (name/brand/source filter), so 8C reuses the query rather than inventing a new one.
- Recent/frequently used ingredients sort first in the picker (simple: order by latest purchase date).

## 9. Custom ingredient cost fallback design (Phase 8C)

- When search finds nothing, the recipe line switches to "I-type ang presyo" mode: name + quantity + unit + typed unit cost.
- Stored on `recipe_ingredients` as a custom line (no ingredient row is force-created, so the pool stays honest).
- Later purchases of the same name can be linked by the owner ("use pool item from now on") — a one-field update from custom line to ingredient_id line.

## 10. Production per stall design (Phase 8D)

- `production_runs`: business_id, branch_id (stall), recipe_id, batches, output product_id, output quantity, produced_at, total_ingredient_cost, notes.
- One transaction: deduct each recipe line from lots (preferred lot first, then FIFO across that ingredient's active lots), write `recipe_usage` ingredient movements, insert the production run, increase finished product stock at the stall, write a `cooked` inventory movement, update `recipe_batches` for continuity with the existing Niluto flow.
- Deduction can drive lots to exactly 0 (status `depleted`) but never negative; if the pool is short, the run still saves using recent-price estimation for the missing part and logs a shortfall note (production mirrors the no-blocking rule).
- Finished goods then live under the stall (existing `products.stock_qty` per branch) until sold/spoiled/transferred — no change to kiosk sale logic.

## 11. Cook-upon-order design (Phase 8E)

- A product flag (`cooked_to_order`) marks items with no meaningful stock count.
- Kiosk sale of such items skips the stock guard (sells freely) and, post-sale, writes a `cost_estimates` row: recipe-based COGS using preferred lots when available, else the ingredient's most recent cost history, else the recipe's custom costs.
- If any ingredient had no pool stock, the estimate records a `shortfall` flag and the missing lines — the owner sees "estimated, may kulang sa pool" in reports instead of being blocked at the counter.
- Pool deduction happens only for lines that actually had stock; estimation covers the rest. Never negative, never blocking.

## 12. Unsold goods / spoilage / transfer design

- Unsold finished goods remain on the stall's product stock (already true today).
- Spoilage stays the existing Nasayang flow; when recipes exist, spoiled finished goods will also surface the lost ingredient cost in reports (no new writes needed — batch cost already known).
- Transfers (Phase 8D+): a `transfer` movement pair moving finished-good quantity from one branch's product row to another's, one transaction, with a friendly "Ilipat sa ibang stall" action. Until then, owners re-record stock via existing flows.

## 13. Fixed cost design (Phase 8F)

- `fixed_costs`: business_id, optional branch_id (null = whole business), label ("Rent", "Gas", "Helper"), amount, period (`daily` / `weekly` / `monthly` / `one-time`), effective dates, notes.
- Reporting spreads period costs into daily equivalents for the reporting window; stall-scoped costs hit that stall, business costs split by stall sales share (simple proportional rule, documented to the owner).
- Pure reporting math — fixed costs never touch stock or sale writes.

## 14. Per-stall and consolidated reporting design (Phase 8F)

- Per stall: benta (existing), ingredient COGS (production runs + cook-upon-order estimates), spoilage cost, fixed costs → tubo per stall.
- Consolidated: sum of stalls + unallocated pool value snapshot ("groceries still on hand").
- Estimated vs actual clearly separated: rows sourced from `cost_estimates` are always labeled "tantiya" (estimate); rows from real deductions are actual.
- Builds on Insights' existing local-summary pattern — no chart library, no cloud.

## 15. Phase-by-phase roadmap

| Phase | Scope | Ships |
| --- | --- | --- |
| **8B (now)** | Grocery Pool foundation | ingredients/lots/movements tables, grocery repos + service, Grocery Pool screen, Home/Insights hooks |
| 8C | Recipe Builder | recipes + recipe_ingredients, searchable lot picker, custom-cost lines, cost preview (no deduction) |
| 8D | Production per stall | production_runs, pool deduction with FIFO + preferred lot, batch cost onto stall goods, transfers |
| 8E | Cook-upon-order | cooked_to_order flag, no-block selling, cost_estimates + shortfall logging, history-price fallback |
| 8F | Fixed costs + reports | fixed_costs, per-stall margin, consolidated profit view |
| 8G | Polish/QA | end-to-end hardening pass over the engine, copy, edge cases |

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
