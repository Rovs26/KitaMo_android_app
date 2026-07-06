/**
 * Manual verification helper for fixed-cost recurrence and profit math.
 * Run with: npm run check:fixedcosts
 */
const {
  listOccurrences,
  findPayableOccurrence,
  classifyFixedCost,
} = require("../node_modules/.cache/kitamo-fixedcost-check/fixedCostSchedule.js");
const { grossProfit, netProfit } = require("../node_modules/.cache/kitamo-fixedcost-check/profitMath.js");

let failures = 0;

function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${name}: got ${JSON.stringify(actual)} expected ${JSON.stringify(expected)} ${ok ? "OK" : "FAIL"}`);
}

// Recurrence: daily counts days in range
check("daily 5 days", listOccurrences("2026-07-01", "daily", null, "2026-07-01", "2026-07-05").length, 5);
check("daily respects anchor start", listOccurrences("2026-07-03", "daily", null, "2026-07-01", "2026-07-05"), ["2026-07-03", "2026-07-04", "2026-07-05"]);

// Weekly: every 7 days from anchor
check("weekly in July", listOccurrences("2026-07-01", "weekly", null, "2026-07-01", "2026-07-31"), ["2026-07-01", "2026-07-08", "2026-07-15", "2026-07-22", "2026-07-29"]);

// Monthly: same day each month; Jan 31 clamps to Feb 28 (2026 not a leap year)
check("monthly 3 months", listOccurrences("2026-07-15", "monthly", null, "2026-07-01", "2026-09-30"), ["2026-07-15", "2026-08-15", "2026-09-15"]);
check("month-end clamp", listOccurrences("2026-01-31", "monthly", null, "2026-02-01", "2026-02-28"), ["2026-02-28"]);

// One-time: once, only in range
check("one_time inside", listOccurrences("2026-07-10", "one_time", null, "2026-07-01", "2026-07-31"), ["2026-07-10"]);
check("one_time outside", listOccurrences("2026-08-10", "one_time", null, "2026-07-01", "2026-07-31"), []);

// End date honored
check("end date stops recurrence", listOccurrences("2026-07-01", "weekly", "2026-07-10", "2026-07-01", "2026-07-31"), ["2026-07-01", "2026-07-08"]);

// Payable occurrence: oldest unpaid first (overdue), skips paid ones
check("payable oldest unpaid", findPayableOccurrence("2026-07-01", "weekly", null, ["2026-07-01"], "2026-07-16"), "2026-07-08");
check("payable next upcoming when settled", findPayableOccurrence("2026-07-01", "weekly", null, ["2026-07-01", "2026-07-08", "2026-07-15"], "2026-07-16"), "2026-07-22");
check("one_time fully paid", findPayableOccurrence("2026-07-01", "one_time", null, ["2026-07-01"], "2026-07-16"), null);

// Status classification
check("overdue status", classifyFixedCost("2026-07-01", "monthly", null, [], "2026-07-16").status, "overdue");
check("due soon status", classifyFixedCost("2026-07-20", "monthly", null, [], "2026-07-16").status, "due_soon");
check("scheduled status", classifyFixedCost("2026-08-30", "monthly", null, [], "2026-07-16").status, "scheduled");
check("done status", classifyFixedCost("2026-07-01", "one_time", null, ["2026-07-01"], "2026-07-16").status, "done");

// Profit math: gross, net, spoilage as loss; transfers/unsold have no place in the API
check("gross profit", grossProfit(1000, 400), 600);
check("net profit", netProfit({ revenue: 1000, soldCogs: 400, fixedCosts: 200, spoilageLoss: 50 }), 350);
check("net loss allowed", netProfit({ revenue: 100, soldCogs: 80, fixedCosts: 50, spoilageLoss: 10 }), -40);
check("transfers/unsold excluded from net inputs", Object.keys({ revenue: 0, soldCogs: 0, fixedCosts: 0, spoilageLoss: 0 }).length, 4);

if (failures === 0) {
  console.log("ALL FIXED COST CHECKS PASSED");
  process.exit(0);
}

console.error(`${failures} FIXED COST CHECKS FAILED`);
process.exit(1);
