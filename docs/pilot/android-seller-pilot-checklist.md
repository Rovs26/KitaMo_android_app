# KitaMo Android — Seller Pilot Checklist

For friendly testers running the local-first pilot on a real Android phone. All data stays on the tester's device; nothing is uploaded anywhere.

## Tester setup

1. Install Expo Go from the Play Store (pilot runs through Expo Go; no store listing yet).
2. On the dev machine: `npm install`, then `npm run start -- --lan --port 8081` (phone and computer on the same Wi-Fi).
3. Scan the QR code with Expo Go.
4. On first launch choose **Start Fresh Business** (real test) or **Try Demo Data** (pre-made stall with three products).
5. The in-app **Pilot Guide** (Settings → Pilot Guide) has the same walkthrough as below.

## Scenario checklist

Work top to bottom; each scenario lists the expected result. Tick ✅/❌ and note anything odd.

### A. Setup
- [ ] Open Settings → Business & Stalls, then create a business profile → summary card shows the business.
- [ ] Add a stall → it stays saved but Kiosk remains unavailable until you deliberately select it.
- [ ] Add a second business and stall → the Business & Stall Context screen switches between businesses without mixing their stalls.
- [ ] Select a stall with "Use as active" → the compact Owner context strip updates.
- [ ] Switch away and back → each business restores only its last valid active stall.
- [ ] Deactivate the selected stall → context becomes empty; no other stall is silently selected or reactivated.

### B. Grocery Pool
- [ ] Add "Rice, Japanese brand, 10, kg, 650" → list shows the lot; cost per unit reads ₱65 per kg.
- [ ] Add two soy sauces: "Kikkoman, 1, L, 180" and "Local, 1, L, 45" → one Soy sauce ingredient, two lots with different prices.
- [ ] Type `1,500` in Total cost → friendly "Numbers only… Walang comma." error, nothing saved.
- [ ] Search "Kikkoman" and "market/grocery" → matching lots appear.
- [ ] Set a low-stock alert at or above remaining → Low stock badge appears.

### C. Recipes
- [ ] Create "Sushi" for a product, output 5 pcs: Rice 100 g (line ₱6.50), Kikkoman 10 ml (line ₱1.80), custom "Nori" ₱15.
- [ ] Batch cost ₱23.30; per-piece ₱4.66; makeable quantity and bottleneck shown.
- [ ] Try a line in `ml` against a `kg` lot → friendly unit error, no wrong math.

### D. Production
- [ ] Produce 10 sushi at a stall → preview shows 200 g rice + 20 ml soy + doubled cost.
- [ ] After saving: Grocery Pool lots decreased by exactly those amounts; product stock +10; Records shows the Niluto card.
- [ ] Try producing more than makeable → blocked with "Not enough … Need X, available Y."
- [ ] Cook-upon-order recipes do NOT appear in Production (they cost automatically at sale).

### E. Kiosk selling
- [ ] Enter Kiosk without a stall-card shortcut → no stall is preselected.
- [ ] From Owner Home, choose a stall → confirm `Open Selected Kiosk` → Sell opens for that stall and its Kiosk context strip stays visible.
- [ ] Close/reopen the app while Kiosk was open → operational Kiosk routes require stall confirmation again.
- [ ] Sell 8 of a bundle product (8-for-₱150) → cart and receipt show ₱150, not ₱160.
- [ ] GCash without a reference → blocked; with reference → receipt shows it.
- [ ] Double-tap Confirm Checkout fast → exactly one sale.
- [ ] Product stock decreased by the sold quantity; Pending saves count increased.

### F. Cook-upon-order
- [ ] Set a recipe to Cook upon order → Sell shows "Made to order" and sells at zero stock.
- [ ] Sale deducts grocery lots (check Grocery Pool after).
- [ ] Drain a lot below one order's needs, sell again → sale still completes; Insights shows "Estimated cost used"; lots never go negative.

### G. Transfers & Spoilage
- [ ] Transfer finished goods to the other stall → source −, destination + (a same-named product may be created there), value shown.
- [ ] Nasayang 1 piece → stock −1; Insights "Sayang today" shows the loss value.
- [ ] Try spoiling more than stock → friendly block.

### H. Fixed Costs & Reports
- [ ] Add "Stall rent, ₱3,000, monthly" with a past due date → Overdue badge; Home shows the Bayarin notice.
- [ ] Mark paid → status clears; mark paid again → next month's occurrence, never a duplicate.
- [ ] Profit Reports Today/Week/Month/All all open; consolidated shows Revenue − Sold COGS − Fixed costs − Sayang = Net profit.
- [ ] Unsold goods and grocery value shown as "hindi pa nagagastos" (not expenses); transfers labeled as not sales.

### I. Shell & general
- [ ] Nothing hides under the status bar or behind the bottom tabs; save buttons reachable on long forms.
- [ ] On a 360×800 screen and large font setting, the context strip stays compact, readable, and tappable without covering tab labels.
- [ ] Notifications and Settings are visible in the Home header; stalls and their Open Kiosk actions are easy to find.
- [ ] Notifications show only the selected business and filter correctly between All stalls, Business-wide, and the active stall.
- [ ] Local Helper answers simple questions and clearly says walang AI.
- [ ] Close and reopen the app → all data still there.

## Feedback questions

1. Ano ang pinaka-nalilito ka? (What confused you most?)
2. May hinanap ka bang hindi mo nahanap? (Anything you looked for and couldn't find?)
3. Tama ba ang mga numero (benta, puhunan, tubo) sa tingin mo? (Do the numbers look right?)
4. Anong feature ang pinaka-kailangan mo na wala pa? (What missing feature do you need most?)
5. Gagamitin mo ba ito sa totoong tindahan mo? Bakit o bakit hindi? (Would you use this for real? Why/why not?)

## Bug reporting format

```
Screen: (e.g. Kiosk Checkout)
Steps: 1) … 2) … 3) …
Expected: …
Actual: …
Screenshot: (attach if possible)
Phone model + Android version: …
```

Send reports to the KitaMo team with the screenshot. Salamat sa pag-test!
