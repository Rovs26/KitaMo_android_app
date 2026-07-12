# Chapter 3 — Supabase Backend Plan (high-level, not implemented)

Direction only. **Nothing here is built.** Chapter 2 shipped a complete local-first app; Chapter 3 adds an optional backend after internal testing.

## Framing

- **Google Play distributes the app. Supabase will run the backend** (auth, database, storage, APIs). These are separate concerns: Play never hosts KitaMo's data.
- Introduce Supabase **after** internal testing has validated the local app with real sellers — don't add backend risk before the core is proven.
- **SQLite stays the offline-first source of truth.** Supabase is a sync/backup/multi-device layer on top, not a replacement. The app must keep working fully offline.

## What Supabase would provide

- **Owner Auth** — Google Sign-In for owner accounts.
- **Seller identity integration** — KitaMo username/password through a reviewed server-side identity path; sellers are not required to have Gmail. Supabase's native password identifiers are email or phone, so the exact username provider/adapter must be decided in the Phase C security spike.
- **Postgres** — the cloud mirror of the local schema.
- **Row Level Security (RLS)** — owners access their businesses; sellers access only approved assignments, eligible stalls/shifts, and permitted Kiosk rows.
- **Storage** — future receipt images / exports (not the local receipt text).
- **APIs / Edge Functions** — server-side enrollment, approval, assignment, sync, and other privileged operations.

## Approved identity and access direction

- Owners authenticate with Google and manage businesses, stalls, sellers, approvals, reports, and settings.
- Sellers authenticate separately with a KitaMo username/password and do not need Gmail.
- QR codes, short stall/invite codes, and owner invitations identify an enrollment target and initiate an access request. They are never authentication credentials and never grant access by possession alone.
- An authenticated seller requests access, an owner approves, and the resulting assignment determines which stalls, shifts, and Kiosk functions are visible.
- A seller may hold assignments to multiple stalls and multiple shifts.
- Authentication, membership authorization, and offline device grants are separate layers.

The detailed architecture, data model, threat boundaries, and Phase C/D backlog are in [Chapter 3 Identity and Access Plan](./chapter-3-identity-access-plan.md).

## Future entities (cloud schema sketch)

`profiles`, `businesses`, `business_memberships`, `stalls`, `stall_join_methods`, `seller_access_requests`, `stall_assignments`, `seller_shifts`, `device_registrations`, `kiosk_access_grants`, `approval_events`, `products`, `ingredients`, `ingredient_lots`, `recipes`, `production_batches`, `sales`, `fixed_costs`, `audit_logs`.

The local tables already map cleanly to most business records. Identity profiles, join methods, access requests, assignments, shifts, device grants, and approval/audit tables are the new multi-user concepts. Passwords stay in the selected authentication provider and never enter KitaMo business tables.

## Future phases

1. **Phase C0: provider/security spike** — validate owner Google Sign-In and select a secure KitaMo username/password architecture, recovery model, rate limits, and threat controls.
2. **Phase C1-C2: identity foundation** — profiles, Google owner login, seller credentials, secure sessions, feature flags, and account lifecycle.
3. **Phase C3-C4: enrollment and approval** — QR/code/invitation locators, access requests, owner decisions, multi-stall assignments, RLS, and audit history.
4. **Phase D1: shifts and Kiosk eligibility** — multiple stalls/shifts, active-shift checks, and least-privilege Kiosk access.
5. **Phase D2: cloud sync and offline grants** — bidirectional SQLite ↔ Supabase sync with scoped, expiring offline authorization and conflict handling; the existing `offline_queue` is the seed of this.
6. **Phase D3: alerts and hardening** — push notifications, abuse monitoring, security review, backup/recovery, privacy controls, and staged rollout.

## Non-goals for Chapter 3 start

No payment processing, no marketplace, no LGU dashboard, no Customer Mode — those remain out of scope regardless of backend.
