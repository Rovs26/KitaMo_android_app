import { openKitamoDatabase } from "@/db/client";
import { runMigrations } from "@/db/migrations";
import { getAverageProducedCostByProduct, type RepositoryDatabase } from "@/db/repositories";
import { grossProfit, netProfit } from "@/domain/profitMath";

import { calculateFixedCostsForRange } from "./fixedCosts";
import { loadGroceryPoolSnapshot } from "./groceryPool";
import { loadOwnerSetupStatus } from "./ownerSetup";

export type ReportRange = "today" | "week" | "month" | "all";

export const reportRanges: { id: ReportRange; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "week", label: "This week" },
  { id: "month", label: "This month" },
  { id: "all", label: "All local" },
];

export type StallReport = {
  branchId: string;
  branchName: string;
  revenue: number;
  transactionCount: number;
  soldCogs: number;
  grossProfit: number;
  fixedCosts: number;
  spoilageLoss: number;
  netProfit: number;
  productionCogs: number;
  unsoldGoodsValue: number;
  transferInValue: number;
  transferOutValue: number;
  estimatedCogsCount: number;
  bestSellerName: string | null;
  bestSellerQuantity: number;
};

export type TopProductEntry = {
  name: string;
  quantity: number;
  salesAmount: number;
};

export type ConsolidatedReport = {
  revenue: number;
  transactionCount: number;
  soldCogs: number;
  grossProfit: number;
  fixedCosts: number;
  spoilageLoss: number;
  netProfit: number;
  unsoldGoodsValue: number;
  groceryRemainingValue: number;
  transferCount: number;
  transferValue: number;
  estimatedCogsCount: number;
  businessWideFixedCosts: number;
  bestStallName: string | null;
  bestProduct: TopProductEntry | null;
  lowStockIngredientCount: number;
  overdueFixedCostCount: number;
};

export type ProfitReport = {
  hasBusiness: boolean;
  range: ReportRange;
  rangeStartIso: string | null;
  stalls: StallReport[];
  consolidated: ConsolidatedReport;
  topProducts: TopProductEntry[];
};

function isoAtLocalMidnight(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function localIsoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/**
 * Range bounds: sales/movements filter on full ISO timestamps; fixed-cost
 * occurrences use local YYYY-MM-DD dates. "week" starts on Monday.
 */
function getRangeBounds(range: ReportRange) {
  const now = new Date();
  const todayStart = isoAtLocalMidnight(now);

  if (range === "all") {
    return { startTimestamp: null, endTimestamp: null, startDate: "2000-01-01", endDate: localIsoDate(now) };
  }

  let start = todayStart;
  if (range === "week") {
    const weekStart = new Date(todayStart);
    const day = weekStart.getDay();
    weekStart.setDate(weekStart.getDate() - ((day + 6) % 7));
    start = weekStart;
  } else if (range === "month") {
    start = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);
  }

  const end = new Date(todayStart);
  end.setDate(end.getDate() + 1);

  return {
    startTimestamp: start.toISOString(),
    endTimestamp: end.toISOString(),
    startDate: localIsoDate(start),
    endDate: localIsoDate(now),
  };
}

function timestampFilter(column: string, startTimestamp: string | null) {
  return startTimestamp ? `AND ${column} >= ? AND ${column} < ?` : "";
}

