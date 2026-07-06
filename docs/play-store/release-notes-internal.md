# Internal Testing Release Notes — KitaMo (Pilot) 0.1.0 (versionCode 1)

## What this is

First internal-testing build of KitaMo — a **local-first** selling and profit tracker for Filipino small sellers. All data stays on the tester's device: no account, no cloud, no ads, no analytics.

## What's included

- Fresh vs Demo first launch; owner/business/stall setup
- Inventory with low-stock alerts and Notify Owner
- Kiosk selling: cash/GCash/Maya/bank references, bundle pricing (e.g. 8 for ₱150), discounts, text receipts (copy/share), orders, shift summary
- Grocery Pool: purchases per brand/source with cost per unit and low-stock badges
- Recipes: selected-lot costing, custom cost lines, cost per piece, makeable quantity, bottleneck ingredient
- Production per stall with automatic ingredient deduction and batch costing
- Cook-upon-order items: costed at sale time, never blocked by missing stock (estimated cost is flagged)
- Transfers between stalls, spoilage with loss value
- Fixed costs (rent, sweldo, bills) with due/overdue tracking and mark-paid
- Profit Reports: per-stall and consolidated (revenue, puhunan, fixed costs, sayang, net profit) across today/week/month/all
- Local Helper (answers from on-device records only), Records, Insights, in-app Pilot Guide

## What testers should focus on

1. Real-phone usability: safe areas, bottom navigation, keyboard behavior, long forms.
2. Money math: do receipt totals, bundle prices, COGS, and report numbers match your expectations?
3. The full flow: groceries → recipe → production → sale → reports.
4. Anything confusing in the Taglish copy.

## Known limitations (by design in this pilot)

No cloud backup/sync (uninstall = data loss), no login, no AI (Helper is local-only), no camera/OCR, no Bluetooth printing, no BIR/official-receipt compliance, no payment processing.

## Reporting issues

Use the format in `internal-tester-guide.md`: phone model, Android version, screen, steps, expected vs actual, screenshot.
