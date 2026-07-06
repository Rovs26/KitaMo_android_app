/**
 * End-to-end pilot scenario check (pure math only).
 * Run with: npm run check:pilot
 *
 * Story: buy groceries -> cost a sushi recipe from selected lots -> produce a
 * batch -> sell with bundle pricing -> recognize COGS -> subtract a fixed cost
 * -> land on the exact net profit. Chains every pure domain module the app's
 * services use, so a break anywhere in the money math fails loudly here.
 */
const cache = "../node_modules/.cache/kitamo-pilot-check";
const { calculateLineTotal, calculateCartSubtotal } = require(`${cache}/pricing.js`);
const { calculateLineCost, calculateMakeableQuantity } = require(`${cache}/recipeCosting.js`);
const { planProduction } = require(`${cache}/productionMath.js`);
const { planOrderCogs } = require(`${cache}/orderCogs.js`);
const { listOccurrences } = require(`${cache}/fixedCostSchedule.js`);
const { grossProfit, netProfit } = require(`${cache}/profitMath.js`);

let failures = 0;

function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${name}: got ${JSON.stringify(actual)} expected ${JSON.stringify(expected)} ${ok ? "OK" : "FAIL"}`);
}

function round(value, digits = 2) {
  return Number(value.toFixed(digits));
}

// 1. Groceries: rice 10kg for P650 -> P65/kg; Kikkoman 1L for P180 -> P180/L
const riceCostPerUnit = 650 / 10;
const soyCostPerUnit = 180 / 1;
check("grocery: rice cost/unit", riceCostPerUnit, 65);

// 2. Recipe "Sushi" (makes 5): 100g rice + 10ml Kikkoman + P15 custom nori
const recipeLines = [
  { label: "Rice", isCustom: false, quantity: 100, unit: "g", lotId: "rice", lotUnit: "kg", lotCostPerUnit: riceCostPerUnit, lotRemainingQuantity: 10 },
  { label: "Kikkoman", isCustom: false, quantity: 10, unit: "ml", lotId: "soy", lotUnit: "L", lotCostPerUnit: soyCostPerUnit, lotRemainingQuantity: 1 },
  { label: "Nori", isCustom: true, quantity: 0, unit: "pcs", costOverride: 15 },
];
const riceLine = calculateLineCost(recipeLines[0]);
const soyLine = calculateLineCost(recipeLines[1]);
check("recipe: rice line P6.50", round(riceLine.lineCost), 6.5);
check("recipe: soy line P1.80", round(soyLine.lineCost), 1.8);
const batchCost = riceLine.lineCost + soyLine.lineCost + 15; // 23.3 per 5 pcs
check("recipe: batch cost P23.30", round(batchCost), 23.3);

const makeable = calculateMakeableQuantity(recipeLines, 5);
check("recipe: makeable is stock-limited", makeable.stockLimited, true);

// 3. Produce 10 sushi (2 batches) for Stall A
const production = planProduction(recipeLines, 5, 10);
check("production: plan ok", production.ok, true);
check("production: total cost P46.60", round(production.totalCost), 46.6);
const avgProducedCost = production.totalCost / 10; // P4.66 per piece
check("production: cost per piece P4.66", round(avgProducedCost, 3), 4.66);

// 4. Sell all 10 with bundle 8-for-P150 at P20 each -> revenue 150 + 40 = 190
const cart = [{ quantity: 10, unitPrice: 20, bundleQuantity: 8, bundlePrice: 150 }];
const revenue = calculateCartSubtotal(cart);
check("sale: bundle revenue P190", revenue, 190);
check("sale: line uses bundle", calculateLineTotal(cart[0]).bundleApplied, true);

// 5. Sold COGS: prepared-before-selling uses average produced cost
const soldCogs = avgProducedCost * 10;
check("cogs: sold COGS P46.60", round(soldCogs), 46.6);

// 6. A cook-upon-order day: same recipe sold 5 direct, soy drained to 0.005L
const orderPlan = planOrderCogs(
  recipeLines.map((line) => ({ ...line, lineCostSnapshot: line.isCustom ? 15 : calculateLineCost(line).lineCost })),
  5,
  5,
  new Map([["rice", 10], ["soy", 0.005]]),
);
check("order: cogs equals batch cost", round(orderPlan.cogsTotal), 23.3);
check("order: partially estimated", orderPlan.isEstimated, true);

// 7. Fixed cost: P50 daily stall fee, 7 days in range -> P350
const stallFeeDays = listOccurrences("2026-07-01", "daily", null, "2026-07-01", "2026-07-07").length;
check("fixed: 7 daily occurrences", stallFeeDays, 7);
const fixedCosts = stallFeeDays * 50;

// 8. Profit: revenue 190, sold COGS 46.6, fixed 350, spoilage 4.66 (1 piece)
check("profit: gross P143.40", round(grossProfit(revenue, soldCogs)), 143.4);
const net = netProfit({ revenue, soldCogs, fixedCosts, spoilageLoss: avgProducedCost });
check("profit: net (a loss week) P-211.26", round(net), -211.26);

if (failures === 0) {
  console.log("ALL PILOT SCENARIO CHECKS PASSED");
  process.exit(0);
}

console.error(`${failures} PILOT SCENARIO CHECKS FAILED`);
process.exit(1);
