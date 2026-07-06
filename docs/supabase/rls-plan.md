# Supabase RLS Plan (Chapter 3 — planning only)

Row Level Security design for KitaMo's future cloud layer. **Not implemented.** The anon key shipped in the mobile app is only safe once these policies exist — until then, cloud sync stays off.

## Roles

| Role | Access |
| --- | --- |
| **Owner** | Full read/write on every business, stall, and record they own. |
| **Manager** | Read/write on the businesses/stalls they are assigned to. |
| **Seller** | Read/write only on their assigned stall's operational data (sales, stock at that stall). Cannot see other stalls. |
| **Viewer / Accountant** | Read-only on reports/records for assigned businesses; no writes. |

Roles live in `business_memberships` (business-level) and `stall_memberships` (stall-level).

## Core scoping rules

- **Every business table is scoped by `business_id`.** A user may touch a row only if they have a membership in that `business_id`.
- **Stall-level data must include `business_id` + `stall_id`.** Sellers are further restricted to rows whose `stall_id` is in their stall memberships.
- **Sales must include `seller_user_id`.** A seller can insert sales only for themselves and only for their stall.

## Policy sketch (pseudocode — not final SQL)

Helper: `is_member(business_id)` = a row exists in `business_memberships` for `auth.uid()` and that `business_id` with a non-revoked status.

Helper: `has_stall(business_id, stall_id)` = a matching row in `stall_memberships`, OR the user's business role is owner/manager.

- **Business-scoped tables** (products, ingredients, recipes, fixed_costs, …):
  - SELECT/INSERT/UPDATE/DELETE allowed when `is_member(business_id)` and the role permits writes (owner/manager write; viewer read-only).
- **Stall-scoped tables** (sales, sale_items, inventory_movements, production_batches, …):
  - SELECT when `has_stall(business_id, stall_id)`.
  - INSERT/UPDATE when role is owner/manager, or the user is a seller of that `stall_id` (and, for sales, `seller_user_id = auth.uid()`).
- **users**: a user can read their own row and rows of co-members; write only their own.
- **memberships / invites**: only owners/managers of the business can create/revoke; a user can read memberships that include them.
- **audit_logs**: insert by the app; read by owner/manager; never update/delete.

## Safety principles

- Deny by default; every table gets explicit policies before its anon-key access is enabled.
- Soft-delete only (`deleted_at`); RLS must still scope deleted rows.
- The service-role key is never in the app — server-only, bypasses RLS.
- Add policies and test them per-role before turning on sync for any real seller.

No RLS SQL is written yet; this is the intended shape for Chapter 3.
