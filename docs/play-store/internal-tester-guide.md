# KitaMo 1.0.0 Pilot - Internal Tester Guide

Salamat sa pag-test! Ang KitaMo ay local-first: lahat ng data ay nasa phone mo lang. Walang account, walang cloud — kaya libre kang mag-experiment.

## Installing the internal test build

1. You'll receive an **opt-in link** from the KitaMo team. Open it on your Android phone while signed in to the Google account we registered.
2. Tap **Become a tester**, then **Download it on Google Play** and install like a normal app.
3. Updates arrive automatically through the Play Store whenever we ship a new test build.

## First launch

- **Start Fresh Business** — empty app, parang totoo: you set up everything yourself. Best for the full test.
- **Try Demo Data** — one demo stall with three products, para mabilis makita ang selling flow.

You can only pick once per install; sabihan kami kung gusto mong mag-reset.

## Main test scenario (15–20 minutes)

1. **Set up** — Settings: create your business and one stall.
2. **Add a product** — Inventory: e.g. Sushi, ₱20, with bundle 8 for ₱150.
3. **Add grocery items** — Grocery Pool: e.g. Rice 10 kg ₱650, Kikkoman soy sauce 1 L ₱180.
4. **Create a recipe** — Recipes: Sushi makes 5 pcs; 100 g rice + 10 ml Kikkoman + custom Nori ₱15. Tingnan ang cost per piece.
5. **Produce** — Production: make 10 sushi for your stall. Check that grocery stock bumaba and product stock tumaas.
6. **Sell** — Home → Start Selling: sell 8 sushi (dapat ₱150 ang total, hindi ₱160). Try GCash — kailangan ng reference number.
7. **Receipt** — copy or share the receipt text.
8. **Records** — check the sale, the Niluto entry, and stock movements.
9. **Fixed cost** — Fixed Costs: add "Stall rent, ₱3,000, monthly". Mark paid.
10. **Reports** — Profit Reports: tingnan kung tama ang revenue, puhunan, fixed costs, at net profit sa tingin mo.

Bonus tests kung may time: spoil 1 piece (Nasayang), transfer goods to a second stall, set a recipe to "Cook upon order" and sell it at zero stock.

## Bug report format

Please send one message per bug:

```
Phone model: (e.g. Samsung A14)
Android version: (Settings → About phone)
Screen: (e.g. Kiosk Checkout)
What I tapped: 1) … 2) … 3) …
Expected: …
Actual: …
Screenshot: (attach)
```

## Known limitations (hindi bugs)

- Walang cloud backup — kapag na-uninstall, mawawala ang data.
- Walang login/accounts.
- Ang Helper tab ay sumasagot mula sa records ng phone mo lang — walang AI.
- Walang camera scanning, walang Bluetooth printing.
- Hindi ito official receipt / BIR compliance tool.
- Hindi nagpo-process ng bayad ang app — reference numbers lang ang naitatala.

Maraming salamat! Ang feedback mo ang magpapabuti sa KitaMo.
