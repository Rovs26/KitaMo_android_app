const {
  resolveStoredBranch,
  resolveStoredBusiness,
} = require("../node_modules/.cache/kitamo-owner-context-check/ownerContext.js");

const businesses = [{ id: "business_a" }, { id: "business_b" }];
const branches = [
  { id: "stall_a1", businessId: "business_a", active: true },
  { id: "stall_a2", businessId: "business_a", active: false },
  { id: "stall_b1", businessId: "business_b", active: true },
];

const checks = [
  ["valid stored business", resolveStoredBusiness(businesses, "business_b")?.id, "business_b"],
  ["missing stored business", resolveStoredBusiness(businesses, "missing"), null],
  ["empty stored business", resolveStoredBusiness(businesses, null), null],
  ["valid active stall", resolveStoredBranch(branches, "business_a", "stall_a1")?.id, "stall_a1"],
  ["inactive stall", resolveStoredBranch(branches, "business_a", "stall_a2"), null],
  ["cross-business stall", resolveStoredBranch(branches, "business_a", "stall_b1"), null],
  ["missing stall", resolveStoredBranch(branches, "business_a", "missing"), null],
  ["empty stall", resolveStoredBranch(branches, "business_a", null), null],
];

let failures = 0;
for (const [label, actual, expected] of checks) {
  const passed = actual === expected;
  if (!passed) failures += 1;
  console.log(`${label}: ${passed ? "OK" : `FAIL (actual=${actual}, expected=${expected})`}`);
}

if (failures > 0) {
  console.error(`${failures} OWNER CONTEXT CHECKS FAILED`);
  process.exit(1);
}

console.log("ALL OWNER CONTEXT CHECKS PASSED");

