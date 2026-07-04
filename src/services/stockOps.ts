import { openKitamoDatabase } from "@/db/client";
import { runMigrations } from "@/db/migrations";
import {
  createOwnerAlert,
  getActiveOwnerAlertForProduct,
  getProductById,
  type RepositoryDatabase,
} from "@/db/repositories";
import { makeBatchId, makeMovementId } from "@/domain/ids";
import type { OwnerAlert } from "@/domain/types";

import { loadOwnerSetupStatus } from "./ownerSetup";

const LOW_STOCK_ALERT_TYPE = "low_stock";

export type NotifyOwnerResult = {
  created: boolean;
  alreadyNotified: boolean;
  alert: OwnerAlert;
};

export type CookBatchInput = {
  productId: string;
  quantity: number;
  note?: string | null;
};

export type SpoilageInput = {
  productId: string;
  quantity: number;
  reason?: string | null;
};

function assertPositiveQuantity(quantity: number, label: string) {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error(`${label} must be greater than zero.`);
  }
}

async function requireActiveContext(db: RepositoryDatabase) {
  const status = await loadOwnerSetupStatus(db);
  if (!status.activeBusiness) {
    throw new Error("Create your business profile in Owner Settings first.");
  }
  return {
    business: status.activeBusiness,
    branch: status.activeBranch,
  };
}

export async function notifyOwnerLowStock(
  productId: string,
  source = "kiosk_stock",
  db: RepositoryDatabase = openKitamoDatabase(),
): Promise<NotifyOwnerResult> {
  await runMigrations(db);
  const { business, branch } = await requireActiveContext(db);

  const product = await getProductById(productId, db);
  if (!product || product.businessId !== business.id) {
    throw new Error("Product not found.");
  }

  const existingAlert = await getActiveOwnerAlertForProduct(business.id, product.id, LOW_STOCK_ALERT_TYPE, db);
  if (existingAlert) {
    return {
      created: false,
      alreadyNotified: true,
      alert: existingAlert,
    };
  }

  const outOfStock = product.stockQty <= 0;
  const alert = await createOwnerAlert(
    {
      businessId: business.id,
      branchId: branch?.id ?? product.branchId ?? null,
      productId: product.id,
      alertType: LOW_STOCK_ALERT_TYPE,
      title: outOfStock ? `Out of stock: ${product.name}` : `Low stock: ${product.name}`,
      message: outOfStock
        ? `${product.name} is out of stock at ${business.businessName}.`
        : `${product.name} is running low at ${business.businessName}.`,
      severity: outOfStock ? "critical" : "warning",
      source,
    },
    db,
  );

  return {
    created: true,
    alreadyNotified: false,
    alert,
  };
}

export async function recordCookedBatch(
  input: CookBatchInput,
  db: RepositoryDatabase = openKitamoDatabase(),
) {
  await runMigrations(db);
  assertPositiveQuantity(input.quantity, "Cooked quantity");

  const { business, branch } = await requireActiveContext(db);
  const product = await getProductById(input.productId, db);
  if (!product || product.businessId !== business.id) {
    throw new Error("Product not found.");
  }

  const note = input.note?.trim() || null;
  const timestamp = new Date().toISOString();
  const batchId = makeBatchId();
  const batchCost = product.cost * input.quantity;

  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync(
      `
        INSERT INTO recipe_batches (
          id, business_id, branch_id, recipe_name, batches, expected_servings,
          actual_servings, total_batch_cost, notes, created_at, updated_at, sync_status, deleted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        batchId,
        business.id,
        branch?.id ?? product.branchId ?? null,
        product.name,
        1,
        input.quantity,
        input.quantity,
        batchCost,
        note,
        timestamp,
        timestamp,
        "local",
        null,
      ],
    );

    const updateResult = await txn.runAsync(
      `
        UPDATE products
        SET stock_qty = stock_qty + ?, updated_at = ?, sync_status = 'local'
        WHERE id = ? AND business_id = ? AND deleted_at IS NULL
      `,
      [input.quantity, timestamp, product.id, business.id],
    );

    if (updateResult.changes !== 1) {
      throw new Error("Could not update product stock.");
    }

    await txn.runAsync(
      `
        INSERT INTO inventory_movements (
          id, business_id, branch_id, product_id, movement_type, quantity, reason,
          linked_sale_id, unit_cost, total_cost, created_at, updated_at, sync_status, deleted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        makeMovementId(),
        business.id,
        branch?.id ?? product.branchId ?? null,
        product.id,
        "cooked",
        input.quantity,
        note ? `Niluto / produced: ${note}` : "Niluto / produced",
        null,
        product.cost,
        batchCost,
        timestamp,
        timestamp,
        "local",
        null,
      ],
    );
  });

  return {
    batchId,
    productId: product.id,
    productName: product.name,
    quantity: input.quantity,
    newStockQty: product.stockQty + input.quantity,
  };
}

export async function recordSpoilage(
  input: SpoilageInput,
  db: RepositoryDatabase = openKitamoDatabase(),
) {
  await runMigrations(db);
  assertPositiveQuantity(input.quantity, "Spoilage quantity");

  const { business, branch } = await requireActiveContext(db);
  const product = await getProductById(input.productId, db);
  if (!product || product.businessId !== business.id) {
    throw new Error("Product not found.");
  }

  if (product.stockQty < input.quantity) {
    throw new Error(`Only ${product.stockQty} ${product.unitType} left. Spoilage cannot be more than the current stock.`);
  }

  const reason = input.reason?.trim() || "Nasayang / spoilage";
  const timestamp = new Date().toISOString();
  const lossCost = product.cost * input.quantity;

  await db.withExclusiveTransactionAsync(async (txn) => {
    const updateResult = await txn.runAsync(
      `
        UPDATE products
        SET stock_qty = stock_qty - ?, updated_at = ?, sync_status = 'local'
        WHERE id = ? AND business_id = ? AND deleted_at IS NULL AND stock_qty >= ?
      `,
      [input.quantity, timestamp, product.id, business.id, input.quantity],
    );

    if (updateResult.changes !== 1) {
      throw new Error("Not enough stock to record this spoilage.");
    }

    await txn.runAsync(
      `
        INSERT INTO inventory_movements (
          id, business_id, branch_id, product_id, movement_type, quantity, reason,
          linked_sale_id, unit_cost, total_cost, created_at, updated_at, sync_status, deleted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        makeMovementId(),
        business.id,
        branch?.id ?? product.branchId ?? null,
        product.id,
        "spoilage",
        input.quantity,
        reason,
        null,
        product.cost,
        lossCost,
        timestamp,
        timestamp,
        "local",
        null,
      ],
    );
  });

  return {
    productId: product.id,
    productName: product.name,
    quantity: input.quantity,
    newStockQty: product.stockQty - input.quantity,
  };
}
