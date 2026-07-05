/**
 * Manual verification helper for recipe costing.
 * Run with: npm run check:recipes
 * Compiles src/domain/recipeCosting.ts to a cache folder, then checks
 * selected-lot costing, unit conversion, custom lines, cost per piece,
 * makeable quantity/bottleneck, and incompatible-unit rejection.
 */
const {
  calculateLineCost,
  calculateRecipeCost,
  calculateMakeableQuantity,
  convertRecipeQuantity,
} = require("../node_modules/.cache/kitamo-recipe-check/recipeCosting.js");

let failures = 0;

function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${name}: got ${JSON.stringify(actual)} expected ${JSON.stringify(expected)} ${ok ? "OK" : "FAIL"}`);
}

// 1. 10kg rice at P650 (P65/kg), recipe uses 100g -> P6.50
const rice = { label: "Rice (Japanese)", isCustom: false, quantity: 100, unit: "g", lotId: "lot-rice", lotUnit: "kg", lotCostPerUnit: 65, lotRemainingQuantity: 10 };
const riceCost = calculateLineCost(rice);
check("rice 100g from P65/kg lot", riceCost.ok ? Number(riceCost.lineCost.toFixed(2)) : riceCost, 6.5);

// 2. 1L soy sauce at P180, recipe uses 10ml -> P1.80
const kikkoman = { label: "Soy sauce (Kikkoman)", isCustom: false, quantity: 10, unit: "ml", lotId: "lot-kikkoman", lotUnit: "L", lotCostPerUnit: 180, lotRemainingQuantity: 0.03 };
const soyCost = calculateLineCost(kikkoman);
check("soy 10ml from P180/L lot", soyCost.ok ? Number(soyCost.lineCost.toFixed(2)) : soyCost, 1.8);

// Selected-lot rule: the cheap local lot must not affect a Kikkoman line
const localSoy = { label: "Soy sauce (local)", isCustom: false, quantity: 10, unit: "ml", lotId: "lot-local", lotUnit: "L", lotCostPerUnit: 45, lotRemainingQuantity: 1 };
const localCost = calculateLineCost(localSoy);
check("local soy 10ml stays P0.45 (no averaging)", localCost.ok ? Number(localCost.lineCost.toFixed(2)) : localCost, 0.45);

// 3. custom line P15 adds exactly P15
const customLine = { label: "Nori (custom)", isCustom: true, quantity: 0, unit: "pcs", costOverride: 15 };
const customCost = calculateLineCost(customLine);
check("custom P15 line", customCost.ok ? customCost.lineCost : customCost, 15);

// 4. batch cost P25 with output 5 -> P5 per piece
const recipe = calculateRecipeCost(
  [
    { label: "A", isCustom: true, quantity: 0, unit: "pcs", costOverride: 10 },
    { label: "B", isCustom: true, quantity: 0, unit: "pcs", costOverride: 15 },
  ],
  5,
);
check("batch cost 25", recipe.batchCost, 25);
check("cost per piece 5", recipe.costPerOutputUnit, 5);

// 5. bottleneck: rice allows 10 batches, soy allows 3 -> 3 batches = 15 sushi, soy is bottleneck
const makeable = calculateMakeableQuantity(
  [
    { label: "Rice", isCustom: false, quantity: 100, unit: "g", lotId: "lot-rice", lotUnit: "g", lotCostPerUnit: 0.065, lotRemainingQuantity: 1000 },
    { label: "Soy sauce (Kikkoman)", isCustom: false, quantity: 10, unit: "ml", lotId: "lot-k", lotUnit: "ml", lotCostPerUnit: 0.18, lotRemainingQuantity: 30 },
    { label: "Secret sauce", isCustom: true, quantity: 0, unit: "pcs", costOverride: 5 },
  ],
  5,
);
check("makeable batches", makeable.batches, 3);
check("makeable units", makeable.units, 15);
check("bottleneck", makeable.bottleneckLabel, "Soy sauce (Kikkoman)");
check("custom lines flagged", makeable.hasCustomLines, true);

// Same-lot aggregation: two lines from one lot share its remaining stock
const sharedLot = calculateMakeableQuantity(
  [
    { label: "Soy for rice", isCustom: false, quantity: 10, unit: "ml", lotId: "lot-shared", lotUnit: "ml", lotRemainingQuantity: 60, lotCostPerUnit: 0.18 },
    { label: "Soy for sauce", isCustom: false, quantity: 20, unit: "ml", lotId: "lot-shared", lotUnit: "ml", lotRemainingQuantity: 60, lotCostPerUnit: 0.18 },
  ],
  1,
);
check("shared lot batches (60ml / 30ml per batch)", sharedLot.batches, 2);

// Custom-only recipe is not stock limited
const customOnly = calculateMakeableQuantity([{ label: "X", isCustom: true, quantity: 0, unit: "pcs", costOverride: 8 }], 4);
check("custom-only not stock limited", customOnly.stockLimited, false);

// 6. incompatible units rejected, not silently computed
const badLine = { label: "Rice in ml", isCustom: false, quantity: 100, unit: "ml", lotId: "lot-rice", lotUnit: "kg", lotCostPerUnit: 65, lotRemainingQuantity: 10 };
const badCost = calculateLineCost(badLine);
check("ml->kg rejected", badCost.ok === false && badCost.reason, "incompatible_units");
check("pack->g conversion null", convertRecipeQuantity(1, "pack", "g"), null);
check("kg->g conversion", convertRecipeQuantity(0.1, "kg", "g"), 100);

const badRecipe = calculateRecipeCost([badLine], 5);
check("recipe with bad line not ok", badRecipe.ok, false);

if (failures === 0) {
  console.log("ALL RECIPE COSTING CHECKS PASSED");
  process.exit(0);
}

console.error(`${failures} RECIPE COSTING CHECKS FAILED`);
process.exit(1);
