import { openKitamoDatabase } from "@/db/client";
import { runMigrations } from "@/db/migrations";
import {
  createRecipe,
  createRecipeIngredientLine,
  getProductById,
  listIngredientLotsForBusiness,
  listRecipeLinesForBusiness,
  listRecipesForBusiness,
  updateRecipe,
  type IngredientLotWithName,
  type RecipeWithProduct,
  type RepositoryDatabase,
} from "@/db/repositories";
import {
  calculateLineCost,
  calculateMakeableQuantity,
  calculateRecipeCost,
  type CostingLine,
  type MakeableResult,
} from "@/domain/recipeCosting";
import type { IngredientUnit, Recipe, RecipeIngredientLine, RecipeProductionMode } from "@/domain/types";

import { loadOwnerSetupStatus } from "./ownerSetup";

export type RecipeDraftLotLine = {
  kind: "lot";
  lotId: string;
  quantity: number;
  unit: IngredientUnit;
  notes?: string | null;
};

export type RecipeDraftCustomLine = {
  kind: "custom";
  name: string;
  cost: number;
  quantity?: number | null;
  unit?: IngredientUnit | null;
  notes?: string | null;
};

export type RecipeDraftLine = RecipeDraftLotLine | RecipeDraftCustomLine;

export type CreateRecipeDraft = {
  outputProductId: string;
  name: string;
  outputQuantity: number;
  outputUnit: IngredientUnit;
  productionMode: RecipeProductionMode;
  notes?: string | null;
  lines: RecipeDraftLine[];
};

export type RecipeOverviewItem = {
  recipe: RecipeWithProduct;
  lines: RecipeIngredientLine[];
  batchCost: number;
  costPerOutputUnit: number;
  makeable: MakeableResult;
  hasCustomLines: boolean;
};

export type RecipesOverview = {
  hasBusiness: boolean;
  items: RecipeOverviewItem[];
  activeCount: number;
  lowMakeableCount: number;
  customCostCount: number;
  averageCostPerUnit: number | null;
};

function lotDisplayLabel(lot: IngredientLotWithName) {
  const brand = lot.brandName?.trim();
  return brand ? `${lot.ingredientName} · ${brand}` : lot.ingredientName;
}

function lotSourceLabel(lot: IngredientLotWithName) {
  const source = lot.sourceName?.trim();
  return source ? `${lotDisplayLabel(lot)} (${source})` : lotDisplayLabel(lot);
}

async function requireActiveBusiness(db: RepositoryDatabase) {
  const status = await loadOwnerSetupStatus(db);
  if (!status.activeBusiness) {
    throw new Error("Create your business profile in Owner Settings first.");
  }
  return status.activeBusiness;
}