export async function loadProfitReport(
  range: ReportRange,
  db: RepositoryDatabase = openKitamoDatabase(),
): Promise<ProfitReport> {
  await runMigrations(db);
  const status = await loadOwnerSetupStatus(db);

  const emptyConsolidated: ConsolidatedReport = {
    revenue: 0,
    transactionCount: 0,
    soldCogs: 0,
    grossProfit: 0,
    fixedCosts: 0,
    spoilageLoss: 0,
    netProfit: 0,
    unsoldGoodsValue: 0,
    groceryRemainingValue: 0,
    transferCount: 0,
    transferValue: 0,
    estimatedCogsCount: 0,
    businessWideFixedCosts: 0,
    bestStallName: null,
    bestProduct: null,
    lowStockIngredientCount: 0,
    overdueFixedCostCount: 0,
  };

  if (!status.activeBusiness) {
    return { hasBusiness: false, range, rangeStartIso: null, stalls: [], consolidated: emptyConsolidated, topProducts: [] };
  }

  const businessId = status.activeBusiness.id;
  const bounds = getRangeBounds(range);
  const timeParams = bounds.startTimestamp ? [bounds.startTimestamp, bounds.endTimestamp as string] : [];

  // Revenue + transactions per stall.
  const revenueRows = await db.getAllAsync<{ branch_id: string | null; revenue: number | null; tx_count: number }>(
    `
      SELECT branch_id, COALESCE(SUM(amount), 0) AS revenue, COUNT(*) AS tx_count
      FROM sales
      WHERE business_id = ? AND deleted_at IS NULL ${timestampFilter("happened_at", bounds.startTimestamp)}
      GROUP BY branch_id
    `,
    [businessId, ...timeParams],
  );

  // Sold COGS + estimated flags per stall.
  const cogsRows = await db.getAllAsync<{ branch_id: string | null; sold_cogs: number | null; estimated_count: number }>(
    `
      SELECT s.branch_id, COALESCE(SUM(COALESCE(si.cogs_total, si.unit_cost * si.quantity)), 0) AS sold_cogs,
        COALESCE(SUM(si.cogs_is_estimated), 0) AS estimated_count
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id AND s.deleted_at IS NULL
      WHERE si.business_id = ? AND si.deleted_at IS NULL ${timestampFilter("s.happened_at", bounds.startTimestamp)}
      GROUP BY s.branch_id
    `,
    [businessId, ...timeParams],
  );

  // Spoilage loss per stall.
  const spoilageRows = await db.getAllAsync<{ branch_id: string | null; loss: number | null }>(
    `
      SELECT branch_id, COALESCE(SUM(total_cost), 0) AS loss
      FROM inventory_movements
      WHERE business_id = ? AND movement_type = 'spoilage' AND deleted_at IS NULL ${timestampFilter("created_at", bounds.startTimestamp)}
      GROUP BY branch_id
    `,
    [businessId, ...timeParams],
  );

  // Production COGS per stall (informational — never added to expenses).
  const productionRows = await db.getAllAsync<{ branch_id: string | null; cost: number | null }>(
    `
      SELECT branch_id, COALESCE(SUM(total_batch_cost), 0) AS cost
      FROM production_batches
      WHERE business_id = ? AND deleted_at IS NULL ${timestampFilter("created_at", bounds.startTimestamp)}
      GROUP BY branch_id
    `,
    [businessId, ...timeParams],
  );

  // Transfers per stall (value moves between stalls; excluded from profit).
  const transferRows = await db.getAllAsync<{
    from_branch_id: string | null;
    to_branch_id: string | null;
    total_cost: number;
  }>(
    `
      SELECT from_branch_id, to_branch_id, total_cost
      FROM product_transfers
      WHERE business_id = ? AND deleted_at IS NULL ${timestampFilter("created_at", bounds.startTimestamp)}
    `,
    [businessId, ...timeParams],
  );

  // Unsold finished goods value per stall (current snapshot).
  const averageCosts = await getAverageProducedCostByProduct(businessId, db);
  const unsoldByBranch = new Map<string | null, number>();
  for (const product of status.products) {
    const averageCost = averageCosts.get(product.id);
    if (averageCost !== undefined && product.stockQty > 0) {
      unsoldByBranch.set(product.branchId, (unsoldByBranch.get(product.branchId) ?? 0) + product.stockQty * averageCost);
    }
  }

  // Best seller per stall + top products overall.
  const bestSellerRows = await db.getAllAsync<{
    branch_id: string | null;
    name: string;
    quantity: number | null;
    sales_amount: number | null;
  }>(
    `
      SELECT s.branch_id, si.name, COALESCE(SUM(si.quantity), 0) AS quantity, COALESCE(SUM(si.line_total), 0) AS sales_amount
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id AND s.deleted_at IS NULL
      WHERE si.business_id = ? AND si.deleted_at IS NULL ${timestampFilter("s.happened_at", bounds.startTimestamp)}
      GROUP BY s.branch_id, si.name
      ORDER BY quantity DESC
    `,
    [businessId, ...timeParams],
  );

  const fixedCosts = await calculateFixedCostsForRange(businessId, bounds.startDate, bounds.endDate, db);
  const grocery = await loadGroceryPoolSnapshot(db);

  const byBranch = <T extends { branch_id: string | null }>(rows: T[]) =>
    new Map(rows.map((row) => [row.branch_id, row]));
  const revenueBy = byBranch(revenueRows);
  const cogsBy = byBranch(cogsRows);
  const spoilageBy = byBranch(spoilageRows);
  const productionBy = byBranch(productionRows);

  const bestSellerByBranch = new Map<string | null, { name: string; quantity: number }>();
  const topProductTotals = new Map<string, TopProductEntry>();
  for (const row of bestSellerRows) {
    if (!bestSellerByBranch.has(row.branch_id)) {
      bestSellerByBranch.set(row.branch_id, { name: row.name, quantity: row.quantity ?? 0 });
    }

    const existing = topProductTotals.get(row.name);
    if (existing) {
      existing.quantity += row.quantity ?? 0;
      existing.salesAmount += row.sales_amount ?? 0;
    } else {
      topProductTotals.set(row.name, { name: row.name, quantity: row.quantity ?? 0, salesAmount: row.sales_amount ?? 0 });
    }
  }

  const stalls: StallReport[] = status.branches.map((branch) => {
    const revenue = revenueBy.get(branch.id)?.revenue ?? 0;
    const soldCogs = cogsBy.get(branch.id)?.sold_cogs ?? 0;
    const spoilageLoss = spoilageBy.get(branch.id)?.loss ?? 0;
    const stallFixedCosts = fixedCosts.byBranch.get(branch.id) ?? 0;
    const transferIn = transferRows
      .filter((row) => row.to_branch_id === branch.id)
      .reduce((total, row) => total + row.total_cost, 0);
    const transferOut = transferRows
      .filter((row) => row.from_branch_id === branch.id)
      .reduce((total, row) => total + row.total_cost, 0);

    return {
      branchId: branch.id,
      branchName: branch.branchName,
      revenue,
      transactionCount: revenueBy.get(branch.id)?.tx_count ?? 0,
      soldCogs,
      grossProfit: grossProfit(revenue, soldCogs),
      fixedCosts: stallFixedCosts,
      spoilageLoss,
      netProfit: netProfit({ revenue, soldCogs, fixedCosts: stallFixedCosts, spoilageLoss }),
      productionCogs: productionBy.get(branch.id)?.cost ?? 0,
      unsoldGoodsValue: unsoldByBranch.get(branch.id) ?? 0,
      transferInValue: transferIn,
      transferOutValue: transferOut,
      estimatedCogsCount: cogsBy.get(branch.id)?.estimated_count ?? 0,
      bestSellerName: bestSellerByBranch.get(branch.id)?.name ?? null,
      bestSellerQuantity: bestSellerByBranch.get(branch.id)?.quantity ?? 0,
    };
  });

  // Consolidated totals come from ALL rows (including branch_id NULL rows),
  // so nothing is lost if data has no stall assigned.
  const revenue = revenueRows.reduce((total, row) => total + (row.revenue ?? 0), 0);
  const soldCogs = cogsRows.reduce((total, row) => total + (row.sold_cogs ?? 0), 0);
  const spoilageLoss = spoilageRows.reduce((total, row) => total + (row.loss ?? 0), 0);
  const unsoldGoodsValue = [...unsoldByBranch.values()].reduce((total, value) => total + value, 0);
  const estimatedCogsCount = cogsRows.reduce((total, row) => total + row.estimated_count, 0);
  const transferValue = transferRows.reduce((total, row) => total + row.total_cost, 0);

  const bestStall = [...stalls].sort((a, b) => b.revenue - a.revenue)[0];
  const topProducts = [...topProductTotals.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 5);

  const consolidated: ConsolidatedReport = {
    revenue,
    transactionCount: revenueRows.reduce((total, row) => total + row.tx_count, 0),
    soldCogs,
    grossProfit: grossProfit(revenue, soldCogs),
    fixedCosts: fixedCosts.total,
    spoilageLoss,
    netProfit: netProfit({ revenue, soldCogs, fixedCosts: fixedCosts.total, spoilageLoss }),
    unsoldGoodsValue,
    groceryRemainingValue: grocery.totalRemainingValue,
    transferCount: transferRows.length,
    transferValue,
    estimatedCogsCount,
    businessWideFixedCosts: fixedCosts.byBranch.get(null) ?? 0,
    bestStallName: bestStall && bestStall.revenue > 0 ? bestStall.branchName : null,
    bestProduct: topProducts[0] ?? null,
    lowStockIngredientCount: grocery.lowStockIngredients.length,
    overdueFixedCostCount: 0,
  };

  return {
    hasBusiness: true,
    range,
    rangeStartIso: bounds.startTimestamp,
    stalls,
    consolidated,
    topProducts,
  };
}
