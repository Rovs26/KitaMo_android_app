/**
 * Manual verification helper for production planning math.
 * Run with: npm run check:production
 */
const { calculateBatchMultiplier, planProduction } = require("../node_modules/.cache/kitamo-production-check/productionMath.js");

let failures = 0;

function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${name}: got ${JSON.stringify(actual)} expected ${JSON.stringify(expected)} ${ok ? "OK" : "FAIL"}`);
}

// 1. Recipe output 5, produce 10 -> multiplier 2; fractional 12 -> 2.4
check("multiplier 10/5", calculateBatchMultiplier(5, 10), 2);
check("multiplier 12/5 (fractional)", calculateBatchMultiplier(5, 12), 2.4);
check("multiplier invalid output", calculateBatchMultiplier(0, 10), null);

const sushiLines = [
  { label: "Rice (Japanese)", isCustom: false, quantity: 100, unit: "g", lotId: "lot-rice", lotUnit: "kg", lotCostPerUnit: 65, lotRemainingQuantity: 10 },
  { label: "Soy sauce (Kikkoman)", isCustom: false, quantity: 10, unit: "ml", lotId: "lot-kikkoman", lotUnit: "L", lotCostPerUnit: 180, lotRemainingQuantity: 1 },
  { label: "Nori (custom)", isCustom: true, quantity: 0, unit: "pcs", costOverride: 15 },
];

// 2 & 3. produce 10 (output 5 per batch) -> 200g rice = 0.2kg, 20ml soy = 0.02L
const plan = planProduction(sushiLines, 5, 10);
check("plan ok", plan.ok, true);
const riceDeduction = plan.deductions.find((d) => d.lotId === "lot-rice");
const soyDeduction = plan.deductions.find((d) => d.lotId === "lot-kikkoman");
check("rice deduction 0.2 kg", Number(riceDeduction.quantity.toFixed(6)), 0.2);
check("soy deduction 0.02 L", Number(soyDeduction.quantity.toFixed(6)), 0.02);

// 4. cost scales: (P6.50 + P1.80 + P15) * 2 = P46.60 total, P4.66 per piece
check("total cost scales", Number(plan.totalCost.toFixed(2)), 46.6);
check("cost per output unit", Number(plan.costPerOutputUnit.toFixed(3)), 4.66);

// 5. insufficient selected lot blocks: soy lot only has 0.01L but 0.02L needed
const shortLines = [
  { label: "Soy sauce (Kikkoman)", isCustom: false, quantity: 10, unit: "ml", lotId: "lot-k", lotUnit: "L", lotCostPerUnit: 180, lotRemainingQuantity: 0.01 },
];
const shortPlan = planProduction(shortLines, 5, 10);
check("shortfall blocks plan", shortPlan.ok, false);
check("shortfall needed 0.02", Number(shortPlan.shortfalls[0].neededQuantity.toFixed(6)), 0.02);
check("shortfall available 0.01", Number(shortPlan.shortfalls[0].availableQuantity.toFixed(6)), 0.01);

// exact-remaining production is allowed (no epsilon false-block)
const exactPlan = planProduction(
  [{ label: "Soy", isCustom: false, quantity: 10, unit: "ml", lotId: "l", lotUnit: "ml", lotCostPerUnit: 0.18, lotRemainingQuantity: 20 }],
  5,
  10,
);
check("exact remaining allowed", exactPlan.ok, true);

// 6. custom line included in cost but produces no deduction
check("custom in lines", plan.lines.some((l) => l.isCustom), true);
check("custom not in deductions", plan.deductions.length, 2);

// same-lot aggregation: two lines from one lot combine before the check
const sharedShort = planProduction(
  [
    { label: "Soy A", isCustom: false, quantity: 10, unit: "ml", lotId: "shared", lotUnit: "ml", lotCostPerUnit: 0.18, lotRemainingQuantity: 25 },
    { label: "Soy B", isCustom: false, quantity: 5, unit: "ml", lotId: "shared", lotUnit: "ml", lotCostPerUnit: 0.18, lotRemainingQuantity: 25 },
  ],
  1,
  2,
);
check("shared lot combined shortfall (need 30, have 25)", sharedShort.ok, false);

// incompatible units block the plan
const badPlan = planProduction(
  [{ label: "Rice in ml", isCustom: false, quantity: 100, unit: "ml", lotId: "r", lotUnit: "kg", lotCostPerUnit: 65, lotRemainingQuantity: 10 }],
  5,
  10,
);
check("incompatible units block", badPlan.ok, false);
check("incompatible label reported", badPlan.incompatibleLabels[0], "Rice in ml");

if (failures === 0) {
  console.log("ALL PRODUCTION MATH CHECKS PASSED");
  process.exit(0);
}

console.error(`${failures} PRODUCTION MATH CHECKS FAILED`);
process.exit(1);
