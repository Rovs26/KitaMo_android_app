import { z } from "zod";

import { makeReceiptId, makeSaleId, makeSaleItemId } from "@/domain/ids";
import type { PaymentMethod, PaymentStatus, Sale, SaleItem, SyncStatus } from "@/domain/types";

import { getRepositoryDatabase, nowIso, toInteger, type RepositoryDatabase } from "./shared";

const saleItemInputSchema = z.object({
  id: z.string().optional(),
  productId: z.string().nullable().optional(),
  name: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
  unitCost: z.number().nonnegative().default(0),
  lineTotal: z.number().nonnegative(),
  bundleApplied: z.boolean().default(false),
  discountAmount: z.number().nonnegative().default(0),
});

const createSaleSchema = z.object({
  id: z.string().optional(),
  businessId: z.string().min(1),
  branchId: z.string().nullable().optional(),
  transactionNo: z.string().min(1),
  happenedAt: z.string().optional(),
  amount: z.number().nonnegative(),
  discount: z.number().nonnegative().default(0),
  paymentMethod: z.string().default("cash"),
  paymentStatus: z.string().default("paid"),
  externalReferenceNumber: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  items: z.array(saleItemInputSchema).default([]),
  receiptText: z.string().nullable().optional(),
});

export type CreateSaleInput = z.input<typeof createSaleSchema>;

type SaleRow = {
  id: string;
  business_id: string;
  branch_id: string | null;
  transaction_no: string;
  happened_at: string;
  amount: number;
  discount: number;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  external_reference_number: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  sync_status: SyncStatus;
  deleted_at: string | null;
};

function mapSale(row: SaleRow): Sale {
  return {
    id: row.id,
    businessId: row.business_id,
    branchId: row.branch_id,
    transactionNo: row.transaction_no,
    happenedAt: row.happened_at,
    amount: row.amount,
    discount: row.discount,
    paymentMethod: row.payment_method,
    paymentStatus: row.payment_status,
    externalReferenceNumber: row.external_reference_number,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncStatus: row.sync_status,
    deletedAt: row.deleted_at,
  };
}

export async function createSale(input: CreateSaleInput, db?: RepositoryDatabase) {
  const parsed = createSaleSchema.parse(input);
  const database = getRepositoryDatabase(db);
  const createdAt = nowIso();
  const sale: Sale = {
    id: parsed.id ?? makeSaleId(),
    businessId: parsed.businessId,
    branchId: parsed.branchId ?? null,
    transactionNo: parsed.transactionNo,
    happenedAt: parsed.happenedAt ?? createdAt,
    amount: parsed.amount,
    discount: parsed.discount,
    paymentMethod: parsed.paymentMethod as PaymentMethod,
    paymentStatus: parsed.paymentStatus as PaymentStatus,
    externalReferenceNumber: parsed.externalReferenceNumber ?? null,
    notes: parsed.notes ?? null,
    createdAt,
    updatedAt: createdAt,
    syncStatus: "local",
    deletedAt: null,
  };

  await database.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync(
      `
        INSERT INTO sales (
          id, business_id, branch_id, transaction_no, happened_at, amount, discount,
          payment_method, payment_status, external_reference_number, notes,
          created_at, updated_at, sync_status, deleted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        sale.id,
        sale.businessId,
        sale.branchId,
        sale.transactionNo,
        sale.happenedAt,
        sale.amount,
        sale.discount,
        sale.paymentMethod,
        sale.paymentStatus,
        sale.externalReferenceNumber,
        sale.notes,
        sale.createdAt,
        sale.updatedAt,
        sale.syncStatus,
        sale.deletedAt,
      ],
    );

    for (const itemInput of parsed.items) {
      const item: SaleItem = {
        id: itemInput.id ?? makeSaleItemId(),
        saleId: sale.id,
        businessId: sale.businessId,
        branchId: sale.branchId,
        productId: itemInput.productId ?? null,
        name: itemInput.name,
        quantity: itemInput.quantity,
        unitPrice: itemInput.unitPrice,
        unitCost: itemInput.unitCost,
        lineTotal: itemInput.lineTotal,
        bundleApplied: itemInput.bundleApplied,
        discountAmount: itemInput.discountAmount,
        cogsTotal: itemInput.unitCost * itemInput.quantity,
        cogsPerUnit: itemInput.unitCost,
        cogsSource: "simple",
        cogsIsEstimated: false,
        relatedRecipeId: null,
        createdAt,
        updatedAt: createdAt,
        syncStatus: "local",
        deletedAt: null,
      };

      await txn.runAsync(
        `
          INSERT INTO sale_items (
            id, sale_id, business_id, branch_id, product_id, name, quantity,
            unit_price, unit_cost, line_total, bundle_applied, discount_amount,
            cogs_total, cogs_per_unit, cogs_source, cogs_is_estimated, related_recipe_id,
            created_at, updated_at, sync_status, deleted_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          item.id,
          item.saleId,
          item.businessId,
          item.branchId,
          item.productId,
          item.name,
          item.quantity,
          item.unitPrice,
          item.unitCost,
          item.lineTotal,
          toInteger(item.bundleApplied),
          item.discountAmount,
          item.cogsTotal,
          item.cogsPerUnit,
          item.cogsSource,
          toInteger(item.cogsIsEstimated),
          item.relatedRecipeId,
          item.createdAt,
          item.updatedAt,
          item.syncStatus,
          item.deletedAt,
        ],
      );
    }

    if (parsed.receiptText) {
      await txn.runAsync(
        `
          INSERT INTO receipt_records (
            id, business_id, branch_id, sale_id, transaction_no, receipt_text,
            issued_at, created_at, updated_at, sync_status, deleted_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          makeReceiptId(),
          sale.businessId,
          sale.branchId,
          sale.id,
          sale.transactionNo,
          parsed.receiptText,
          sale.happenedAt,
          createdAt,
          createdAt,
          "local",
          null,
        ],
      );
    }
  });

  return sale;
}

export async function listSalesForBusiness(businessId: string, db?: RepositoryDatabase) {
  const rows = await getRepositoryDatabase(db).getAllAsync<SaleRow>(
    "SELECT * FROM sales WHERE business_id = ? AND deleted_at IS NULL ORDER BY happened_at DESC",
    [businessId],
  );
  return rows.map(mapSale);
}

export async function countSales(db?: RepositoryDatabase) {
  const row = await getRepositoryDatabase(db).getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) AS count FROM sales WHERE deleted_at IS NULL",
  );
  return row?.count ?? 0;
}
