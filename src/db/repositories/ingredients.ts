import { z } from "zod";

import { makeIngredientId } from "@/domain/ids";
import type { Ingredient, IngredientUnit, SyncStatus } from "@/domain/types";

import { getRepositoryDatabase, nowIso, toBoolean, toInteger, type RepositoryDatabase } from "./shared";

export const ingredientUnits: IngredientUnit[] = ["g", "kg", "ml", "L", "pcs", "pack"];

const createIngredientSchema = z.object({
  id: z.string().optional(),
  businessId: z.string().min(1),
  name: z.string().min(1),
  defaultUnit: z.enum(["g", "kg", "ml", "L", "pcs", "pack"]).default("pcs"),
  category: z.string().default("General"),
  lowStockThreshold: z.number().nonnegative().default(0),
  isActive: z.boolean().default(true),
});

// Separate schema without .default() values: zod v4 .partial() re-applies field
// defaults for missing keys, which would silently overwrite existing columns.
const updateIngredientSchema = z.object({
  name: z.string().min(1).optional(),
  defaultUnit: z.enum(["g", "kg", "ml", "L", "pcs", "pack"]).optional(),
  category: z.string().optional(),
  lowStockThreshold: z.number().nonnegative().optional(),
  isActive: z.boolean().optional(),
});

export type CreateIngredientInput = z.input<typeof createIngredientSchema>;
export type UpdateIngredientInput = z.input<typeof updateIngredientSchema>;

type IngredientRow = {
  id: string;
  business_id: string;
  name: string;
  default_unit: IngredientUnit;
  category: string;
  low_stock_threshold: number;
  is_active: number;
  created_at: string;
  updated_at: string;
  sync_status: SyncStatus;
  deleted_at: string | null;
};

function mapIngredient(row: IngredientRow): Ingredient {
  return {
    id: row.id,
    businessId: row.business_id,
    name: row.name,
    defaultUnit: row.default_unit,
    category: row.category,
    lowStockThreshold: row.low_stock_threshold,
    isActive: toBoolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncStatus: row.sync_status,
    deletedAt: row.deleted_at,
  };
}

export async function createIngredient(input: CreateIngredientInput, db?: RepositoryDatabase) {
  const parsed = createIngredientSchema.parse(input);
  const database = getRepositoryDatabase(db);
  const createdAt = nowIso();
  const ingredient: Ingredient = {
    id: parsed.id ?? makeIngredientId(),
    businessId: parsed.businessId,
    name: parsed.name.trim(),
    defaultUnit: parsed.defaultUnit,
    category: parsed.category,
    lowStockThreshold: parsed.lowStockThreshold,
    isActive: parsed.isActive,
    createdAt,
    updatedAt: createdAt,
    syncStatus: "local",
    deletedAt: null,
  };

  await database.runAsync(
    `
      INSERT INTO ingredients (
        id, business_id, name, default_unit, category, low_stock_threshold,
        is_active, created_at, updated_at, sync_status, deleted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      ingredient.id,
      ingredient.businessId,
      ingredient.name,
      ingredient.defaultUnit,
      ingredient.category,
      ingredient.lowStockThreshold,
      toInteger(ingredient.isActive),
      ingredient.createdAt,
      ingredient.updatedAt,
      ingredient.syncStatus,
      ingredient.deletedAt,
    ],
  );

  return ingredient;
}

export async function getIngredientById(id: string, db?: RepositoryDatabase) {
  const row = await getRepositoryDatabase(db).getFirstAsync<IngredientRow>(
    "SELECT * FROM ingredients WHERE id = ? AND deleted_at IS NULL",
    [id],
  );
  return row ? mapIngredient(row) : null;
}

export async function findIngredientByName(businessId: string, name: string, db?: RepositoryDatabase) {
  const row = await getRepositoryDatabase(db).getFirstAsync<IngredientRow>(
    `
      SELECT * FROM ingredients
      WHERE business_id = ? AND LOWER(name) = LOWER(?) AND deleted_at IS NULL
      LIMIT 1
    `,
    [businessId, name.trim()],
  );
  return row ? mapIngredient(row) : null;
}

export async function listIngredientsForBusiness(businessId: string, db?: RepositoryDatabase) {
  const rows = await getRepositoryDatabase(db).getAllAsync<IngredientRow>(
    "SELECT * FROM ingredients WHERE business_id = ? AND deleted_at IS NULL ORDER BY name COLLATE NOCASE ASC",
    [businessId],
  );
  return rows.map(mapIngredient);
}

export async function searchIngredientsByName(businessId: string, query: string, db?: RepositoryDatabase) {
  const rows = await getRepositoryDatabase(db).getAllAsync<IngredientRow>(
    `
      SELECT * FROM ingredients
      WHERE business_id = ? AND deleted_at IS NULL AND name LIKE ? COLLATE NOCASE
      ORDER BY name COLLATE NOCASE ASC
    `,
    [businessId, `%${query.trim()}%`],
  );
  return rows.map(mapIngredient);
}

export async function updateIngredient(id: string, input: UpdateIngredientInput, db?: RepositoryDatabase) {
  const existing = await getIngredientById(id, db);
  if (!existing) {
    throw new Error("Ingredient not found.");
  }

  const parsed = updateIngredientSchema.parse(input);
  const database = getRepositoryDatabase(db);
  const updatedAt = nowIso();
  const ingredient: Ingredient = {
    ...existing,
    name: parsed.name?.trim() || existing.name,
    defaultUnit: parsed.defaultUnit ?? existing.defaultUnit,
    category: parsed.category ?? existing.category,
    lowStockThreshold: parsed.lowStockThreshold ?? existing.lowStockThreshold,
    isActive: parsed.isActive ?? existing.isActive,
    updatedAt,
    syncStatus: "local",
  };

  await database.runAsync(
    `
      UPDATE ingredients
      SET name = ?, default_unit = ?, category = ?, low_stock_threshold = ?,
        is_active = ?, updated_at = ?, sync_status = ?
      WHERE id = ? AND deleted_at IS NULL
    `,
    [
      ingredient.name,
      ingredient.defaultUnit,
      ingredient.category,
      ingredient.lowStockThreshold,
      toInteger(ingredient.isActive),
      ingredient.updatedAt,
      ingredient.syncStatus,
      ingredient.id,
    ],
  );

  return ingredient;
}

export async function countIngredients(db?: RepositoryDatabase) {
  const row = await getRepositoryDatabase(db).getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) AS count FROM ingredients WHERE deleted_at IS NULL",
  );
  return row?.count ?? 0;
}
