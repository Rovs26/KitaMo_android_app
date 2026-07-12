# Supabase RLS Plan (Chapter 3 — planning only)

Row Level Security design for KitaMo's future cloud layer. **Not implemented.** The anon key shipped in the mobile app is only safe once these policies exist — until then, cloud sync stays off.

## Roles

| Role | Access |
| --- | --- |
| **Owner** | Full read/write on every business, stall, and record they own. |
| **Manager** | Read/write on the businesses/stalls they are assigned to. |
| **Seller** | Read/write only on their assigned stall's operational data (sales, stock at that stall). Cannot see other stalls. |
| **Viewer / Accountant** | Read-only on reports/records for assigned businesses; no writes. |

Roles live in `business_memberships` (business-level) and `stall_assignments` (stall-level). A seller may have a limited business membership for tenant linkage, but that membership alone never grants business-wide data access.

## Core scoping rules

- **Every business table is scoped by `business_id`.** A user may touch a row only if they have a membership in that `business_id`.
- **Stall-level data must include `business_id` + `stall_id`.** Sellers are further restricted to stalls with an active assignment and, when shift enforcement is enabled, an eligible shift or time-bounded Kiosk grant.
- **Sales must include `seller_user_id`.** A seller can insert sales only for their authenticated identity and an authorized stall.
- **QR codes, short codes, and invitation tokens are not authentication.** Possession of a locator never satisfies an RLS membership or assignment check.
- **Pending access is not membership.** A pending/rejected seller can read only their own request state and minimal enrollment response, not business or stall records.

## Policy sketch (pseudocode — not final SQL)

Helper: `is_member(business_id)` = a row exists in `business_memberships` for `auth.uid()` and that `business_id` with an active status. Policies must still inspect role; seller membership is not broad business access.

Helper: `has_stall(business_id, stall_id)` = an active matching `stall_assignment`, OR the user's business role is owner/manager.

Helper: `has_kiosk_grant(business_id, stall_id)` = `has_stall(...)` plus the approved shift/grant rule when Phase D enables active-shift enforcement.

- **Business-scoped tables** (products, ingredients, recipes, fixed_costs, …):
  - SELECT/INSERT/UPDATE/DELETE allowed when `is_member(business_id)` and the specific role permits the operation (owner/manager write; viewer read-only; seller denied unless a separate stall-scoped policy explicitly allows it).
- **Stall-scoped tables** (sales, sale_items, inventory_movements, production_batches, …):
  - SELECT when `has_stall(business_id, stall_id)`.
  - INSERT/UPDATE when role is owner/manager, or the user has the required seller Kiosk grant for that `stall_id` (and, for sales, `seller_user_id = auth.uid()`).
- **profiles**: users can read/update their own permitted fields; owners can see only the minimum seller profile needed to manage access for their businesses.
- **seller_access_requests**: an authenticated seller can create/read/cancel only their own request. Owners can read and decide requests only for businesses they own.
- **stall_join_methods**: direct client SELECT is denied for token/code hashes. Resolution and rotation happen through narrowly scoped server endpoints.
- **assignments / shifts / grants**: sellers read only their own rows; owners manage rows only for their businesses. Approval/revocation/grant issuance is server-mediated and audited.
- **business memberships**: only owners/managers can create/revoke; users can read only memberships that include them unless their role explicitly permits staff administration.
- **audit_logs**: insert by the app; read by owner/manager; never update/delete.

## Safety principles

- Deny by default; every table gets explicit policies before its anon-key access is enabled.
- Soft-delete only (`deleted_at`); RLS must still scope deleted rows.
- The service-role key is never in the app — server-only, bypasses RLS.
- Seller username lookup and password verification are never performed through public client-readable tables.
- Enrollment endpoints use generic errors, idempotency, expiry/replay checks, CAPTCHA where appropriate, and per-IP/per-account rate limits.
- Add policies and test them per-role before turning on sync for any real seller.

Required negative tests include unauthenticated QR/code use, pending/rejected requests, revoked assignments, expired shifts/grants, cross-stall access, cross-business access, forged `seller_user_id`, and replayed approval requests.

No RLS SQL is written yet; this is the intended shape for Chapter 3.

See [Chapter 3 Identity and Access Plan](../roadmap/chapter-3-identity-access-plan.md) for the approved authentication, enrollment, assignment, and Phase C/D model.