export async function createRecipeWithLines(
  draft: CreateRecipeDraft,
  db: RepositoryDatabase = openKitamoDatabase(),
): Promise<{ recipe: Recipe; batchCost: number; costPerOutputUnit: number }> {
  await runMigrations(db);

  const name = draft.name.trim();
  if (!name) {
    throw new Error("Recipe name is required.");
  }

  if (!Number.isFinite(draft.outputQuantity) || draft.outputQuantity <= 0) {
    throw new Error("Output quantity must be greater than zero.");
  }

  if (draft.lines.length === 0) {
    throw new Error("Add at least one ingredient line.");
  }

  const business = await requireActiveBusiness(db);

  const product = await getProductById(draft.outputProductId, db);
  if (!product || product.businessId !== business.id) {
    throw new Error("Choose which paninda this recipe makes.");
  }

  const lots = await listIngredientLotsForBusiness(business.id, db);
  const lotMap = new Map(lots.map((lot) => [lot.id, lot]));

  type PreparedLine = {
    ingredientId: string | null;
    ingredientLotId: string | null;
    customName: string | null;
    quantity: number;
    unit: IngredientUnit;
    costOverride: number | null;
    costPerUnitSnapshot: number | null;
    lineCostSnapshot: number;
    sourceLabelSnapshot: string | null;
    isCustom: boolean;
    notes: string | null;
  };

  const preparedLines: PreparedLine[] = [];
  let batchCost = 0;

  for (const line of draft.lines) {
    if (line.kind === "custom") {
      const customName = line.name.trim();
      if (!customName) {
        throw new Error("Custom ingredient name is required.");
      }

      if (!Number.isFinite(line.cost) || line.cost < 0) {
        throw new Error(`${customName}: custom cost must be zero or higher.`);
      }

      preparedLines.push({
        ingredientId: null,
        ingredientLotId: null,
        customName,
        quantity: line.quantity ?? 0,
        unit: line.unit ?? "pcs",
        costOverride: line.cost,
        costPerUnitSnapshot: null,
        lineCostSnapshot: line.cost,
        sourceLabelSnapshot: `${customName} (custom cost)`,
        isCustom: true,
        notes: line.notes?.trim() || null,
      });
      batchCost += line.cost;
      continue;
    }

    const lot = lotMap.get(line.lotId);
    if (!lot) {
      throw new Error("A selected grocery item is no longer available. Refresh and try again.");
    }

    if (!Number.isFinite(line.quantity) || line.quantity <= 0) {
      throw new Error(`${lotDisplayLabel(lot)}: quantity must be greater than zero.`);
    }

    const costResult = calculateLineCost({
      label: lotDisplayLabel(lot),
      isCustom: false,
      quantity: line.quantity,
      unit: line.unit,
      lotId: lot.id,
      lotUnit: lot.unit,
      lotCostPerUnit: lot.costPerUnit,
      lotRemainingQuantity: lot.remainingQuantity,
    });

    if (!costResult.ok) {
      if (costResult.reason === "incompatible_units") {
        throw new Error(
          `${lotDisplayLabel(lot)}: hindi ma-convert ang ${line.unit} papunta sa ${lot.unit}. Gamitin ang ${lot.unit}, o katugmang g/kg o ml/L.`,
        );
      }

      throw new Error(`${lotDisplayLabel(lot)}: walang cost na mababasa para sa grocery item na ito.`);
    }

    preparedLines.push({
      ingredientId: lot.ingredientId,
      ingredientLotId: lot.id,
      customName: null,
      quantity: line.quantity,
      unit: line.unit,
      costOverride: null,
      costPerUnitSnapshot: lot.costPerUnit,
      lineCostSnapshot: costResult.lineCost,
      sourceLabelSnapshot: lotSourceLabel(lot),
      isCustom: false,
      notes: line.notes?.trim() || null,
    });
    batchCost += costResult.lineCost;
  }

  let savedRecipe: Recipe | null = null;

  await db.withExclusiveTransactionAsync(async (txn) => {
    savedRecipe = await createRecipe(
      {
        businessId: business.id,
        outputProductId: product.id,
        name,
        outputQuantity: draft.outputQuantity,
        outputUnit: draft.outputUnit,
        productionMode: draft.productionMode,
        notes: draft.notes ?? null,
      },
      txn,
    );

    for (const prepared of preparedLines) {
      await createRecipeIngredientLine(
        {
          businessId: business.id,
          recipeId: savedRecipe.id,
          ...prepared,
        },
        txn,
      );
    }
  });

  if (!savedRecipe) {
    throw new Error("Could not save the recipe.");
  }

  return {
    recipe: savedRecipe,
    batchCost,
    costPerOutputUnit: batchCost / draft.outputQuantity,
  };
}

function toCostingLines(lines: RecipeIngredientLine[], lotMap: Map<string, IngredientLotWithName>): CostingLine[] {
  return lines.map((line) => {
    if (line.isCustom || !line.ingredientLotId) {
      return {
        label: line.sourceLabelSnapshot ?? line.customName ?? "Custom item",
        isCustom: true,
        quantity: line.quantity,
        unit: line.unit,
        costOverride: line.costOverride ?? line.lineCostSnapshot,
      };
    }

    const lot = lotMap.get(line.ingredientLotId);
    const lotAvailable = lot && lot.status !== "archived";

    return {
      label: line.sourceLabelSnapshot ?? lot?.ingredientName ?? "Ingredient",
      isCustom: false,
      quantity: line.quantity,
      unit: line.unit,
      lotId: line.ingredientLotId,
      lotUnit: lot?.unit ?? line.unit,
      lotCostPerUnit: lot?.costPerUnit ?? line.costPerUnitSnapshot,
      lotRemainingQuantity: lotAvailable ? lot.remainingQuantity : 0,
    };
  });
}

