# Local → Cloud Sync Plan (Chapter 3 — planning only)

How KitaMo's on-device SQLite will eventually back up to and sync with Supabase. **No sync is implemented in this phase.** The current same-device pilot remains fully local. Future authenticated seller devices must balance offline operation with time-bounded authorization and revocation.

## Principles

- **SQLite stays offline-first and operationally authoritative.** After identity and access are verified, a seller can continue Kiosk work during temporary connectivity loss within the approved offline grant window.
- **Sync is additive.** Turning cloud on must not change any local behavior, math, or Fresh/Demo mode.
- **Authentication and authorization precede scoped sync.** A device may push or pull only businesses/stalls covered by the authenticated user's active membership, assignment, and device grant.
- **Offline access is explicit, not permanent.** Initial sign-in, approval receipt, first assignment download, and periodic grant refresh require connectivity. The accepted offline revocation window must be decided before multi-device rollout.

## ID strategy

- Local records currently use readable local ids (e.g. `local_sale_...`). Before sync, migrate id generation to **UUIDs** so ids are globally unique and stable.
- **Upsert by id.** Upload uses `INSERT ... ON CONFLICT (id) DO UPDATE`. A row keeps the same id offline and in the cloud.
- **Never regenerate ids during upload.** Re-keying would duplicate data and break foreign keys (sale_items → sales, etc.).
- Foreign keys stay intact because parent and child both carry stable UUIDs.

## Sync bookkeeping

- Each row carries `sync_status` (`local` → `pending` → `synced` / `failed`), `origin_device_id`, `version`, and `updated_at`.
- The existing `offline_queue` table is the seed of the outbound queue: rows to push, with retry/attempt tracking.
- `sync_metadata` tracks per-table high-water marks so pulls fetch only what changed.

## Sync flow (planned)

1. **Authorize**: validate the current cloud session plus the device's business/stall grant before any queue work.
2. **Push**: send authorized `pending` rows (upsert by id), oldest first, respecting FK order (business → stall → products/ingredients → recipes → production → sales → children). On success mark `synced` and bump nothing; on failure mark `failed` with a retry.
3. **Pull**: fetch only rows permitted by RLS and updated since the last high-water mark for the authorized business/stall; upsert into SQLite.
4. **Deletes**: soft-delete only — propagate `deleted_at`, never hard-delete a synced row.

## Conflict handling (conservative)

- Compare `version` / `updated_at`. If the cloud row is newer, prefer it; if local is newer, push local.
- For money records (sales, payments), prefer **append-only** semantics — never silently overwrite a committed sale; flag conflicts for the owner instead of guessing.
- When in doubt, keep both and surface the conflict rather than losing data.

## Rollout

- Sync is **opt-in** and gated behind configured Supabase environment, authenticated identity, approved access, and a valid device grant (Chapter 3). With no configuration, none of this runs.
- Ship behind a flag; test with one device, then two, before any real seller relies on it.
- Test revocation while online/offline, expired grants, cross-stall queue rows, account switching on a shared phone, and queued sales created near grant expiry.

See [Chapter 3 Identity and Access Plan](../roadmap/chapter-3-identity-access-plan.md) for the approved owner/seller identity and Phase C/D authorization model.
