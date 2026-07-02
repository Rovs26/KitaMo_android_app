import { openKitamoDatabase } from "@/db/client";
import { runMigrations } from "@/db/migrations";
import type { LocalDataCounts } from "@/db/schema";
import { getLocalDataCounts, type RepositoryDatabase } from "@/db/repositories";
import { buildReceiptText } from "@/domain/receipts";
import {
  makeMovementId,
  makeQueueItemId,
  makeReceiptId,
  makeSaleId,
  makeSaleItemId,
} from "@/domain/ids";
import type { Branch, Business, PaymentMethod, Product } from "@/domain/types";
import type { KioskCartItem } from "@/state/kioskStore";

import { loadOwnerSetupStatus } from "./ownerSetup";

export type KioskContext = {
  dbReady: boolean;
  activeBusiness: Business | null;
  activeBranch: Branch | null;
  products: Product[];
  canOpenKiosk: boolean;
  setupMessage: string | null;
  pendingQueueCount: number;
  mode: "fresh" | "demo";
  counts: LocalDataCounts;
};

export type CompleteKioskSaleInput = {
  cartItems: KioskCartItem[];
  paymentMethod: PaymentMethod;
  externalReferenceNumber?: string | null;
  discountAmount?: number;
};

export type CompletedKioskSale = {
  saleId: string;
  transactionNo: string;
  receiptText: string;
  total: number;
  subtotal: number;
  discount: number;
};

export type KioskOrderSummary = {
  id: string;
  transactionNo: string;
  happenedAt: string;
  amount: number;
  discount: number;
  paymentMethod: PaymentMethod;
  externalReferenceNumber: string | null;
  itemCount: number;
  receiptText: string | null;
};

export type KioskShiftSummary = {
  salesCount: number;
  grossSales: number;
  cashTotal: number;
  gcashTotal: number;
  mayaTotal: number;
  bankTransferTotal: number;
  otherTotal: number;
  pendingQueueCount: number;
};

type PendingQueueCountRow = {
  count: number;
};

type OrderSummaryRow = {
  id: string;
  transaction_no: string;
  happened_at: string;
  amount: number;
  discount: number;
  payment_method: PaymentMethod;
  external_reference_number: string | null;
  item_count: number;
  receipt_text: string | null;
};

type ShiftSummaryRow = {
  sales_count: number;
  gross_sales: number | null;
  cash_total: number | null;
  gcash_total: number | null;
  maya_total: number | null;
  bank_transfer_total: number | null;
  other_total: number | null;
};

function createTransactionNo(saleId: string, happenedAt: string) {
  const datePart = happenedAt.slice(0, 10).replaceAll("-", "");
  const shortId = saleId.slice(-6).toUpperCase();
  return `KTM-${datePart}-${shortId}`;
}

function getSubtotal(cartItems: KioskCartItem[]) {
  return cartItems.reduce((total, item) => total + item.unitPrice * item.quantity, 0);
}

async function countPendingQueue(db: RepositoryDatabase) {
  const row = await db.getFirstAsync<PendingQueueCountRow>(
    "SELECT COUNT(*) AS count FROM offline_queue WHERE status = 'pending' AND deleted_at IS NULL",
  );
  return row?.count ?? 0;
}

export async function loadKioskContext(db: RepositoryDatabase = openKitamoDatabase()): Promise<KioskContext> {
  const status = await loadOwnerSetupStatus(db);
  const activeBranchId = status.activeBranch?.id ?? null;
  const products = activeBranchId
    ? status.products.filter((product) => product.branchId === activeBranchId || product.branchId === null)
    : [];

  let setupMessage: string | null = null;
  if (!status.activeBusiness) {
    setupMessage = "Create your business profile in Owner Settings first.";
  } else if (!status.activeBranch) {
    setupMessage = "Add a store or stall in Owner Settings first.";
  } else if (products.length === 0) {
    setupMessage = "Add products in Owner Inventory first.";
  }

  return {
    dbReady: status.dbReady,
    activeBusiness: status.activeBusiness,
    activeBranch: status.activeBranch,
    products,
    canOpenKiosk: Boolean(status.activeBusiness && status.activeBranch && products.length > 0),
    setupMessage,
    pendingQueueCount: status.pendingQueueCount,
    mode: status.mode,
    counts: status.counts,
  };
}

