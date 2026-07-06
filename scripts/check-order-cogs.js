/**
 * Manual verification helper for cook-upon-order COGS math.
 * Run with: npm run check:cogs
 */
const { planOrderCogs } = require("../node_modules/.cache/kitamo-cogs-check/orderCogs.js");

let failures = 0;

function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${name}: got ${JSON.stringify(actual)} expected ${JSON.stringify(expected)} ${ok ? "OK" : "FAIL"}`);
}

function round(value, digits = 4) {
  return Number(value.toFixed(digits));
}

// Recipe: 5 takoyaki per batch; flour 100g from P65/kg lot; sauce 10ml from P180/L lot; custom P15
const lines = [
  { label: "Flour", isCustom: false, quantity: 100, unit: "g", lotId: "lot-flour", ingredientId: "ing-f", lotUnit: "kg", lotCostPerUnit: 65, lotRemainingQuantity: 10, lineCostSnapshot: 6.5 },
  { label: "Sauce (Kikkoman)", isCustom: false, quantity: 10, unit: "ml", lotId: "lot-sauce", ingredientId: "ing-s", lotUnit: "L", lotCostPerUnit: 180, lotRemainingQuantity: 1, lineCostSnapshot: 1.8 },
  { label: "Toppings", isCustom: true, quantity: 0, unit: "pcs", costOverride: 15, lineCostSnapshot: 15 },
];

// 1. Full stock: sell 10 (2 batches) -> all actual, no shortfall
{
  const remaining = new Map([["lot-flour", 10], ["lot-sauce", 1]]);
  const plan = planOrderCogs(lines, 5, 10, remaining);
  check("full stock: cogs total", round(plan.cogsTotal, 2), 46.6);
  check("full stock: not estimated", plan.isEstimated, false);
  check("full stock: flour deducted 0.2kg", round(remaining.get("lot-flour"), 6), 9.8);
  check("full stock: sauce deducted 0.02L", round(remaining.get("lot-sauce"), 6), 0.98);
  check("full stock: no shortfalls", plan.usages.every((u) => u.shortfallQuantity === 0), true);
}

// 2. Partial stock: sauce lot has only 0.01L, need 0.02L -> split actual/estimated, sale not blocked
{
  const remaining = new Map([["lot-flour", 10], ["lot-sauce", 0.01]]);
  const plan = planOrderCogs(lines, 5, 10, remaining);
  check("partial: cogs total unchanged", round(plan.cogsTotal, 2), 46.6);
  check("partial: estimated flag", plan.isEstimated, true);
  const sauce = plan.usages.find((u) => u.lotId === "lot-sauce");
  check("partial: sauce used 0.01", round(sauce.quantityUsed, 6), 0.01);
  check("partial: sauce shortfall 0.01", round(sauce.shortfallQuantity, 6), 0.01);
  check("partial: sauce lot drained to 0", round(remaining.get("lot-sauce"), 6), 0);
  check("partial: actual+estimated = total", round(plan.actualCost + plan.estimatedCost, 2), round(plan.cogsTotal, 2));
  const sauceDeduction = plan.deductions.find((d) => d.lotId === "lot-sauce");
  check("partial: deduction only what exists", round(sauceDeduction.quantity, 6), 0.01);
}

// 3. Missing lot entirely: estimate from recipe snapshot, never block
{
  const missingLotLines = [
    { label: "Sauce (gone)", isCustom: false, quantity: 10, unit: "ml", lotId: null, ingredientId: "ing-s", lotUnit: null, lotCostPerUnit: null, lotRemainingQuantity: null, lineCostSnapshot: 1.8 },
  ];
  const plan = planOrderCogs(missingLotLines, 5, 10, new Map());
  check("missing lot: estimated from snapshot", round(plan.cogsTotal, 2), 3.6);
  check("missing lot: flagged estimated", plan.isEstimated, true);
  check("missing lot: no deductions", plan.deductions.length, 0);
}

// 4. Custom line scales and never deducts
{
  const plan = planOrderCogs([lines[2]], 5, 15, new Map());
  check("custom scales 3x", round(plan.cogsTotal, 2), 45);
  check("custom not estimated", plan.isEstimated, false);
  check("custom no deductions", plan.deductions.length, 0);
}

// 5. Shared lot across two checkout items: second item sees drained stock
{
  const remaining = new Map([["lot-sauce", 0.03]]);
  const sauceOnly = [lines[1]];
  const first = planOrderCogs(sauceOnly, 5, 10, remaining); // needs 0.02, leaves 0.01
  const second = planOrderCogs(sauceOnly, 5, 10, remaining); // needs 0.02, only 0.01 left
  check("shared: first all actual", first.isEstimated, false);
  check("shared: second partially estimated", second.isEstimated, true);
  check("shared: lot never negative", round(remaining.get("lot-sauce"), 6), 0);
}

// 6. Gross profit sanity: revenue 100, cogs 46.6 -> 53.4
{
  const remaining = new Map([["lot-flour", 10], ["lot-sauce", 1]]);
  const plan = planOrderCogs(lines, 5, 10, remaining);
  check("gross profit", round(100 - plan.cogsTotal, 2), 53.4);
}

if (failures === 0) {
  console.log("ALL ORDER COGS CHECKS PASSED");
  process.exit(0);
}

console.error(`${failures} ORDER COGS CHECKS FAILED`);
process.exit(1);
