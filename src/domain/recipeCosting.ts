/**
 * Pure recipe costing math. Deliberately dependency-free so it can be
 * compiled standalone and verified by scripts/check-recipe-costing.js.
 *
 * Costing rule: a line priced from a selected ingredient lot uses that lot's
 * cost per unit only — never an average across lots of the same ingredient.
 * Custom lines use their entered cost directly and are not checked against
 * grocery stock.
 */

export type RecipeCostingUnit = "g" | "kg" | "ml" | "L" | "pcs" | "pack";

export type CostingLine = {
  label: string;
  isCustom: boolean;
  quantity: number;
  unit: RecipeCostingUnit;
  lotId?: string | null;
  lotUnit?: RecipeCostingUnit | null;
  lotCostPerUnit?: number | null;
  lotRemainingQuantity?: number | null;
  costOverride?: number | null;
};

export type LineCostResult =
  | { ok: true; lineCost: number }
  | { ok: false; reason: "incompatible_units" | "missing_lot_cost" | "missing_custom_cost" };

export type RecipeCostResult = {
  ok: boolean;
  batchCost: number;
  costPerOutputUnit: number;
  lineCosts: { label: string; lineCost: number; isCustom: boolean }[];
  errors: { label: string; reason: string }[];
};

export type MakeableResult = {
  stockLimited: boolean;
  batches: number | null;
  units: number | null;
  bottleneckLabel: string | null;
  hasCustomLines: boolean;
};

const EPSILON = 1e-9;

/** Only trivially compatible conversions; anything else needs owner-defined sizing. */
export function convertRecipeQuantity(
  quantity: number,
  fromUnit: RecipeCostingUnit,
  toUnit: RecipeCostingUnit,
): number | null {
  if (fromUnit === toUnit) {
    return quantity;
  }

  if (fromUnit === "kg" && toUnit === "g") {
    return quantity * 1000;
  }

  if (fromUnit === "g" && toUnit === "kg") {
    return quantity / 1000;
  }

  if (fromUnit === "L" && toUnit === "ml") {
    return quantity * 1000;
  }

  if (fromUnit === "ml" && toUnit === "L") {
    return quantity / 1000;
  }

  return null;
}

export function areRecipeUnitsCompatible(fromUnit: RecipeCostingUnit, toUnit: RecipeCostingUnit) {
  return convertRecipeQuantity(1, fromUnit, toUnit) !== null;
}

export function calculateLineCost(line: CostingLine): LineCostResult {
  if (line.isCustom) {
    if (line.costOverride === null || line.costOverride === undefined || !Number.isFinite(line.costOverride) || line.costOverride < 0) {
      return { ok: false, reason: "missing_custom_cost" };
    }

    return { ok: true, lineCost: line.costOverride };
  }

  if (
    line.lotCostPerUnit === null ||
    line.lotCostPerUnit === undefined ||
    !Number.isFinite(line.lotCostPerUnit) ||
    !line.lotUnit
  ) {
    return { ok: false, reason: "missing_lot_cost" };
  }

  const quantityInLotUnit = convertRecipeQuantity(line.quantity, line.unit, line.lotUnit);
  if (quantityInLotUnit === null) {
    return { ok: false, reason: "incompatible_units" };
  }

  return { ok: true, lineCost: quantityInLotUnit * line.lotCostPerUnit };
}

export function calculateRecipeCost(lines: CostingLine[], outputQuantity: number): RecipeCostResult {
  const lineCosts: RecipeCostResult["lineCosts"] = [];
  const errors: RecipeCostResult["errors"] = [];
  let batchCost = 0;

  for (const line of lines) {
    const result = calculateLineCost(line);
    if (result.ok) {
      batchCost += result.lineCost;
      lineCosts.push({ label: line.label, lineCost: result.lineCost, isCustom: line.isCustom });
    } else {
      errors.push({ label: line.label, reason: result.reason });
    }
  }

  const safeOutput = Number.isFinite(outputQuantity) && outputQuantity > 0 ? outputQuantity : 1;

  return {
    ok: errors.length === 0,
    batchCost,
    costPerOutputUnit: batchCost / safeOutput,
    lineCosts,
    errors,
  };
}

/**
 * How many whole batches the current lot stock supports. Lines sharing one lot
 * are aggregated first so two lines drawing from the same lot are not counted
 * independently. Custom lines never limit the result.
 */
export function calculateMakeableQuantity(lines: CostingLine[], outputQuantity: number): MakeableResult {
  const hasCustomLines = lines.some((line) => line.isCustom);
  const requiredPerLot = new Map<string, { required: number; remaining: number; label: string }>();

  for (const line of lines) {
    if (line.isCustom || !line.lotId || !line.lotUnit) {
      continue;
    }

    const quantityInLotUnit = convertRecipeQuantity(line.quantity, line.unit, line.lotUnit);
    if (quantityInLotUnit === null || quantityInLotUnit <= 0) {
      continue;
    }

    const remaining = Number.isFinite(line.lotRemainingQuantity ?? NaN) ? (line.lotRemainingQuantity as number) : 0;
    const existing = requiredPerLot.get(line.lotId);
    if (existing) {
      existing.required += quantityInLotUnit;
      existing.remaining = Math.min(existing.remaining, remaining);
    } else {
      requiredPerLot.set(line.lotId, { required: quantityInLotUnit, remaining, label: line.label });
    }
  }

  if (requiredPerLot.size === 0) {
    return {
      stockLimited: false,
      batches: null,
      units: null,
      bottleneckLabel: null,
      hasCustomLines,
    };
  }

  let minBatches = Number.POSITIVE_INFINITY;
  let bottleneckLabel: string | null = null;

  for (const entry of requiredPerLot.values()) {
    const batchesFromLot = Math.floor(entry.remaining / entry.required + EPSILON);
    if (batchesFromLot < minBatches) {
      minBatches = batchesFromLot;
      bottleneckLabel = entry.label;
    }
  }

  const batches = Number.isFinite(minBatches) ? Math.max(0, minBatches) : 0;
  const safeOutput = Number.isFinite(outputQuantity) && outputQuantity > 0 ? outputQuantity : 1;

  return {
    stockLimited: true,
    batches,
    units: batches * safeOutput,
    bottleneckLabel,
    hasCustomLines,
  };
}
