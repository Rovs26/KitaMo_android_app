# Local → Cloud Sync Plan (Chapter 3 — planning only)

How KitaMo's on-device SQLite will eventually back up to and sync with Supabase. **No sync is implemented in this phase.** The app remains fully functional offline forever.

## Principles

- **SQLite stays offline-first and authoritative.** The seller can run the whole business with no internet. Supabase is an optional backup/sync/multi-device layer added on top — never a dependency for the app to open or work.
- **Sync is additive.** Turning cloud on must not change any local behavior, math, or Fresh/Demo mode.

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

1. **Push**: send `pending` rows (upsert by id), oldest first, respecting FK order (business → stall → products/ingredients → recipes → production → sales → children). On success mark `synced` and bump nothing; on failure mark `failed` with a retry.
2. **Pull**: fetch rows updated since the last high-water mark for this business; upsert into SQLite.
3. **Deletes**: soft-delete only — propagate `deleted_at`, never hard-delete a synced row.

## Conflict handling (conservative)

- Compare `version` / `updated_at`. If the cloud row is newer, prefer it; if local is newer, push local.
- For money records (sales, payments), prefer **append-only** semantics — never silently overwrite a committed sale; flag conflicts for the owner instead of guessing.
- When in doubt, keep both and surface the conflict rather than losing data.

## Rollout

- Sync is **opt-in** and gated behind configured Supabase env vars + login (Chapter 3). With no config, none of this runs.
- Ship behind a flag; test with one device, then two, before any real seller relies on it.
