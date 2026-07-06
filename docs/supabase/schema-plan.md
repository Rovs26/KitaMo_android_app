# Supabase Schema Plan (Chapter 3 — planning only)

Planned Postgres schema for KitaMo's future cloud layer. **Nothing here is implemented.** SQLite stays the offline-first source of truth; Supabase mirrors it for backup, sync, and multi-user.

## Design principles

- Every business-owned row is scoped by `business_id` (for RLS).
- Stall-level rows also carry `stall_id`.
- Sales carry `seller_user_id` (who rang it up).
- IDs are UUIDs generated on-device so a row keeps the same id offline and after upload (upsert by id, never regenerate — see the sync plan).
- Every table carries the standard sync columns below.

## Standard columns on every synced table

| Column | Purpose |
| --- | --- |
| `id` (uuid, pk) | Stable id, generated on device |
| `business_id` (uuid) | Tenant scope for RLS (except `users`) |
| `origin_device_id` (text) | Which device created the row |
| `sync_status` (text) | `local` / `pending` / `synced` / `failed` |
| `version` (int) | Optimistic-concurrency counter for conflict handling |
| `created_at` (timestamptz) | |
| `updated_at` (timestamptz) | |
| `deleted_at` (timestamptz, null) | Soft delete; never hard-delete synced rows |

## Planned tables

### Identity & membership (new in cloud)

- **users** — `id` (= auth.users.id), display name, phone/email, `created_at`. Not business-scoped.
- **businesses** — owner-owned business; `owner_user_id`, name, type, barangay, currency.
- **business_memberships** — `user_id`, `business_id`, `role` (owner / manager / seller / viewer), `invited_by`, `status`.
- **stalls** — the current `branches`; `business_id`, name, location, type, active.
- **stall_memberships** — `user_id`, `business_id`, `stall_id`, `role`.
- **invites** — pending membership invites; `business_id`, `stall_id` (nullable), `email_or_phone`, `role`, `token`, `expires_at`, `status`.

### Inventory & recipes (mirror of local tables)

- **products** — `business_id`, `stall_id`, name, price, cost, stock, unit, low-stock threshold, bundle fields, product_type.
- **ingredients** — `business_id`, name, default_unit, category, low_stock_threshold.
- **ingredient_lots** — `business_id`, `ingredient_id`, brand, source, purchase_date, purchased/remaining qty, unit, total_cost, cost_per_unit, status.
- **recipes** — `business_id`, `output_product_id`, name, output_quantity/unit, production_mode, notes.
- **recipe_ingredient_lines** — `business_id`, `recipe_id`, ingredient/lot or custom, qty, unit, cost snapshots, is_custom.

### Production & sales (mirror of local tables)

- **production_batches** — `business_id`, `stall_id`, `recipe_id`, `output_product_id`, qty/unit, multiplier, total_cost, cost_per_unit.
- **production_ingredient_usages** — `business_id`, `production_batch_id`, ingredient/lot, qty, unit, line_cost.
- **sales** — `business_id`, `stall_id`, `seller_user_id`, transaction_no, happened_at, amount, discount, payment_method/status, reference.
- **sale_items** — `business_id`, `sale_id`, product, qty, unit_price, line_total, bundle_applied, `cogs_total/per_unit/source/is_estimated`, related_recipe_id.
- **sale_ingredient_usages** — `business_id`, `sale_id`, `sale_item_id`, recipe/ingredient/lot, qty, unit, line_cost, is_estimated, shortfall.
- **inventory_movements** — `business_id`, `stall_id`, `product_id`, movement_type, qty, cost fields, linked_sale_id.

### Money & lifecycle (mirror of local tables)

- **fixed_costs** — `business_id`, `stall_id` (nullable = whole business), name, category, amount, frequency, due/end dates, status.
- **fixed_cost_payments** — `business_id`, `fixed_cost_id`, `stall_id`, due_date, paid_date, amount, status.
- **product_transfers** — `business_id`, from/to `stall_id`, from/to `product_id`, product_name, qty, unit_cost, total_cost.
- **receipts** — `business_id`, `stall_id`, `sale_id`, transaction_no, receipt_text, issued_at.

### System

- **audit_logs** — `business_id`, `user_id`, action, entity_type, entity_id, before/after (jsonb), `created_at`. Append-only.
- **sync_metadata** — per-device/table sync bookkeeping: `device_id`, `table_name`, `last_synced_at`, cursor/high-water mark.

## Notes

- The local SQLite schema (migrations 001–008) already matches most columns; the genuinely new concepts are users/memberships/invites/audit_logs/sync_metadata and the `_user_id` / `origin_device_id` / `version` additions.
- No enums are locked yet; keep role/status as text with app-level validation until the schema is built.
