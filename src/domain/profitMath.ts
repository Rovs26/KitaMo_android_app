/**
 * Pure profit math. Dependency-free for the standalone check script.
 *
 * Accounting rules (documented in docs/food-business-engine.md):
 * - Sold COGS is recognized when goods are sold (estimated COGS included, flagged).
 * - Unsold finished goods remain inventory value — never an expense here.
 * - Spoilage is a loss in the period it is recorded.
 * - Fixed costs are expenses of the period their due dates fall in.
 * - Transfers move value between stalls and never touch profit.
 * - Production COGS is informational; counting it AND sold COGS would double-count.
 */

export type ProfitInput = {
  revenue: number;
  soldCogs: number;
  fixedCosts: number;
  spoilageLoss: number;
};

export function grossProfit(revenue: number, soldCogs: number) {
  return revenue - soldCogs;
}

export function netProfit(input: ProfitInput) {
  return input.revenue - input.soldCogs - input.fixedCosts - input.spoilageLoss;
}
