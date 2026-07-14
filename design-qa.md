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

## Stage 4: Inventory and Product Management

Reference sources:

- `KitaMo Redesign.dc.html`, Tindahan and Paninda sections from the approved Turn 4 package
- `KitaMo Prototype.dc.html` from the approved Turn 4 package
- `handoff/kitamo-tokens.json` version 3.1.0
- `handoff/codex-migration-notes.md`, Grocery-to-Production terminology and protected-engine notes

Test target:

- Android API 35 16 KB emulator
- 360 x 800 logical viewport
- Araw and Gabi themes
- 100% and 130% system font scales

Compared states:

- Tindahan tabs and Paninda overview
- active Owner business and stall context
- stock summaries, search, filters, product rows, and bundle status
- product action sheet, edit form, manual cooked-stock form, and spoilage form
- Kiosk Stock after explicit stall selection and confirmation
- local network and pending-save status

Verified:

- Paninda, Grocery, and Recipes remain distinct destinations within Tindahan
- the active business and stall are visible before Owner stock actions
- product quantities, thresholds, costs, prices, bundle labels, and Kiosk Stock all read the existing local contracts
- no capacity meter or product photography is shown without a real source field
- product actions remain reachable above the Owner dock and Android gesture area in a modal bottom sheet
- manual cooked stock is explicitly labeled as no-recipe stock-in and points recipe-based work to Niluto
- spoilage remains an explicit destructive stock-out flow with the existing validation and service
- edit, manual stock-in, and spoilage forms open without an automatic mutation; QA did not save test changes
- Kiosk Stock is reachable only inside a confirmed stall-specific Kiosk session
- Araw and Gabi contrast, card hierarchy, controls, and financial values remain readable at 360 x 800
- 130% text preserves tab labels, summaries, product names, price/cost values, action labels, and touch targets
- scrolled content is masked behind the transparent Android status bar to prevent text/icon overlap
- normal Inventory scrolling and action-sheet interaction produced no React Native, Expo, or Android runtime errors in focused logcat

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
- Expo Doctor: 18/18 checks passed
- production Android export with Expo; Hermes bundle 3.99 MB

Approved implementation constraints retained:

- no product photography because the local product contract has no image source
- no capacity meter because the local product contract has no capacity field
- no schema, migration, repository, stock-service, or protected business-engine changes
- no seller accounts, remote alerts, cloud sync, or other non-pilot capability

Design deviations:

- source photography and capacity meters are omitted because the required data is unavailable
- exact product actions use a bottom sheet instead of expanding inline so every control remains reachable on 360 x 800 and at 130% text
- Kiosk low-stock pings remain local SQLite Owner alerts on the same device

Remaining visual issues: none at P0, P1, or P2.

final result: passed
