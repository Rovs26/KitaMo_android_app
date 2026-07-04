import { openKitamoDatabase } from "@/db/client";
import { runMigrations } from "@/db/migrations";
import { countActiveOwnerAlerts, type RepositoryDatabase } from "@/db/repositories";
import type { PaymentMethod, Product, UnitType } from "@/domain/types";

import { loadOwnerSetupStatus, type OwnerSetupMode } from "./ownerSetup";

export type SalesRecordFilter = "today" | "all" | "cash" | "digital";

export type TodaySalesSummary = {
  salesTotal: number;
  transactionCount: number;
  averageSale: number;
};

export type RecordsSummary = TodaySalesSummary & {
  totalReceipts: number;
  pendingQueueCount: number;
};

export type LowStockSummary = {
  productCount: number;
  lowStockCount: number;
  products: Product[];
};

export type PaymentBreakdownItem = {
  method: PaymentMethod;
  label: string;
  total: number;
  count: number;
};

export type TopProductSummary = {
  productId: string | null;
  name: string;
  quantitySold: number;
  salesAmount: number;
};

export type LocalSaleRecord = {
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

export type LocalInventoryMovementRecord = {
  id: string;
  productName: string;
  unitType: UnitType | null;
  movementType: string;
  quantity: number;
  reason: string;
  linkedSaleId: string | null;
  createdAt: string;
};

export type LocalAnalyticsSnapshot = {
  mode: OwnerSetupMode;
  hasBusiness: boolean;
  businessName: string | null;
  branchName: string | null;
  today: TodaySalesSummary;
  recordsSummary: RecordsSummary;
  lowStock: LowStockSummary;
  paymentBreakdown: PaymentBreakdownItem[];
  topProductByQuantity: TopProductSummary | null;
  topProductBySales: TopProductSummary | null;
  recentSales: LocalSaleRecord[];
  recentMovements: LocalInventoryMovementRecord[];
  pendingQueueCount: number;
  activeAlertCount: number;
};

type CountRow = {
  count: number;
};

type TodaySummaryRow = {
  transaction_count: number;
  sales_total: number | null;
};

type PaymentBreakdownRow = {
  payment_method: PaymentMethod;
  total: number | null;
  count: number;
};

type TopProductRow = {
  product_id: string | null;
  name: string;
  quantity_sold: number | null;
  sales_amount: number | null;
};

type SaleRecordRow = {
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

type MovementRecordRow = {
  id: string;
  product_name: string | null;
  unit_type: UnitType | null;
  movement_type: string;
  quantity: number;
  reason: string;
  linked_sale_id: string | null;
  created_at: string;
};

const paymentLabels: Record<PaymentMethod, string> = {
  cash: "Cash",
  GCash: "GCash",
  Maya: "Maya",
  "bank transfer": "Bank",
  other: "Other",
};

function getTodayBounds() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 1);

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
}

function emptyTodaySummary(): TodaySalesSummary {
  return {
    salesTotal: 0,
    transactionCount: 0,
    averageSale: 0,
  };
}

function mapSaleRecord(row: SaleRecordRow): LocalSaleRecord {
  return {
    id: row.id,
    transactionNo: row.transaction_no,
    happenedAt: row.happened_at,
    amount: row.amount,
    discount: row.discount,
    paymentMethod: row.payment_method,
    externalReferenceNumber: row.external_reference_number,
    itemCount: row.item_count,
    receiptText: row.receipt_text,
  };
}

function mapTopProduct(row: TopProductRow | null | undefined): TopProductSummary | null {
  if (!row) {
    return null;
  }

  return {
    productId: row.product_id,
    name: row.name,
    quantitySold: row.quantity_sold ?? 0,
    salesAmount: row.sales_amount ?? 0,
  };
}

function mapMovement(row: MovementRecordRow): LocalInventoryMovementRecord {
  return {
    id: row.id,
    productName: row.product_name ?? "Unknown product",
    unitType: row.unit_type,
    movementType: row.movement_type,
    quantity: row.quantity,
    reason: row.reason,
    linkedSaleId: row.linked_sale_id,
    createdAt: row.created_at,
  };
}

