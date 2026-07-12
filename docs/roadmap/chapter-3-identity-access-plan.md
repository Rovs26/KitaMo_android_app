# Chapter 3 Identity and Access Plan (approved direction, not implemented)

This document records the approved identity model for future Phase C/D work. It does not change the current Android Internal Testing build.

## Current pilot boundary

- The current app remains a local-first, same-device Owner/Kiosk pilot.
- Owner PIN or device biometrics protect local Owner Mode; they are not cloud account authentication.
- A stall is selected locally before Kiosk opens on the shared device.
- There are no seller accounts, join codes, remote approvals, cloud shifts, push notifications, or Supabase requests in the current build.
- Do not expose future identity controls until the cloud authorization path is complete and can be represented truthfully.

## Approved identity model

### Owners

- Owners authenticate with Google Sign-In using their Google/Gmail account.
- An authenticated owner can create and manage businesses, stalls, seller access, approvals, reports, and settings for businesses they own.
- Google proves the person's identity. KitaMo business memberships and Row Level Security determine what that identity may access.

### Sellers

- Sellers are not required to have Gmail.
- Sellers authenticate with a KitaMo username and password.
- Seller credentials must be verified by a cloud authentication service. Passwords, password hashes, service-role keys, and credential lookup tables must never be stored in the mobile app or public client-readable tables.
- Supabase's native password flow uses email or phone identifiers, not usernames. Phase C must therefore complete an authentication spike before implementation and choose one reviewed server-side approach:
  - a dedicated identity provider with username/password and Supabase third-party JWT support; or
  - a server-controlled username adapter backed by Supabase Auth, including secure recovery and abuse controls.
- Do not implement a client-generated fake-email convention, a local-only seller password database, or a public username-to-auth-user lookup.

Google Sign-In is supported for native apps by Supabase Auth. Supabase documents password authentication using email or phone identifiers, and supports selected third-party JWT issuers. Revalidate these provider capabilities and costs when Phase C starts.

References:

