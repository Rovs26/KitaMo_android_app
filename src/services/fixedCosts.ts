import { openKitamoDatabase } from "@/db/client";
import { runMigrations } from "@/db/migrations";
import {
  archiveFixedCost as archiveFixedCostRow,
  createFixedCost,
  createFixedCostPayment,
  hasFixedCostPayment,
  listFixedCostPaymentsForBusiness,
  listFixedCostsForBusiness,
  type CreateFixedCostInput,
  type FixedCostWithBranch,
  type RepositoryDatabase,
} from "@/db/repositories";
import {
  classifyFixedCost,
  findPayableOccurrence,
  isValidIsoDate,
  listOccurrences,
  type FixedCostStatus,
} from "@/domain/fixedCostSchedule";
import type { FixedCostPayment } from "@/domain/types";

import { loadOwnerSetupStatus } from "./ownerSetup";

export type FixedCostOverviewItem = {
  cost: FixedCostWithBranch;
  status: FixedCostStatus;
  nextDueDate: string | null;
  paidCount: number;
};

export type FixedCostsOverview = {
  hasBusiness: boolean;
  items: FixedCostOverviewItem[];
  dueSoonCount: number;
  overdueCount: number;
  paidThisMonthTotal: number;
  thisMonthTotal: number;
};

function todayIso() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthBounds(reference = new Date()) {
  const year = reference.getFullYear();
  const month = reference.getMonth();
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  const iso = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  return { startIso: iso(start), endIso: iso(end) };
}

export async function addFixedCost(
  input: Omit<CreateFixedCostInput, "businessId">,
  db: RepositoryDatabase = openKitamoDatabase(),
) {
  await runMigrations(db);
  const status = await loadOwnerSetupStatus(db);
  if (!status.activeBusiness) {
    throw new Error("Create your business profile in Owner Settings first.");
  }

  if (!isValidIsoDate(input.dueDate)) {
    throw new Error("Date should look like 2026-07-15.");
  }

  return createFixedCost({ ...input, businessId: status.activeBusiness.id }, db);
}

export async function loadFixedCostsOverview(db: RepositoryDatabase = openKitamoDatabase()): Promise<FixedCostsOverview> {
  await runMigrations(db);
  const status = await loadOwnerSetupStatus(db);
  if (!status.activeBusiness) {
    return {
      hasBusiness: false,
      items: [],
      dueSoonCount: 0,
      overdueCount: 0,
      paidThisMonthTotal: 0,
      thisMonthTotal: 0,
    };
  }

  const businessId = status.activeBusiness.id;
  const costs = await listFixedCostsForBusiness(businessId, db);
  const payments = await listFixedCostPaymentsForBusiness(businessId, db);
  const paymentsByCost = new Map<string, FixedCostPayment[]>();
  for (const payment of payments) {
    const bucket = paymentsByCost.get(payment.fixedCostId);
    if (bucket) {
      bucket.push(payment);
    } else {
      paymentsByCost.set(payment.fixedCostId, [payment]);
    }
  }

  const today = todayIso();
  const { startIso, endIso } = monthBounds();

  const items: FixedCostOverviewItem[] = costs
    .filter((cost) => cost.status === "active")
    .map((cost) => {
      const paidDates = (paymentsByCost.get(cost.id) ?? []).map((payment) => payment.dueDate);
      const classified = classifyFixedCost(cost.dueDate, cost.frequency, cost.endDate, paidDates, today);
      return {
        cost,
        status: classified.status,
        nextDueDate: classified.nextDueDate,
        paidCount: paidDates.length,
      };
    });

  const paidThisMonthTotal = payments
    .filter((payment) => payment.paidDate && payment.paidDate >= startIso && payment.paidDate <= endIso)
    .reduce((total, payment) => total + payment.amount, 0);

  const thisMonthTotal = items.reduce(
    (total, item) =>
      total +
      listOccurrences(item.cost.dueDate, item.cost.frequency, item.cost.endDate, startIso, endIso).length *
        item.cost.amount,
    0,
  );

  return {
    hasBusiness: true,
    items,
    dueSoonCount: items.filter((item) => item.status === "due_soon").length,
    overdueCount: items.filter((item) => item.status === "overdue").length,
    paidThisMonthTotal,
    thisMonthTotal,
  };
}

export async function markFixedCostPaid(fixedCostId: string, db: RepositoryDatabase = openKitamoDatabase()) {
  await runMigrations(db);
  const status = await loadOwnerSetupStatus(db);
  if (!status.activeBusiness) {
    throw new Error("Create your business profile in Owner Settings first.");
  }

  const costs = await listFixedCostsForBusiness(status.activeBusiness.id, db);
  const cost = costs.find((candidate) => candidate.id === fixedCostId && candidate.status === "active");
  if (!cost) {
    throw new Error("Fixed cost not found. Refresh and try again.");
  }

  const payments = await listFixedCostPaymentsForBusiness(status.activeBusiness.id, db);
  const paidDates = payments.filter((payment) => payment.fixedCostId === cost.id).map((payment) => payment.dueDate);
  const today = todayIso();
  const dueDate = findPayableOccurrence(cost.dueDate, cost.frequency, cost.endDate, paidDates, today);
  if (!dueDate) {
    throw new Error(`${cost.name} is fully paid na. Walang due na bayarin.`);
  }

  // Duplicate guard: the same occurrence can only be paid once.
  if (await hasFixedCostPayment(cost.id, dueDate, db)) {
    throw new Error(`${cost.name} (${dueDate}) is already marked paid.`);
  }

  const payment = await createFixedCostPayment(
    {
      businessId: status.activeBusiness.id,
      fixedCostId: cost.id,
      branchId: cost.branchId,
      dueDate,
      paidDate: today,
      amount: cost.amount,
    },
    db,
  );

  return { payment, costName: cost.name, dueDate };
}

export async function archiveFixedCost(fixedCostId: string, db: RepositoryDatabase = openKitamoDatabase()) {
  await runMigrations(db);
  return archiveFixedCostRow(fixedCostId, db);
}

export type FixedCostsForRange = {
  total: number;
  byBranch: Map<string | null, number>;
};

/**
 * Fixed-cost expense for a date range: every occurrence whose due date falls
 * inside the range counts, paid or not (payments are cash-flow visibility).
 * Archived costs stop generating occurrences from their archive point onward
 * only in the sense that they are excluded here; history stays in payments.
 */
export async function calculateFixedCostsForRange(
  businessId: string,
  rangeStart: string,
  rangeEnd: string,
  db: RepositoryDatabase = openKitamoDatabase(),
): Promise<FixedCostsForRange> {
  await runMigrations(db);
  const costs = await listFixedCostsForBusiness(businessId, db);
  const byBranch = new Map<string | null, number>();
  let total = 0;

  for (const cost of costs) {
    if (cost.status !== "active") {
      continue;
    }

    const occurrences = listOccurrences(cost.dueDate, cost.frequency, cost.endDate, rangeStart, rangeEnd);
    if (occurrences.length === 0) {
      continue;
    }

    const amount = occurrences.length * cost.amount;
    total += amount;
    byBranch.set(cost.branchId, (byBranch.get(cost.branchId) ?? 0) + amount);
  }

  return { total, byBranch };
}
