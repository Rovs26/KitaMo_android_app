/**
 * Pure cook-upon-order COGS math. Depends only on recipeCosting (also pure)
 * so both compile standalone for scripts/check-order-cogs.js.
 *
 * Rules: a cook-upon-order sale NEVER blocks. Each recipe line deducts what
 * its selected lot actually has; any missing part is estimated at that same
 * lot's price (the owner's chosen brand is the best estimate). If the lot is
 * gone entirely, the save-time recipe snapshot price is used. Custom lines
 * scale in cost and never touch stock. Shortfalls are recorded, not thrown.
 */

import { convertRecipeQuantity, type RecipeCostingUnit } from "./recipeCosting";

const EPSILON = 1e-9;

export type OrderCogsLine = {
  label: string;
  isCustom: boolean;
  quantity: number;
  unit: RecipeCostingUnit;
  lotId?: string | null;
  ingredientId?: string | null;
  lotUnit?: RecipeCostingUnit | null;
  lotCostPerUnit?: number | null;
  lotRemainingQuantity?: number | null;
  costOverride?: number | null;
  lineCostSnapshot: number;
};

export type OrderUsage = {
  label: string;
  isCustom: boolean;
  lotId: string | null;
  ingredientId: string | null;
  quantityUsed: number;
  shortfallQuantity: number;
  unit: RecipeCostingUnit;
  lineCost: number;
  isEstimated: boolean;
};

export type OrderDeduction = {
  lotId: string;
  quantity: number;
  unit: RecipeCostingUnit;
  cost: number;
  label: string;
};

export type OrderCogsPlan = {
  cogsTotal: number;
  actualCost: number;
  estimatedCost: number;
  isEstimated: boolean;
  usages: OrderUsage[];
  deductions: OrderDeduction[];
};

/**
 * Plans COGS for one sold cart line. `remainingByLot` is a working map shared
 * across items in one checkout so lots drained by an earlier item are seen by
 * later items; planned deductions are subtracted from it in place.
 */
export function planOrderCogs(
  lines: OrderCogsLine[],
  outputPerBatch: number,
  soldQuantity: number,
  remainingByLot: Map<string, number>,
): OrderCogsPlan {
  const safeOutput = Number.isFinite(outputPerBatch) && outputPerBatch > 0 ? outputPerBatch : 1;
  const safeSold = Number.isFinite(soldQuantity) && soldQuantity > 0 ? soldQuantity : 0;
  const multiplier = safeSold / safeOutput;

  const usages: OrderUsage[] = [];
  const deductionByLot = new Map<string, OrderDeduction>();
  let actualCost = 0;
  let estimatedCost = 0;

  for (const line of lines) {
    if (line.isCustom) {
      const baseCost = Number.isFinite(line.costOverride ?? NaN) ? (line.costOverride as number) : line.lineCostSnapshot;
      const lineCost = baseCost * multiplier;
      actualCost += lineCost;
      usages.push({
        label: line.label,
        isCustom: true,
        lotId: null,
        ingredientId: line.ingredientId ?? null,
        quantityUsed: line.quantity * multiplier,
        shortfallQuantity: 0,
        unit: line.unit,
        lineCost,
        isEstimated: false,
      });
      continue;
    }

    const hasLotPricing =
      Boolean(line.lotId) && Boolean(line.lotUnit) && Number.isFinite(line.lotCostPerUnit ?? NaN);
    const neededInLotUnit = hasLotPricing
      ? convertRecipeQuantity(line.quantity * multiplier, line.unit, line.lotUnit as RecipeCostingUnit)
      : null;

    if (!hasLotPricing || neededInLotUnit === null) {
      // Lot gone or units no longer line up: estimate from the save-time snapshot.
      const lineCost = line.lineCostSnapshot * multiplier;
      estimatedCost += lineCost;
      usages.push({
        label: line.label,
        isCustom: false,
        lotId: line.lotId ?? null,
        ingredientId: line.ingredientId ?? null,
        quantityUsed: 0,
        shortfallQuantity: line.quantity * multiplier,
        unit: line.unit,
        lineCost,
        isEstimated: true,
      });
      continue;
    }

    const lotId = line.lotId as string;
    const lotUnit = line.lotUnit as RecipeCostingUnit;
    const costPerUnit = line.lotCostPerUnit as number;
    const trackedRemaining = remainingByLot.get(lotId);
    const remaining = trackedRemaining ?? (Number.isFinite(line.lotRemainingQuantity ?? NaN) ? (line.lotRemainingQuantity as number) : 0);

    const available = Math.max(0, remaining);
    const used = Math.min(neededInLotUnit, available);
    const shortfall = Math.max(0, neededInLotUnit - used);
    const usedCost = used * costPerUnit;
    const shortfallCost = shortfall * costPerUnit;

    actualCost += usedCost;
    estimatedCost += shortfallCost;

    if (used > EPSILON) {
      remainingByLot.set(lotId, available - used);
      const existing = deductionByLot.get(lotId);
      if (existing) {
        existing.quantity += used;
        existing.cost += usedCost;
      } else {
        deductionByLot.set(lotId, { lotId, quantity: used, unit: lotUnit, cost: usedCost, label: line.label });
      }
    } else {
      remainingByLot.set(lotId, available);
    }

    usages.push({
      label: line.label,
      isCustom: false,
      lotId,
      ingredientId: line.ingredientId ?? null,
      quantityUsed: used,
      shortfallQuantity: shortfall,
      unit: lotUnit,
      lineCost: usedCost + shortfallCost,
      isEstimated: shortfall > EPSILON,
    });
  }

  return {
    cogsTotal: actualCost + estimatedCost,
    actualCost,
    estimatedCost,
    isEstimated: estimatedCost > EPSILON,
    usages,
    deductions: [...deductionByLot.values()],
  };
}
