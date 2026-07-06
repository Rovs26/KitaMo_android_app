# Chapter 3 — Supabase Backend Plan (high-level, not implemented)

Direction only. **Nothing here is built.** Chapter 2 shipped a complete local-first app; Chapter 3 adds an optional backend after internal testing.

## Framing

- **Google Play distributes the app. Supabase will run the backend** (auth, database, storage, APIs). These are separate concerns: Play never hosts KitaMo's data.
- Introduce Supabase **after** internal testing has validated the local app with real sellers — don't add backend risk before the core is proven.
- **SQLite stays the offline-first source of truth.** Supabase is a sync/backup/multi-device layer on top, not a replacement. The app must keep working fully offline.

## What Supabase would provide

- **Auth** — login/accounts (email or phone), so a seller's data can follow them across devices.
- **Postgres** — the cloud mirror of the local schema.
- **Row Level Security (RLS)** — a seller only ever reads/writes their own business's rows.
- **Storage** — future receipt images / exports (not the local receipt text).
- **APIs / Edge Functions** — sync endpoints and any server-side logic.

## Future entities (cloud schema sketch)

`users`, `businesses`, `business_memberships`, `stalls`, `stall_memberships`, `invites`, `products`, `ingredients`, `ingredient_lots`, `recipes`, `production_batches`, `sales`, `fixed_costs`, `audit_logs`.

The local tables already map cleanly to most of these; membership/invite/audit tables are the new multi-user concepts.

## Future phases

1. **Supabase schema** — mirror the local model in Postgres; define RLS policies.
2. **Auth / login** — add accounts without breaking the current no-login local flow (login optional, enabling sync).
3. **Owner / business / stall roles** — memberships and invites so an owner can add staff per stall.
4. **Cloud sync** — bidirectional sync of local SQLite ↔ Supabase, offline-first with conflict handling; the existing `offline_queue` is the seed of this.
5. **API / RLS hardening** — lock down every policy, add audit logging, security review before any real multi-user use.

## Non-goals for Chapter 3 start

No payment processing, no marketplace, no LGU dashboard, no Customer Mode — those remain out of scope regardless of backend.
