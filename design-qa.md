# Gabi Redesign Design QA

## Stage 2: Owner Shell and Command Center

Reference sources:

- `KitaMo Redesign.dc.html` from the approved Turn 4 package
- `KitaMo Prototype.dc.html` from the approved Turn 4 package
- `handoff/kitamo-tokens.json` version 3.1.0
- `handoff/codex-migration-notes.md`

Test target:

- Android API 35 emulator
- 360 x 800 logical viewport
- Araw and Gabi themes
- 100% and 130% system font scales

Compared states:

- Owner Home in Araw and Gabi
- business and stall switcher with two saved businesses and two stalls
- local Notification Center empty state
- Settings and About KitaMo
- Kiosk picker with no stall selected
- Kiosk picker with an explicitly preselected stall awaiting confirmation
- force-close recovery into a deep Owner route

Verified:

- Gabi 3.1 color, type, spacing, radius, shadow, and gradient primitives are used.
- Owner Home prioritizes Notifications and Settings, net profit, and stall cards.
- The compact context strip remains readable at 360 x 800 and 130% font scale.
- Bottom navigation exposes Home, Tindahan, BENTA, Kita, and Ako.
- BENTA always opens the explicit stall picker and never reuses a stale Kiosk session.
- Switching businesses leaves stall selection empty until the owner deliberately chooses one.
- Inactive or missing context is shown honestly and is never silently repaired.
- Notifications remain local SQLite alerts with no push or cloud claims.
- Araw/Gabi controls, disabled states, notices, and empty states remain legible.
- Normal tap-based Owner navigation has no JavaScript, Android runtime, font-loading, or Fabric errors in focused logcat.

Approved implementation constraints retained:

- no product photography without source data
- no seller accounts, QR joining, remote approvals, scheduled shifts, push notifications, or cloud sync
- same-device, stall-specific Kiosk model
- no schema, migration, repository, or protected business-engine changes

Non-blocking environment observation:

- Rapid external deep-link relaunches produced one Expo Go Fabric soft warning. The warning did not reproduce through normal in-app navigation and caused no red screen or user-visible failure.

Remaining visual issues: none at P0, P1, or P2.

final result: passed
