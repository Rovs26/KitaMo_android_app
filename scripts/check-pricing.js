/**
 * Manual verification helper for bundle pricing.
 * Run with: npm run check:pricing
 * Compiles src/domain/pricing.ts to a cache folder, then checks the
 * validated bundle cases (unit 20, bundle 8 for 150) and fallback guards.
 */
const { calculateLineTotal, calculateCartSubtotal } = require("../node_modules/.cache/kitamo-pricing-check/pricing.js");

const base = { unitPrice: 20, bundleQuantity: 8, bundlePrice: 150, bundleLabel: "8 for PHP 150" };
const cases = [
  [7, 140],
  [8, 150],
  [9, 170],
  [16, 300],
  [17, 320],
];

let failures = 0;

for (const [quantity, expected] of cases) {
  const result = calculateLineTotal({ ...base, quantity });
  const ok = result.lineTotal === expected;
  if (!ok) failures++;
  console.log(`qty ${quantity}: lineTotal=${result.lineTotal} expected=${expected} ${ok ? "OK" : "FAIL"}`);
}

const mixedCart = [
  { ...base, quantity: 17 },
  { quantity: 2, unitPrice: 85, bundleQuantity: null, bundlePrice: null },
];
const subtotal = calculateCartSubtotal(mixedCart);
const expectedSubtotal = 320 + 170;
if (subtotal !== expectedSubtotal) failures++;
console.log(`mixed cart subtotal=${subtotal} expected=${expectedSubtotal} ${subtotal === expectedSubtotal ? "OK" : "FAIL"}`);

const guards = [
  ["no bundle fields", { quantity: 9, unitPrice: 20, bundleQuantity: null, bundlePrice: null }, 180],
  ["zero bundle price", { quantity: 9, unitPrice: 20, bundleQuantity: 8, bundlePrice: 0 }, 180],
  ["bundle not cheaper", { quantity: 8, unitPrice: 20, bundleQuantity: 8, bundlePrice: 160 }, 160],
  ["bundle quantity 1", { quantity: 5, unitPrice: 20, bundleQuantity: 1, bundlePrice: 15 }, 100],
  ["negative quantity", { quantity: -3, unitPrice: 20, bundleQuantity: 8, bundlePrice: 150 }, 0],
];

for (const [name, input, expected] of guards) {
  const result = calculateLineTotal(input);
  const ok = result.lineTotal === expected && result.bundleApplied === false;
  if (!ok) failures++;
  console.log(`guard ${name}: lineTotal=${result.lineTotal} expected=${expected} ${ok ? "OK" : "FAIL"}`);
}

if (failures === 0) {
  console.log("ALL PRICING CHECKS PASSED");
  process.exit(0);
}

console.error(`${failures} PRICING CHECKS FAILED`);
process.exit(1);
