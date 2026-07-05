import { z } from "zod";

import { makeRecipeLineId } from "@/domain/ids";
import type { IngredientUnit, RecipeIngredientLine, SyncStatus } from "@/domain/types";

import { getRepositoryDatabase, nowIso, toBoolean, toInteger, type RepositoryDatabase } from "./shared";

const createRecipeIngredientLineSchema = z.object({
  id: z.string().optional(),
  businessId: z.string().min(1),
  recipeId: z.string().min(1),
  ingredientId: z.string().nullable().optional(),
  ingredientLotId: z.string().nullable().optional(),
  customName: z.string().nullable().optional(),
  quantity: z.number().nonnegative(),
  unit: z.enum(["g", "kg", "ml", "L", "pcs", "pack"]),
  costOverride: z.number().nonnegative().nullable().optional(),
  costPerUnitSnapshot: z.number().nullable().optional(),
  lineCostSnapshot: z.number().nonnegative(),
  sourceLabelSnapshot: z.string().nullable().optional(),
  isCustom: z.boolean().default(false),
  notes: z.string().nullable().optional(),
});

export type CreateRecipeIngredientLineInput = z.input<typeof createRecipeIngredientLineSchema>;

type RecipeIngredientLineRow = {
  id: string;
  business_id: string;
  recipe_id: string;
  ingredient_id: string | null;
  ingredient_lot_id: string | null;
  custom_name: string | null;
  quantity: number;
  unit: IngredientUnit;
  cost_override: number | null;
  cost_per_unit_snapshot: number | null;
  line_cost_snapshot: number;
  source_label_snapshot: string | null;
  is_custom: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  sync_status: SyncStatus;
  deleted_at: string | null;
};

function mapRecipeIngredientLine(row: RecipeIngredientLineRow): RecipeIngredientLine {
  return {
    id: row.id,
    businessId: row.business_id,
    recipeId: row.recipe_id,
    ingredientId: row.ingredient_id,
    ingredientLotId: row.ingredient_lot_id,
    customName: row.custom_name,
    quantity: row.quantity,
    unit: row.unit,
    costOverride: row.cost_override,
    costPerUnitSnapshot: row.cost_per_unit_snapshot,
    lineCostSnapshot: row.line_cost_snapshot,
    sourceLabelSnapshot: row.source_label_snapshot,
    isCustom: toBoolean(row.is_custom),
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncStatus: row.sync_status,
    deletedAt: row.deleted_at,
  };
}

export async function createRecipeIngredientLine(input: CreateRecipeIngredientLineInput, db?: RepositoryDatabase) {
  const parsed = createRecipeIngredientLineSchema.parse(input);
  const database = getRepositoryDatabase(db);
  const createdAt = nowIso();
  const line: RecipeIngredientLine = {
    id: parsed.id ?? makeRecipeLineId(),
    businessId: parsed.businessId,
    recipeId: parsed.recipeId,
    ingredientId: parsed.ingredientId ?? null,
    ingredientLotId: parsed.ingredientLotId ?? null,
    customName: parsed.customName?.trim() || null,
    quantity: parsed.quantity,
    unit: parsed.unit,
    costOverride: parsed.costOverride ?? null,
    costPerUnitSnapshot: parsed.costPerUnitSnapshot ?? null,
    lineCostSnapshot: parsed.lineCostSnapshot,
    sourceLabelSnapshot: parsed.sourceLabelSnapshot?.trim() || null,
    isCustom: parsed.isCustom,
    notes: parsed.notes?.trim() || null,
    createdAt,
    updatedAt: createdAt,
    syncStatus: "local",
    deletedAt: null,
  };

  await database.runAsync(
    `
      INSERT INTO recipe_ingredient_lines (
        id, business_id, recipe_id, ingredient_id, ingredient_lot_id, custom_name,
        quantity, unit, cost_override, cost_per_unit_snapshot, line_cost_snapshot,
        source_label_snapshot, is_custom, notes, created_at, updated_at, sync_status, deleted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      line.id,
      line.businessId,
      line.recipeId,
      line.ingredientId,
      line.ingredientLotId,
      line.customName,
      line.quantity,
      line.unit,
      line.costOverride,
      line.costPerUnitSnapshot,
      line.lineCostSnapshot,
      line.sourceLabelSnapshot,
      toInteger(line.isCustom),
      line.notes,
      line.createdAt,
      line.updatedAt,
      line.syncStatus,
      line.deletedAt,
    ],
  );

  return line;
}

export async function listRecipeLinesForRecipe(recipeId: string, db?: RepositoryDatabase) {
  const rows = await getRepositoryDatabase(db).getAllAsync<RecipeIngredientLineRow>(
    "SELECT * FROM recipe_ingredient_lines WHERE recipe_id = ? AND deleted_at IS NULL ORDER BY created_at ASC",
    [recipeId],
  );
  return rows.map(mapRecipeIngredientLine);
}

export async function listRecipeLinesForBusiness(businessId: string, db?: RepositoryDatabase) {
  const rows = await getRepositoryDatabase(db).getAllAsync<RecipeIngredientLineRow>(
    "SELECT * FROM recipe_ingredient_lines WHERE business_id = ? AND deleted_at IS NULL ORDER BY created_at ASC",
    [businessId],
  );
  return rows.map(mapRecipeIngredientLine);
}

export async function countRecipeIngredientLines(db?: RepositoryDatabase) {
  const row = await getRepositoryDatabase(db).getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) AS count FROM recipe_ingredient_lines WHERE deleted_at IS NULL",
  );
  return row?.count ?? 0;
}