- [Supabase Google Sign-In](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Supabase password authentication](https://supabase.com/docs/guides/auth/passwords)
- [Supabase third-party authentication](https://supabase.com/docs/guides/auth/third-party/overview)

## Authentication is not stall access

- Authentication answers: "Who is this person?"
- Authorization answers: "Which business, stall, shift, and Kiosk functions may this person use?"
- A QR code, short code, or owner invitation identifies a stall or invitation and starts an access request. It never creates a login session and never grants stall access by itself.
- A seller must already be authenticated before submitting a request.
- Owner approval creates the seller's assignment. Until approval, the seller sees only the pending or rejected request state, not business data.
- Revoked, expired, or unassigned sellers cannot open that stall's Kiosk.

## Intended seller flow

1. Seller signs in with a KitaMo username and password.
2. Seller scans a stall QR code, enters a short code, or accepts an owner-issued invitation.
3. The server resolves the locator without returning protected stall data.
4. Seller confirms and submits an access request.
5. Owner reviews and approves or rejects the request.
6. Approval creates a stall assignment with role, permissions, and effective dates.
7. The owner assigns one or more stalls and the seller's shifts.
8. Seller sees only assigned stalls and eligible shifts.
9. Seller opens Kiosk for an assigned stall during an active shift.

An owner may also open a stall's Kiosk directly under the owner's broader authorization.

## Recommended architecture

### Trust boundaries

1. **Identity provider / Supabase Auth** issues a signed identity token.
2. **Server-side enrollment endpoints** resolve QR/codes, create access requests, approve requests, rotate codes, and create assignments. Privileged credentials stay server-side.
3. **Postgres and RLS** enforce business and stall authorization for every cloud row. UI hiding is never the security boundary.
4. **SQLite** remains the offline operational store and sync staging area after authorization has been established.
5. **SecureStore** holds only device session material and cached grant metadata appropriate for the platform, never seller passwords.

### Enrollment locators

- QR payloads should contain a versioned HTTPS/deep-link locator with a random, revocable token or public stall handle.
- Short codes should be random, rate-limited, normalized, time-bounded or owner-rotatable, and stored as hashes where practical.
- Owner-issued invitations should be single-purpose, expiring, revocable, and bound to an intended business/stall and role.
- Locator resolution returns minimal display data and a request challenge. It does not return products, sales, reports, membership lists, or reusable credentials.
- Submission must be idempotent so repeated taps cannot create duplicate access requests.

### Offline behavior

- Initial seller sign-in, access request, approval receipt, and first assignment download require connectivity.
- Later offline Kiosk use may rely on a cached, signed or server-verifiable device grant with an explicit expiry policy.
- The app must define how long a seller can continue offline after a grant was last verified. This is a security/product decision, not an implementation default.
- Revocation cannot be guaranteed instantly while a device is offline. Phase D must document the accepted revocation window, force revalidation at expiry, and preserve an audit trail.
- Offline sales remain local-first and queue for later sync only after cloud sync is enabled.

## Future data model

Authentication credentials remain in the chosen identity provider. KitaMo stores profiles and authorization records, not passwords.

| Entity | Purpose and important fields |
| --- | --- |
| `profiles` | `auth_user_id`, `account_type` (`owner` / `seller`), display name, status, optional recovery contact; no password fields. |
| `seller_login_identifiers` (identity service/private schema, if needed) | Unique normalized username mapped to the identity-provider user id and account status. Server-only lookup; never exposed through the public Data API and never contains a plaintext password. |
| `businesses` | Owner-managed tenant and existing business fields. Ownership is enforced through membership, not only a mutable owner column. |
| `business_memberships` | `business_id`, `user_id`, role, status, effective/revoked timestamps. Owners receive business-wide authority. |
| `stalls` | Cloud form of local branches, scoped to a business. |
| `stall_join_methods` | Stall QR/code configuration, token/code hash, version, expiry, rotation, status, and optional usage limits. Never stores a password. |
| `seller_access_requests` | Requester, business/stall, join method, `pending` / `approved` / `rejected` / `cancelled`, request note, decision actor/time, and idempotency key. |
| `stall_assignments` | Approved seller-to-stall relationship, role, permissions, effective dates, status, approving owner, and revocation metadata. One seller may have multiple assignments. |
| `seller_shifts` | Assignment/stall, scheduled start/end, timezone, status, and optional owner override. Supports multiple shifts and multiple stalls. |
| `device_registrations` | User/device binding, platform, last seen, trust/revocation status, and push token later. No hardware fingerprinting as identity. |
| `kiosk_access_grants` | Time-bounded grant for a user, device, stall, assignment, and shift; issued/revoked timestamps and grant version. |
| `approval_events` | Append-only request, approval, rejection, assignment, and revocation audit events. |

Recommended constraints:

- Unique normalized seller username at the private identity-service boundary; public profiles may expose only an intentionally chosen display handle.
- At most one pending request per seller and stall.
- At most one active assignment for the same seller, stall, and role.
- Assignment, shift, and grant rows always carry `business_id` and `stall_id` for RLS.
- Approval and revocation run in server-side transactions and append an audit event.
- Codes and invitations are never accepted as bearer authentication tokens.

## Authorization outline

- Owners can manage only businesses where they have an active owner membership.
- Sellers can read their own profile, requests, assignments, shifts, and permitted stall-operational rows.
- Sellers cannot list join methods, code hashes, other sellers, pending requests from other users, owner reports, or other stalls.
- Sellers may insert sales only for an active assignment/grant and must set `seller_user_id` to their authenticated identity.
- Approval, assignment, code rotation, and revocation operations are owner-only server actions with transaction and audit guarantees.
- RLS denies access by default; enrollment endpoints expose only the minimal pre-membership operations that cannot be expressed safely as direct table access.

## Phase C backlog: cloud identity and approval

### C0 - security and provider spike

- Confirm the seller username/password provider design, recovery flow, pricing, data residency, and Supabase JWT/RLS integration.
- Threat-model username enumeration, credential stuffing, QR/code sharing, replay, approval abuse, account recovery, and lost devices.
- Define password policy, CAPTCHA/abuse protection, per-IP and per-account rate limits, lockout/backoff, generic error messages, and security logging.
- Decide owner account recovery and whether owner MFA is required.

### C1 - cloud identity foundation

- Configure separate development/staging Supabase projects and Google Sign-In for owners.
- Add `profiles`, memberships, audit foundations, RLS tests, secure token storage, sign-out, and account/session lifecycle.
- Keep cloud features behind a feature flag; the current local pilot remains usable while migration is tested.

### C2 - seller credentials

- Implement the selected server-side KitaMo username/password flow.
- Add secure account creation, recovery/reset, disabled-account handling, rate limiting, and credential abuse tests.
- Do not expose service credentials or username lookup data to the app.

### C3 - join and approval

- Add QR/deep-link parsing, short-code entry, owner-issued invitations, access requests, owner approval/rejection, code rotation, and audit history.
- Make request creation and owner decisions idempotent.
- Verify that QR/code possession alone never exposes protected data or grants access.

### C4 - assignments and authorization

- Add multi-stall assignments and least-privilege Kiosk permissions.
- Implement and test RLS matrices for owner, seller, pending seller, rejected seller, revoked seller, and cross-business attacks.
- Add owner views for sellers, requests, assignments, and revocation.

## Phase D backlog: shifts and multi-device operation

### D1 - shifts and Kiosk eligibility

- Add shift scheduling, multiple shifts, cross-stall schedules, active-shift checks, owner override rules, and timezone handling.
- Show sellers only assigned stalls and eligible shifts.

### D2 - offline grants and sync

- Add device registration, time-bounded offline access grants, grant refresh/revocation rules, and the approved offline revocation window.
- Enable scoped SQLite-to-cloud sync incrementally with conflict and audit tests.
- Preserve the existing sale, inventory, COGS, production, fixed-cost, spoilage, transfer, and profit invariants.

### D3 - alerts and production hardening

- Add push notifications for approval outcomes, seller/Kiosk pings, assignment changes, and shift events only after permission and privacy review.
- Add observability, abuse monitoring, incident response, backup/restore, account deletion/export, penetration testing, and staged rollout.
- Re-run low-end-device, offline, duplicate-action, and cross-tenant security testing before wider release.

Supabase Auth enforces endpoint rate limits and supports CAPTCHA controls, but KitaMo's custom enrollment and username endpoints still need their own application-level abuse controls.

References:

- [Supabase Auth rate limits](https://supabase.com/docs/guides/auth/rate-limits)
- [Supabase CAPTCHA protection](https://supabase.com/docs/guides/auth/auth-captcha)

## Explicitly not part of the current build

- Google owner login
- KitaMo seller username/password
- QR or short-code enrollment
- Remote owner approval
- Seller/stall assignments
- Real shifts or active-shift enforcement
- Device grants and multi-device sync
- Push notifications
- Supabase runtime configuration or network requests
