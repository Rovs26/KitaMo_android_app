import { z } from "zod";

import { makeMovementId } from "@/domain/ids";
import type { InventoryMovement, InventoryMovementType, SyncStatus } from "@/domain/types";

import { getRepositoryDatabase, nowIso, type RepositoryDatabase } from "./shared";

const createInventoryMovementSchema = z.object({
  id: z.string().optional(),
  businessId: z.string().min(1),
  branchId: z.string().nullable().optional(),
  productId: z.string().nullable().optional(),
  movementType: z.string().min(1),
  quantity: z.number(),
  reason: z.string().min(1),
  linkedSaleId: z.string().nullable().optional(),
  unitCost: z.number().nullable().optional(),
  totalCost: z.number().nullable().optional(),
});

export type CreateInventoryMovementInput = z.input<typeof createInventoryMovementSchema>;

type InventoryMovementRow = {
  id: string;
  business_id: string;
  branch_id: string | null;
  product_id: string | null;
  movement_type: InventoryMovementType;
  quantity: number;
  reason: string;
  linked_sale_id: string | null;
  unit_cost: number | null;
  total_cost: number | null;
  created_at: string;
  updated_at: string;
  sync_status: SyncStatus;
  deleted_at: string | null;
};

function mapInventoryMovement(row: InventoryMovementRow): InventoryMovement {
  return {
    id: row.id,
    businessId: row.business_id,
    branchId: row.branch_id,
    productId: row.product_id,
    movementType: row.movement_type,
    quantity: row.quantity,
    reason: row.reason,
    linkedSaleId: row.linked_sale_id,
    unitCost: row.unit_cost,
    totalCost: row.total_cost,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncStatus: row.sync_status,
    deletedAt: row.deleted_at,
  };
}

export async function createInventoryMovement(input: CreateInventoryMovementInput, db?: RepositoryDatabase) {
  const parsed = createInventoryMovementSchema.parse(input);
  const database = getRepositoryDatabase(db);
  const createdAt = nowIso();
  const movement: InventoryMovement = {
    id: parsed.id ?? makeMovementId(),
    businessId: parsed.businessId,
    branchId: parsed.branchId ?? null,
    productId: parsed.productId ?? null,
    movementType: parsed.movementType as InventoryMovementType,
    quantity: parsed.quantity,
    reason: parsed.reason,
    linkedSaleId: parsed.linkedSaleId ?? null,
    unitCost: parsed.unitCost ?? null,
    totalCost: parsed.totalCost ?? null,
    createdAt,
    updatedAt: createdAt,
    syncStatus: "local",
    deletedAt: null,
  };

  await database.runAsync(
    `
      INSERT INTO inventory_movements (
        id, business_id, branch_id, product_id, movement_type, quantity, reason,
        linked_sale_id, unit_cost, total_cost, created_at, updated_at, sync_status, deleted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      movement.id,
      movement.businessId,
      movement.branchId,
      movement.productId,
      movement.movementType,
      movement.quantity,
      movement.reason,
      movement.linkedSaleId,
      movement.unitCost,
      movement.totalCost,
      movement.createdAt,
      movement.updatedAt,
      movement.syncStatus,
      movement.deletedAt,
    ],
  );

  return movement;
}

export async function listInventoryMovementsForBusiness(businessId: string, db?: RepositoryDatabase) {
  const rows = await getRepositoryDatabase(db).getAllAsync<InventoryMovementRow>(
    "SELECT * FROM inventory_movements WHERE business_id = ? AND deleted_at IS NULL ORDER BY created_at DESC",
    [businessId],
  );
  return rows.map(mapInventoryMovement);
}

export async function countInventoryMovements(db?: RepositoryDatabase) {
  const row = await getRepositoryDatabase(db).getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) AS count FROM inventory_movements WHERE deleted_at IS NULL",
  );
  return row?.count ?? 0;
}