export async function getPendingQueueCount(db: RepositoryDatabase = openKitamoDatabase()) {
  await runMigrations(db);
  const row = await db.getFirstAsync<CountRow>(
    "SELECT COUNT(*) AS count FROM offline_queue WHERE status = 'pending' AND deleted_at IS NULL",
  );
  return row?.count ?? 0;
}

export async function getTodaySalesSummary(
  businessId?: string | null,
  db: RepositoryDatabase = openKitamoDatabase(),
): Promise<TodaySalesSummary> {
  await runMigrations(db);

  if (!businessId) {
    return emptyTodaySummary();
  }

  const { startIso, endIso } = getTodayBounds();
  const row = await db.getFirstAsync<TodaySummaryRow>(
    `
      SELECT
        COUNT(*) AS transaction_count,
        COALESCE(SUM(amount), 0) AS sales_total
      FROM sales
      WHERE business_id = ? AND happened_at >= ? AND happened_at < ? AND deleted_at IS NULL
    `,
    [businessId, startIso, endIso],
  );

  const transactionCount = row?.transaction_count ?? 0;
  const salesTotal = row?.sales_total ?? 0;

  return {
    transactionCount,
    salesTotal,
    averageSale: transactionCount > 0 ? salesTotal / transactionCount : 0,
  };
}

export async function getRecordsSummary(
  businessId?: string | null,
  db: RepositoryDatabase = openKitamoDatabase(),
): Promise<RecordsSummary> {
  await runMigrations(db);
  const today = await getTodaySalesSummary(businessId, db);
  const totalReceipts = businessId
    ? (
        await db.getFirstAsync<CountRow>(
          "SELECT COUNT(*) AS count FROM receipt_records WHERE business_id = ? AND deleted_at IS NULL",
          [businessId],
        )
      )?.count ?? 0
    : 0;

  return {
    ...today,
    totalReceipts,
    pendingQueueCount: await getPendingQueueCount(db),
  };
}

export function getLowStockSummary(products: Product[]): LowStockSummary {
  const activeProducts = products.filter((product) => product.active && product.deletedAt === null);
  const lowStockProducts = activeProducts.filter((product) => product.stockQty <= product.lowStockThreshold);

  return {
    productCount: activeProducts.length,
    lowStockCount: lowStockProducts.length,
    products: lowStockProducts,
  };
}

export async function getPaymentBreakdown(
  businessId?: string | null,
  db: RepositoryDatabase = openKitamoDatabase(),
): Promise<PaymentBreakdownItem[]> {
  await runMigrations(db);

  if (!businessId) {
    return [];
  }

  const { startIso, endIso } = getTodayBounds();
  const rows = await db.getAllAsync<PaymentBreakdownRow>(
    `
      SELECT payment_method, COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count
      FROM sales
      WHERE business_id = ? AND happened_at >= ? AND happened_at < ? AND deleted_at IS NULL
      GROUP BY payment_method
      ORDER BY total DESC
    `,
    [businessId, startIso, endIso],
  );

  return rows.map((row) => ({
    method: row.payment_method,
    label: paymentLabels[row.payment_method] ?? row.payment_method,
    total: row.total ?? 0,
    count: row.count,
  }));
}

export async function getTopProducts(
  businessId?: string | null,
  db: RepositoryDatabase = openKitamoDatabase(),
) {
  await runMigrations(db);

  if (!businessId) {
    return {
      byQuantity: null,
      bySales: null,
    };
  }

  const baseQuery = `
    FROM sale_items si
    JOIN sales s ON s.id = si.sale_id AND s.deleted_at IS NULL
    WHERE si.business_id = ? AND si.deleted_at IS NULL
    GROUP BY si.product_id, si.name
  `;

  const byQuantity = await db.getFirstAsync<TopProductRow>(
    `
      SELECT
        si.product_id,
        si.name,
        COALESCE(SUM(si.quantity), 0) AS quantity_sold,
        COALESCE(SUM(si.line_total), 0) AS sales_amount
      ${baseQuery}
      ORDER BY quantity_sold DESC, sales_amount DESC
      LIMIT 1
    `,
    [businessId],
  );

  const bySales = await db.getFirstAsync<TopProductRow>(
    `
      SELECT
        si.product_id,
        si.name,
        COALESCE(SUM(si.quantity), 0) AS quantity_sold,
        COALESCE(SUM(si.line_total), 0) AS sales_amount
      ${baseQuery}
      ORDER BY sales_amount DESC, quantity_sold DESC
      LIMIT 1
    `,
    [businessId],
  );

  return {
    byQuantity: mapTopProduct(byQuantity),
    bySales: mapTopProduct(bySales),
  };
}