export async function loadRecipesOverview(db: RepositoryDatabase = openKitamoDatabase()): Promise<RecipesOverview> {
  await runMigrations(db);
  const status = await loadOwnerSetupStatus(db);

  if (!status.activeBusiness) {
    return {
      hasBusiness: false,
      items: [],
      activeCount: 0,
      lowMakeableCount: 0,
      customCostCount: 0,
      averageCostPerUnit: null,
    };
  }

  const businessId = status.activeBusiness.id;
  const recipes = await listRecipesForBusiness(businessId, db);
  const allLines = await listRecipeLinesForBusiness(businessId, db);
  const lots = await listIngredientLotsForBusiness(businessId, db);
  const lotMap = new Map(lots.map((lot) => [lot.id, lot]));

  const linesByRecipe = new Map<string, RecipeIngredientLine[]>();
  for (const line of allLines) {
    const bucket = linesByRecipe.get(line.recipeId);
    if (bucket) {
      bucket.push(line);
    } else {
      linesByRecipe.set(line.recipeId, [line]);
    }
  }

  const items: RecipeOverviewItem[] = recipes.map((recipe) => {
    const lines = linesByRecipe.get(recipe.id) ?? [];
    const batchCost = lines.reduce((total, line) => total + line.lineCostSnapshot, 0);
    const makeable = calculateMakeableQuantity(toCostingLines(lines, lotMap), recipe.outputQuantity);

    return {
      recipe,
      lines,
      batchCost,
      costPerOutputUnit: recipe.outputQuantity > 0 ? batchCost / recipe.outputQuantity : batchCost,
      makeable,
      hasCustomLines: lines.some((line) => line.isCustom),
    };
  });

  const activeItems = items.filter((item) => item.recipe.isActive);
  const lowMakeableCount = activeItems.filter(
    (item) => item.makeable.stockLimited && (item.makeable.batches ?? 0) <= 1,
  ).length;
  const withCost = activeItems.filter((item) => item.lines.length > 0);
  const averageCostPerUnit =
    withCost.length > 0 ? withCost.reduce((total, item) => total + item.costPerOutputUnit, 0) / withCost.length : null;

  return {
    hasBusiness: true,
    items,
    activeCount: activeItems.length,
    lowMakeableCount,
    customCostCount: activeItems.filter((item) => item.hasCustomLines).length,
    averageCostPerUnit,
  };
}

export async function archiveRecipe(recipeId: string, db: RepositoryDatabase = openKitamoDatabase()) {
  await runMigrations(db);
  return updateRecipe(recipeId, { isActive: false }, db);
}

export function previewDraftLineCost(input: {
  quantity: number;
  unit: IngredientUnit;
  lot: IngredientLotWithName;
}): { ok: true; lineCost: number } | { ok: false; incompatible: boolean } {
  const result = calculateLineCost({
    label: lotDisplayLabel(input.lot),
    isCustom: false,
    quantity: input.quantity,
    unit: input.unit,
    lotId: input.lot.id,
    lotUnit: input.lot.unit,
    lotCostPerUnit: input.lot.costPerUnit,
    lotRemainingQuantity: input.lot.remainingQuantity,
  });

  if (result.ok) {
    return { ok: true, lineCost: result.lineCost };
  }

  return { ok: false, incompatible: result.reason === "incompatible_units" };
}

export function previewDraftBatchCost(lineCosts: number[], outputQuantity: number) {
  const result = calculateRecipeCost(
    lineCosts.map((cost, index) => ({
      label: `Line ${index + 1}`,
      isCustom: true,
      quantity: 0,
      unit: "pcs" as const,
      costOverride: cost,
    })),
    outputQuantity,
  );

  return {
    batchCost: result.batchCost,
    costPerOutputUnit: result.costPerOutputUnit,
  };
}
