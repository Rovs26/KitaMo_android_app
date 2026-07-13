# Gabi Redesign Design QA

## Stage 3: Kiosk Selling, Checkout, Receipt, and Orders

Reference sources:

- `KitaMo Redesign.dc.html` from the approved Turn 4 package
- `KitaMo Prototype.dc.html` from the approved Turn 4 package
- `handoff/kitamo-tokens.json` version 3.1.0
- `handoff/codex-migration-notes.md`, sections 9-11 and 15

Test target:

- Android API 35 16 KB emulator
- 360 x 800 logical viewport
- Araw and Gabi themes
- 100% and 130% system font scales

Compared states:

- explicit stall picker and confirmation
- Sell with categories, favorites, recents, product states, and inline quantity controls
- floating cart and Kiosk dock
- Checkout with discount, cash, GCash reference validation, tender, and change states
- completed receipt and reopened receipt from Orders
- Stock and pending local-save count after checkout
- force-close and theme-preference recovery

Verified:

- every operational route shows the confirmed business and stall context
- BENTA still crosses the explicit stall-selection and confirmation boundary
- invalid or expired Kiosk context explains the reset before returning to the picker
- category, favorites, recent-product, stock, bundle, and cart behavior remain wired to the existing services and store
- rapid repeated confirmation taps created one sale, one receipt, and one stock decrement
- Coke Mismo changed from 12 to 11 bottles exactly once; pending local saves changed from 0 to 1
- non-cash checkout remains disabled until a reference number is supplied
- cash tender and change are display-only and do not alter the sale contract
- receipt success remounts at the top instead of inheriting Checkout scroll position
- Orders reloads the persisted sale and receipt from SQLite after navigation and process restart
- Gabi preference persisted after force-close; the resolved Kiosk theme remained stable for the session
- product titles, cards, controls, dock, and notices remain readable at 130% text scale
- normal tap-based Kiosk navigation produced no JavaScript, Android runtime, SQLite, or font-loading errors in focused logcat

Automated gates:

- `npm run typecheck`
- `npm run lint`
- `npm run check:owner-context`
- `npm run check:pricing`
- `npm run check:recipes`
- `npm run check:production`
- `npm run check:cogs`
- `npm run check:fixedcosts`
- `npm run check:pilot`
- `npm run check:migrations`
- production Android export with Expo

Approved implementation constraints retained:

- no product photography because no real source asset is stored
- receipt sharing remains light, readable text
- no seller accounts, QR joining, remote approvals, scheduled shifts, push notifications, or cloud sync
- no schema, migration, repository, or protected business-engine changes
- bundle pricing, checkout idempotency, inventory, COGS, and reporting formulas remain authoritative

Non-blocking environment observation:

- Repeated external Expo Go deep-link relaunches produced the previously observed Fabric `MissingViewState` development overlay once. It did not reproduce during ordinary in-app navigation, caused no persisted-data damage, and is not present in the production Android export.

Design deviations:

- product photography is omitted because the local product contract has no image source
- optional cash tender/change remains presentation-only and is not persisted
- shared receipts remain text-based and light by design

Remaining visual issues: none at P0, P1, or P2.

final result: passed
