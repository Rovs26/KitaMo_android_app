/**
 * Pure production planning math. Depends only on recipeCosting (also pure) so
 * both compile standalone for scripts/check-production-math.js.
 *
 * Rules: ingredient usage and cost scale linearly with the batch multiplier
 * (fractional batches allowed); deductions come from the recipe's selected
 * lots only; lines sharing a lot are aggregated before the availability
 * check; custom lines scale in cost but never touch grocery stock; a
 * shortfall or unit mismatch blocks the plan — production never goes
 * negative and never silently miscomputes.
 */

import { convertRecipeQuantity, type CostingLine, type RecipeCostingUnit } from "./recipeCosting";

const EPSILON = 1e-9;

export type ProductionPlanLine = {
  label: string;
  isCustom: boolean;
  lotId: string | null;
  requiredQuantity: number;
  unit: RecipeCostingUnit;
  lineCost: number;
};

export type ProductionShortfall = {
  label: string;
  lotId: string;
  neededQuantity: number;
  availableQuantity: number;
  unit: RecipeCostingUnit;
};

export type ProductionDeduction = {
  lotId: string;
  label: string;
  quantity: number;
  unit: RecipeCostingUnit;
  cost: number;
};

export type ProductionPlan = {
  ok: boolean;
  batchMultiplier: number;
  totalCost: number;
  costPerOutputUnit: number;
  lines: ProductionPlanLine[];
  deductions: ProductionDeduction[];
  shortfalls: ProductionShortfall[];
  incompatibleLabels: string[];
  hasCustomLines: boolean;
};

export function calculateBatchMultiplier(outputPerBatch: number, producedQuantity: number): number | null {
  if (!Number.isFinite(outputPerBatch) || outputPerBatch <= 0) {
    return null;
  }

  if (!Number.isFinite(producedQuantity) || producedQuantity <= 0) {
    return null;
  }

  return producedQuantity / outputPerBatch;
}

export function planProduction(
  recipeLines: CostingLine[],
  outputPerBatch: number,
  producedQuantity: number,
): ProductionPlan {
  const multiplier = calculateBatchMultiplier(outputPerBatch, producedQuantity);
  const lines: ProductionPlanLine[] = [];
  const shortfalls: ProductionShortfall[] = [];
  const incompatibleLabels: string[] = [];
  const perLot = new Map<string, { label: string; needed: number; available: number; unit: RecipeCostingUnit; cost: number }>();
  let totalCost = 0;

  if (multiplier === null) {
    return {
      ok: false,
      batchMultiplier: 0,
      totalCost: 0,
      costPerOutputUnit: 0,
      lines: [],
      deductions: [],
      shortfalls: [],
      incompatibleLabels: [],
      hasCustomLines: recipeLines.some((line) => line.isCustom),
    };
  }

  for (const line of recipeLines) {
    if (line.isCustom) {
      const baseCost = Number.isFinite(line.costOverride ?? NaN) ? (line.costOverride as number) : 0;
      const lineCost = baseCost * multiplier;
      totalCost += lineCost;
      lines.push({
        label: line.label,
        isCustom: true,
        lotId: null,
        requiredQuantity: line.quantity * multiplier,
        unit: line.unit,
        lineCost,
      });
      continue;
    }

    if (!line.lotId || !line.lotUnit || !Number.isFinite(line.lotCostPerUnit ?? NaN)) {
      incompatibleLabels.push(line.label);
      continue;
    }

    const requiredInLotUnit = convertRecipeQuantity(line.quantity * multiplier, line.unit, line.lotUnit);
    if (requiredInLotUnit === null) {
      incompatibleLabels.push(line.label);
      continue;
    }

    const lineCost = requiredInLotUnit * (line.lotCostPerUnit as number);
    totalCost += lineCost;
    lines.push({
      label: line.label,
      isCustom: false,
      lotId: line.lotId,
      requiredQuantity: line.quantity * multiplier,
      unit: line.unit,
      lineCost,
    });

    const available = Number.isFinite(line.lotRemainingQuantity ?? NaN) ? (line.lotRemainingQuantity as number) : 0;
    const existing = perLot.get(line.lotId);
    if (existing) {
      existing.needed += requiredInLotUnit;
      existing.available = Math.min(existing.available, available);
      existing.cost += lineCost;
    } else {
      perLot.set(line.lotId, {
        label: line.label,
        needed: requiredInLotUnit,
        available,
        unit: line.lotUnit,
        cost: lineCost,
      });
    }
  }

  const deductions: ProductionDeduction[] = [];
  for (const [lotId, entry] of perLot.entries()) {
    deductions.push({ lotId, label: entry.label, quantity: entry.needed, unit: entry.unit, cost: entry.cost });
    if (entry.needed > entry.available + EPSILON) {
      shortfalls.push({
        label: entry.label,
        lotId,
        neededQuantity: entry.needed,
        availableQuantity: entry.available,
        unit: entry.unit,
      });
    }
  }

  return {
    ok: shortfalls.length === 0 && incompatibleLabels.length === 0,
    batchMultiplier: multiplier,
    totalCost,
    costPerOutputUnit: totalCost / producedQuantity,
    lines,
    deductions,
    shortfalls,
    incompatibleLabels,
    hasCustomLines: recipeLines.some((line) => line.isCustom),
  };
}
