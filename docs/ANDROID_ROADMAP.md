# KitaMo Android Roadmap

## Phase 0: Scope Approval

Status: Done / Approved.

The Android app is a local-first MVP, not a full clone of the PWA.

## Phase 1: Project Foundation

Status: Done.

Goals:

- Expo React Native TypeScript foundation.
- Expo Router structure.
- Placeholder Owner and Kiosk screens.
- SQLite, Zustand, Zod, and native Expo module dependencies.
- Theme tokens ready for light, dark, and system modes.
- No real business logic yet.

## Phase 2: Local Data Foundation

Status: In progress.

- SQLite migrations.
- Local IDs and timestamps.
- Fresh mode empty by default.
- Demo seed data by explicit action only.
- Clear Local Pilot Data.
- Typed local repositories.

## Phase 3: Owner Setup

- Business Profile.
- Stalls.
- Products.
- Pilot App Status.

## Phase 4: Kiosk Selling

- Kiosk session.
- Sell/cart.
- Checkout.
- Receipt.
- GCash/Maya/bank references.

## Phase 5: Offline Proof

- Offline indicator.
- Pending queue.
- Force-close/reopen survival.

## Deferred

- Supabase sync.
- Login/auth.
- Lis API.
- Camera/OCR.
- Voice.
- Bluetooth printing.
- Customer Mode.
- LGU Mode.
- Play Store production.

## Chapter 3: Future Phase C/D Identity and Multi-Device Access

Status: Approved architecture direction only. Not implemented in the current local pilot.

### Phase C: Identity, enrollment, and approval

- Owners authenticate with Google and manage their businesses and staff access.
- Sellers authenticate with a KitaMo username/password; Gmail is not required.
- QR codes, short codes, and owner invitations initiate access requests but never authenticate or grant access by themselves.
- Owner approval creates one or more stall assignments protected by RLS and audit history.

### Phase D: Shifts, offline grants, and multi-device operation

- Multiple stalls and shifts per seller.
- Active-shift Kiosk eligibility and least-privilege seller views.
- Time-bounded offline device grants, scoped cloud sync, revocation handling, and later push notifications.

See [Chapter 3 Identity and Access Plan](roadmap/chapter-3-identity-access-plan.md) for the recommended architecture, data model, security boundaries, and detailed backlog.
