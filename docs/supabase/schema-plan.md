# Supabase Schema Plan (Chapter 3 — planning only)

Planned Postgres schema for KitaMo's future cloud layer. **Nothing here is implemented.** SQLite stays the offline-first source of truth; Supabase mirrors it for backup, sync, and multi-user.

## Design principles

- Every business-owned row is scoped by `business_id` (for RLS).
- Stall-level rows also carry `stall_id`.
- Sales carry `seller_user_id` (who rang it up).
- Authentication credentials live only in the selected identity provider. KitaMo tables never store seller passwords or password hashes.
- A QR/code/invitation is an enrollment locator, not a credential. Approval and an active assignment are required before stall data becomes accessible.
- IDs are UUIDs generated on-device so a row keeps the same id offline and after upload (upsert by id, never regenerate — see the sync plan).
- Every table carries the standard sync columns below.

## Standard columns on every synced table

| Column | Purpose |
| --- | --- |
| `id` (uuid, pk) | Stable id, generated on device |
| `business_id` (uuid) | Tenant scope for RLS (except global identity/device entities) |
| `origin_device_id` (text) | Which device created the row |
| `sync_status` (text) | `local` / `pending` / `synced` / `failed` |
| `version` (int) | Optimistic-concurrency counter for conflict handling |
| `created_at` (timestamptz) | |
| `updated_at` (timestamptz) | |
| `deleted_at` (timestamptz, null) | Soft delete; never hard-delete synced rows |

## Planned tables

### Identity & membership (new in cloud)

- **profiles** — `id`, `auth_user_id`, `account_type` (owner / seller), display name, status, optional recovery-contact metadata. No credential or password columns.
- **seller_login_identifiers** (identity service or private schema, if needed) — normalized username, identity-provider user id, and account status. Server-only, excluded from the public Data API, and contains no plaintext password.
- **businesses** — owner-managed business; name, type, barangay, currency. Ownership is authorized through active membership records.
- **business_memberships** — `user_id`, `business_id`, `role` (owner / manager / seller / viewer), `invited_by`, `status`, effective/revoked timestamps. A seller role never implies business-wide record access.
- **stalls** — the current `branches`; `business_id`, name, location, type, active.
- **stall_join_methods** — `business_id`, `stall_id`, method (QR / short_code / invitation), token or code hash, version, expiry, rotation/status, optional usage limit. Locators never authenticate a user.
- **seller_access_requests** — `requester_user_id`, `business_id`, `stall_id`, `join_method_id`, status (pending / approved / rejected / cancelled), request/decision timestamps, deciding owner, reason, idempotency key.
- **stall_assignments** — `user_id`, `business_id`, `stall_id`, role/permissions, status, effective dates, approving owner, revoked metadata. One seller can have multiple stall assignments.
- **seller_shifts** — `assignment_id`, `user_id`, `business_id`, `stall_id`, scheduled start/end, timezone, status, optional owner override metadata.
- **device_registrations** — `user_id`, device id, platform, last seen, trust/revocation status, future push token. A device is not a user identity.
- **kiosk_access_grants** — `user_id`, `device_id`, `business_id`, `stall_id`, `assignment_id`, optional `shift_id`, issued/expires/revoked timestamps, grant version.
- **approval_events** — append-only access-request, approval, rejection, assignment, and revocation history.

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

- The local SQLite schema (migrations 001–008) already matches most business-data columns. Profiles, join methods, access requests, assignments, shifts, devices/grants, approval/audit logs, sync metadata, and the `_user_id` / `origin_device_id` / `version` additions are genuinely new cloud concepts.
- At most one pending request should exist per seller/stall, and at most one active assignment should exist for the same seller/stall/role.
- Codes should be random, revocable, rate-limited, and stored as hashes where practical. Invitations should be expiring and single-purpose.
- Approval and revocation should run in server-side transactions that update request/assignment state and append an audit event atomically.
- No enums are locked yet; keep role/status as text with app-level validation until the schema is built.

See [Chapter 3 Identity and Access Plan](../roadmap/chapter-3-identity-access-plan.md) for the approved flow and phased implementation backlog.