export async function completeKioskSale(
  input: CompleteKioskSaleInput,
  db: RepositoryDatabase = openKitamoDatabase(),
): Promise<CompletedKioskSale> {
  await runMigrations(db);

  if (input.cartItems.length === 0) {
    throw new Error("Cart is empty.");
  }

  if (input.paymentMethod !== "cash" && !input.externalReferenceNumber?.trim()) {
    throw new Error("Reference number is required for non-cash payments.");
  }

  const context = await loadKioskContext(db);
  if (!context.activeBusiness || !context.activeBranch) {
    throw new Error("Kiosk needs an active business and stall before checkout.");
  }
  const activeBusiness = context.activeBusiness;
  const activeBranch = context.activeBranch;

  const subtotal = getSubtotal(input.cartItems);
  const discount = Math.max(0, input.discountAmount ?? 0);
  if (discount > subtotal) {
    throw new Error("Discount cannot be greater than the cart subtotal.");
  }

  const total = subtotal - discount;
  const saleId = makeSaleId();
  const happenedAt = new Date().toISOString();
  const transactionNo = createTransactionNo(saleId, happenedAt);
  const receiptText = buildReceiptText({
    businessName: activeBusiness.businessName,
    branchName: activeBranch.branchName,
    saleId,
    transactionNo,
    happenedAt,
    items: input.cartItems.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.quantity * item.unitPrice,
    })),
    subtotal,
    discount,
    total,
    paymentMethod: input.paymentMethod,
    externalReferenceNumber: input.externalReferenceNumber?.trim() || null,
  });
  let completedSale: CompletedKioskSale | null = null;
  const timestamp = happenedAt;

  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync(
      `
        INSERT INTO sales (
          id, business_id, branch_id, transaction_no, happened_at, amount, discount,
          payment_method, payment_status, external_reference_number, notes,
          created_at, updated_at, sync_status, deleted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        saleId,
        activeBusiness.id,
        activeBranch.id,
        transactionNo,
        happenedAt,
        total,
        discount,
        input.paymentMethod,
        "paid",
        input.externalReferenceNumber?.trim() || null,
        "Created from Android Kiosk local checkout.",
        timestamp,
        timestamp,
        "local",
        null,
      ],
    );

    for (const item of input.cartItems) {
      if (item.quantity <= 0) {
        throw new Error(`${item.name} has an invalid quantity.`);
      }

      const updateResult = await txn.runAsync(
        `
          UPDATE products
          SET stock_qty = stock_qty - ?, updated_at = ?, sync_status = ?
          WHERE id = ? AND business_id = ? AND deleted_at IS NULL AND stock_qty >= ?
        `,
        [item.quantity, timestamp, "local", item.productId, activeBusiness.id, item.quantity],
      );

      if (updateResult.changes !== 1) {
        throw new Error(`${item.name} does not have enough stock for this sale.`);
      }

      await txn.runAsync(
        `
          INSERT INTO sale_items (
            id, sale_id, business_id, branch_id, product_id, name, quantity,
            unit_price, unit_cost, line_total, bundle_applied, discount_amount,
            created_at, updated_at, sync_status, deleted_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          makeSaleItemId(),
          saleId,
          activeBusiness.id,
          activeBranch.id,
          item.productId,
          item.name,
          item.quantity,
          item.unitPrice,
          item.unitCost,
          item.quantity * item.unitPrice,
          0,
          0,
          timestamp,
          timestamp,
          "local",
          null,
        ],
      );

      await txn.runAsync(
        `
          INSERT INTO inventory_movements (
            id, business_id, branch_id, product_id, movement_type, quantity, reason,
            linked_sale_id, unit_cost, total_cost, created_at, updated_at, sync_status, deleted_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          makeMovementId(),
          activeBusiness.id,
          activeBranch.id,
          item.productId,
          "stock_out_sale",
          item.quantity,
          `Kiosk sale ${transactionNo}`,
          saleId,
          item.unitCost,
          item.unitCost * item.quantity,
          timestamp,
          timestamp,
          "local",
          null,
        ],
      );
    }

    await txn.runAsync(
      `
        INSERT INTO receipt_records (
          id, business_id, branch_id, sale_id, transaction_no, receipt_text,
          issued_at, created_at, updated_at, sync_status, deleted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        makeReceiptId(),
        activeBusiness.id,
        activeBranch.id,
        saleId,
        transactionNo,
        receiptText,
        happenedAt,
        timestamp,
        timestamp,
        "local",
        null,
      ],
    );

    await txn.runAsync(
      `
        INSERT INTO offline_queue (
          id, business_id, branch_id, entity_type, entity_id, operation, payload,
          status, attempt_count, last_error, created_at, updated_at, sync_status, deleted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        makeQueueItemId(),
        activeBusiness.id,
        activeBranch.id,
        "sale",
        saleId,
        "create",
        JSON.stringify({
          entityType: "sale",
          operation: "create",
          saleId,
          transactionNo,
          happenedAt,
          total,
        }),
        "pending",
        0,
        null,
        timestamp,
        timestamp,
        "pending",
        null,
      ],
    );

    completedSale = {
      saleId,
      transactionNo,
      receiptText,
      total,
      subtotal,
      discount,
    };
  });

  if (!completedSale) {
    throw new Error("Sale was not completed.");
  }

  return completedSale;
}

export async function listRecentKioskOrders(
  limit = 25,
  db: RepositoryDatabase = openKitamoDatabase(),
): Promise<KioskOrderSummary[]> {
  await runMigrations(db);
  const context = await loadKioskContext(db);
  if (!context.activeBusiness || !context.activeBranch) {
    return [];
  }

  const rows = await db.getAllAsync<OrderSummaryRow>(
    `
      SELECT
        s.id,
        s.transaction_no,
        s.happened_at,
        s.amount,
        s.discount,
        s.payment_method,
        s.external_reference_number,
        COUNT(si.id) AS item_count,
        rr.receipt_text
      FROM sales s
      LEFT JOIN sale_items si ON si.sale_id = s.id AND si.deleted_at IS NULL
      LEFT JOIN receipt_records rr ON rr.sale_id = s.id AND rr.deleted_at IS NULL
      WHERE s.business_id = ? AND s.branch_id = ? AND s.deleted_at IS NULL
      GROUP BY s.id
      ORDER BY s.happened_at DESC
      LIMIT ?
    `,
    [context.activeBusiness.id, context.activeBranch.id, limit],
  );

  return rows.map((row) => ({
    id: row.id,
    transactionNo: row.transaction_no,
    happenedAt: row.happened_at,
    amount: row.amount,
    discount: row.discount,
    paymentMethod: row.payment_method,
    externalReferenceNumber: row.external_reference_number,
    itemCount: row.item_count,
    receiptText: row.receipt_text,
  }));
}

export async function getKioskShiftSummary(db: RepositoryDatabase = openKitamoDatabase()): Promise<KioskShiftSummary> {
  await runMigrations(db);
  const context = await loadKioskContext(db);
  const pendingQueueCount = await countPendingQueue(db);

  if (!context.activeBusiness || !context.activeBranch) {
    return {
      salesCount: 0,
      grossSales: 0,
      cashTotal: 0,
      gcashTotal: 0,
      mayaTotal: 0,
      bankTransferTotal: 0,
      otherTotal: 0,
      pendingQueueCount,
    };
  }

  const row = await db.getFirstAsync<ShiftSummaryRow>(
    `
      SELECT
        COUNT(*) AS sales_count,
        COALESCE(SUM(amount), 0) AS gross_sales,
        COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN amount ELSE 0 END), 0) AS cash_total,
        COALESCE(SUM(CASE WHEN payment_method = 'GCash' THEN amount ELSE 0 END), 0) AS gcash_total,
        COALESCE(SUM(CASE WHEN payment_method = 'Maya' THEN amount ELSE 0 END), 0) AS maya_total,
        COALESCE(SUM(CASE WHEN payment_method = 'bank transfer' THEN amount ELSE 0 END), 0) AS bank_transfer_total,
        COALESCE(SUM(CASE WHEN payment_method = 'other' THEN amount ELSE 0 END), 0) AS other_total
      FROM sales
      WHERE business_id = ? AND branch_id = ? AND deleted_at IS NULL
    `,
    [context.activeBusiness.id, context.activeBranch.id],
  );

  return {
    salesCount: row?.sales_count ?? 0,
    grossSales: row?.gross_sales ?? 0,
    cashTotal: row?.cash_total ?? 0,
    gcashTotal: row?.gcash_total ?? 0,
    mayaTotal: row?.maya_total ?? 0,
    bankTransferTotal: row?.bank_transfer_total ?? 0,
    otherTotal: row?.other_total ?? 0,
    pendingQueueCount,
  };
}

export async function getKioskCounts(db: RepositoryDatabase = openKitamoDatabase()) {
  await runMigrations(db);
  return getLocalDataCounts(db);
}