function salesFilterSql(filter: SalesRecordFilter) {
  const { startIso, endIso } = getTodayBounds();

  if (filter === "today") {
    return {
      sql: "AND s.happened_at >= ? AND s.happened_at < ?",
      params: [startIso, endIso],
    };
  }

  if (filter === "cash") {
    return {
      sql: "AND s.payment_method = ?",
      params: ["cash"],
    };
  }

  if (filter === "digital") {
    return {
      sql: "AND s.payment_method IN ('GCash', 'Maya', 'bank transfer')",
      params: [],
    };
  }

  return {
    sql: "",
    params: [],
  };
}

export async function listLocalSaleRecords(
  filter: SalesRecordFilter = "today",
  businessId?: string | null,
  db: RepositoryDatabase = openKitamoDatabase(),
): Promise<LocalSaleRecord[]> {
  await runMigrations(db);

  if (!businessId) {
    return [];
  }

  const filterSql = salesFilterSql(filter);
  const rows = await db.getAllAsync<SaleRecordRow>(
    `
      SELECT
        s.id,
        s.transaction_no,
        s.happened_at,
        s.amount,
        s.discount,
        s.payment_method,
        s.external_reference_number,
        COUNT(DISTINCT si.id) AS item_count,
        MAX(rr.receipt_text) AS receipt_text
      FROM sales s
      LEFT JOIN sale_items si ON si.sale_id = s.id AND si.deleted_at IS NULL
      LEFT JOIN receipt_records rr ON rr.sale_id = s.id AND rr.deleted_at IS NULL
      WHERE s.business_id = ? AND s.deleted_at IS NULL ${filterSql.sql}
      GROUP BY s.id
      ORDER BY s.happened_at DESC
      LIMIT 100
    `,
    [businessId, ...filterSql.params],
  );

  return rows.map(mapSaleRecord);
}

export async function listRecentInventoryMovements(
  businessId?: string | null,
  db: RepositoryDatabase = openKitamoDatabase(),
): Promise<LocalInventoryMovementRecord[]> {
  await runMigrations(db);

  if (!businessId) {
    return [];
  }

  const rows = await db.getAllAsync<MovementRecordRow>(
    `
      SELECT
        im.id,
        p.name AS product_name,
        p.unit_type,
        im.movement_type,
        im.quantity,
        im.reason,
        im.linked_sale_id,
        im.created_at
      FROM inventory_movements im
      LEFT JOIN products p ON p.id = im.product_id AND p.deleted_at IS NULL
      WHERE im.business_id = ? AND im.deleted_at IS NULL
      ORDER BY im.created_at DESC
      LIMIT 20
    `,
    [businessId],
  );

  return rows.map(mapMovement);
}

export async function getLocalAnalyticsSnapshot(
  filter: SalesRecordFilter = "today",
  db: RepositoryDatabase = openKitamoDatabase(),
): Promise<LocalAnalyticsSnapshot> {
  const status = await loadOwnerSetupStatus(db);
  const businessId = status.activeBusiness?.id ?? null;
  const today = await getTodaySalesSummary(businessId, db);
  const recordsSummary = await getRecordsSummary(businessId, db);
  const paymentBreakdown = await getPaymentBreakdown(businessId, db);
  const topProducts = await getTopProducts(businessId, db);
  const recentSales = await listLocalSaleRecords(filter, businessId, db);
  const recentMovements = await listRecentInventoryMovements(businessId, db);
  const activeAlertCount = businessId ? await countActiveOwnerAlerts(businessId, db) : 0;

  return {
    mode: status.mode,
    hasBusiness: Boolean(status.activeBusiness),
    businessName: status.activeBusiness?.businessName ?? null,
    branchName: status.activeBranch?.branchName ?? null,
    today,
    recordsSummary,
    lowStock: getLowStockSummary(status.products),
    paymentBreakdown,
    topProductByQuantity: topProducts.byQuantity,
    topProductBySales: topProducts.bySales,
    recentSales,
    recentMovements,
    pendingQueueCount: recordsSummary.pendingQueueCount,
    activeAlertCount,
  };
}
