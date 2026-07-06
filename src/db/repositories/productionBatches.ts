import type { IngredientUnit, ProductionBatch, ProductionIngredientUsage, SyncStatus } from "@/domain/types";

import { getRepositoryDatabase, toBoolean, type RepositoryDatabase } from "./shared";

type ProductionBatchRow = {
  id: string;
  business_id: string;
  branch_id: string | null;
  recipe_id: string | null;
  output_product_id: string | null;
  recipe_name: string;
  output_quantity: number;
  output_unit: IngredientUnit;
  batch_multiplier: number;
  total_batch_cost: number;
  cost_per_output_unit: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  sync_status: SyncStatus;
  deleted_at: string | null;
};

export type ProductionBatchWithNames = ProductionBatch & {
  branchName: string | null;
  outputProductName: string | null;
};

type ProductionBatchWithNamesRow = ProductionBatchRow & {
  branch_name: string | null;
  output_product_name: string | null;
};

type ProductionUsageRow = {
  id: string;
  business_id: string;
  production_batch_id: string;
  ingredient_id: string | null;
  ingredient_lot_id: string | null;
  quantity_used: number;
  unit: IngredientUnit;
  line_cost: number;
  source_label_snapshot: string | null;
  is_custom: number;
  created_at: string;
  updated_at: string;
  sync_status: SyncStatus;
  deleted_at: string | null;
};

function mapProductionBatch(row: ProductionBatchRow): ProductionBatch {
  return {
    id: row.id,
    businessId: row.business_id,
    branchId: row.branch_id,
    recipeId: row.recipe_id,
    outputProductId: row.output_product_id,
    recipeName: row.recipe_name,
    outputQuantity: row.output_quantity,
    outputUnit: row.output_unit,
    batchMultiplier: row.batch_multiplier,
    totalBatchCost: row.total_batch_cost,
    costPerOutputUnit: row.cost_per_output_unit,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncStatus: row.sync_status,
    deletedAt: row.deleted_at,
  };
}

function mapProductionUsage(row: ProductionUsageRow): ProductionIngredientUsage {
  return {
    id: row.id,
    businessId: row.business_id,
    productionBatchId: row.production_batch_id,
    ingredientId: row.ingredient_id,
    ingredientLotId: row.ingredient_lot_id,
    quantityUsed: row.quantity_used,
    unit: row.unit,
    lineCost: row.line_cost,
    sourceLabelSnapshot: row.source_label_snapshot,
    isCustom: toBoolean(row.is_custom),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncStatus: row.sync_status,
    deletedAt: row.deleted_at,
  };
}

export async function listRecentProductionBatches(
  businessId: string,
  limit = 10,
  db?: RepositoryDatabase,
): Promise<ProductionBatchWithNames[]> {
  const rows = await getRepositoryDatabase(db).getAllAsync<ProductionBatchWithNamesRow>(
    `
      SELECT
        pb.*,
        b.branch_name AS branch_name,
        p.name AS output_product_name
      FROM production_batches pb
      LEFT JOIN branches b ON b.id = pb.branch_id AND b.deleted_at IS NULL
      LEFT JOIN products p ON p.id = pb.output_product_id AND p.deleted_at IS NULL
      WHERE pb.business_id = ? AND pb.deleted_at IS NULL
      ORDER BY pb.created_at DESC
      LIMIT ?
    `,
    [businessId, limit],
  );

  return rows.map((row) => ({
    ...mapProductionBatch(row),
    branchName: row.branch_name,
    outputProductName: row.output_product_name,
  }));
}

export async function listUsagesForProductionBatch(productionBatchId: string, db?: RepositoryDatabase) {
  const rows = await getRepositoryDatabase(db).getAllAsync<ProductionUsageRow>(
    "SELECT * FROM production_ingredient_usages WHERE production_batch_id = ? AND deleted_at IS NULL ORDER BY created_at ASC",
    [productionBatchId],
  );
  return rows.map(mapProductionUsage);
}

export async function getTodayProductionTotals(
  businessId: string,
  startIso: string,
  endIso: string,
  db?: RepositoryDatabase,
) {
  const row = await getRepositoryDatabase(db).getFirstAsync<{
    batch_count: number;
    total_cost: number | null;
    total_output: number | null;
  }>(
    `
      SELECT
        COUNT(*) AS batch_count,
        COALESCE(SUM(total_batch_cost), 0) AS total_cost,
        COALESCE(SUM(output_quantity), 0) AS total_output
      FROM production_batches
      WHERE business_id = ? AND created_at >= ? AND created_at < ? AND deleted_at IS NULL
    `,
    [businessId, startIso, endIso],
  );

  return {
    batchCount: row?.batch_count ?? 0,
    totalCost: row?.total_cost ?? 0,
    totalOutput: row?.total_output ?? 0,
  };
}

export async function countProductionBatches(db?: RepositoryDatabase) {
  const row = await getRepositoryDatabase(db).getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) AS count FROM production_batches WHERE deleted_at IS NULL",
  );
  return row?.count ?? 0;
}
