import { z } from "zod";

import { makeFixedCostId, makeFixedCostPaymentId } from "@/domain/ids";
import type { FixedCost, FixedCostCategory, FixedCostFrequencyType, FixedCostPayment, SyncStatus } from "@/domain/types";

import { getRepositoryDatabase, nowIso, type RepositoryDatabase } from "./shared";

export const fixedCostCategories: FixedCostCategory[] = [
  "rent",
  "wages",
  "electricity",
  "water",
  "transport",
  "lpg_gas",
  "market_fee",
  "internet_load",
  "other",
];

export const fixedCostFrequencies: FixedCostFrequencyType[] = ["daily", "weekly", "monthly", "one_time"];

const createFixedCostSchema = z.object({
  id: z.string().optional(),
  businessId: z.string().min(1),
  branchId: z.string().nullable().optional(),
  name: z.string().min(1),
  category: z.enum(["rent", "wages", "electricity", "water", "transport", "lpg_gas", "market_fee", "internet_load", "other"]),
  amount: z.number().positive(),
  frequency: z.enum(["daily", "weekly", "monthly", "one_time"]),
  dueDate: z.string().min(1),
  endDate: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export type CreateFixedCostInput = z.input<typeof createFixedCostSchema>;

type FixedCostRow = {
  id: string;
  business_id: string;
  branch_id: string | null;
  name: string;
  category: FixedCostCategory;
  amount: number;
  frequency: FixedCostFrequencyType;
  due_date: string;
  start_date: string;
  end_date: string | null;
  status: "active" | "archived";
  notes: string | null;
  created_at: string;
  updated_at: string;
  sync_status: SyncStatus;
  deleted_at: string | null;
};

export type FixedCostWithBranch = FixedCost & { branchName: string | null };

type FixedCostWithBranchRow = FixedCostRow & { branch_name: string | null };

type FixedCostPaymentRow = {
  id: string;
  business_id: string;
  fixed_cost_id: string;
  branch_id: string | null;
  due_date: string;
  paid_date: string | null;
  amount: number;
  status: "paid" | "skipped";
  notes: string | null;
  created_at: string;
  updated_at: string;
  sync_status: SyncStatus;
  deleted_at: string | null;
};

function mapFixedCost(row: FixedCostRow): FixedCost {
  return {
    id: row.id,
    businessId: row.business_id,
    branchId: row.branch_id,
    name: row.name,
    category: row.category,
    amount: row.amount,
    frequency: row.frequency,
    dueDate: row.due_date,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncStatus: row.sync_status,
    deletedAt: row.deleted_at,
  };
}

function mapFixedCostPayment(row: FixedCostPaymentRow): FixedCostPayment {
  return {
    id: row.id,
    businessId: row.business_id,
    fixedCostId: row.fixed_cost_id,
    branchId: row.branch_id,
    dueDate: row.due_date,
    paidDate: row.paid_date,
    amount: row.amount,
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncStatus: row.sync_status,
    deletedAt: row.deleted_at,
  };
}

export async function createFixedCost(input: CreateFixedCostInput, db?: RepositoryDatabase) {
  const parsed = createFixedCostSchema.parse(input);
  const database = getRepositoryDatabase(db);
  const createdAt = nowIso();
  const cost: FixedCost = {
    id: parsed.id ?? makeFixedCostId(),
    businessId: parsed.businessId,
    branchId: parsed.branchId ?? null,
    name: parsed.name.trim(),
    category: parsed.category,
    amount: parsed.amount,
    frequency: parsed.frequency,
    dueDate: parsed.dueDate,
    startDate: parsed.dueDate,
    endDate: parsed.endDate ?? null,
    status: "active",
    notes: parsed.notes?.trim() || null,
    createdAt,
    updatedAt: createdAt,
    syncStatus: "local",
    deletedAt: null,
  };

  await database.runAsync(
    `
      INSERT INTO fixed_costs (
        id, business_id, branch_id, name, category, amount, frequency,
        due_date, start_date, end_date, status, notes,
        created_at, updated_at, sync_status, deleted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      cost.id,
      cost.businessId,
      cost.branchId,
      cost.name,
      cost.category,
      cost.amount,
      cost.frequency,
      cost.dueDate,
      cost.startDate,
      cost.endDate,
      cost.status,
      cost.notes,
      cost.createdAt,
      cost.updatedAt,
      cost.syncStatus,
      cost.deletedAt,
    ],
  );

  return cost;
}

export async function listFixedCostsForBusiness(
  businessId: string,
  db?: RepositoryDatabase,
): Promise<FixedCostWithBranch[]> {
  const rows = await getRepositoryDatabase(db).getAllAsync<FixedCostWithBranchRow>(
    `
      SELECT fc.*, b.branch_name AS branch_name
      FROM fixed_costs fc
      LEFT JOIN branches b ON b.id = fc.branch_id AND b.deleted_at IS NULL
      WHERE fc.business_id = ? AND fc.deleted_at IS NULL
      ORDER BY fc.created_at DESC
    `,
    [businessId],
  );

  return rows.map((row) => ({ ...mapFixedCost(row), branchName: row.branch_name }));
}

export async function archiveFixedCost(fixedCostId: string, db?: RepositoryDatabase) {
  const result = await getRepositoryDatabase(db).runAsync(
    `
      UPDATE fixed_costs
      SET status = 'archived', updated_at = ?, sync_status = 'local'
      WHERE id = ? AND deleted_at IS NULL
    `,
    [nowIso(), fixedCostId],
  );
  return result.changes === 1;
}

export async function listFixedCostPaymentsForBusiness(businessId: string, db?: RepositoryDatabase) {
  const rows = await getRepositoryDatabase(db).getAllAsync<FixedCostPaymentRow>(
    "SELECT * FROM fixed_cost_payments WHERE business_id = ? AND deleted_at IS NULL ORDER BY due_date DESC",
    [businessId],
  );
  return rows.map(mapFixedCostPayment);
}

export async function hasFixedCostPayment(fixedCostId: string, dueDate: string, db?: RepositoryDatabase) {
  const row = await getRepositoryDatabase(db).getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) AS count FROM fixed_cost_payments WHERE fixed_cost_id = ? AND due_date = ? AND deleted_at IS NULL",
    [fixedCostId, dueDate],
  );
  return (row?.count ?? 0) > 0;
}

export async function createFixedCostPayment(
  input: {
    businessId: string;
    fixedCostId: string;
    branchId: string | null;
    dueDate: string;
    paidDate: string;
    amount: number;
    notes?: string | null;
  },
  db?: RepositoryDatabase,
) {
  const database = getRepositoryDatabase(db);
  const createdAt = nowIso();
  const payment: FixedCostPayment = {
    id: makeFixedCostPaymentId(),
    businessId: input.businessId,
    fixedCostId: input.fixedCostId,
    branchId: input.branchId,
    dueDate: input.dueDate,
    paidDate: input.paidDate,
    amount: input.amount,
    status: "paid",
    notes: input.notes?.trim() || null,
    createdAt,
    updatedAt: createdAt,
    syncStatus: "local",
    deletedAt: null,
  };

  await database.runAsync(
    `
      INSERT INTO fixed_cost_payments (
        id, business_id, fixed_cost_id, branch_id, due_date, paid_date, amount,
        status, notes, created_at, updated_at, sync_status, deleted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      payment.id,
      payment.businessId,
      payment.fixedCostId,
      payment.branchId,
      payment.dueDate,
      payment.paidDate,
      payment.amount,
      payment.status,
      payment.notes,
      payment.createdAt,
      payment.updatedAt,
      payment.syncStatus,
      payment.deletedAt,
    ],
  );

  return payment;
}

export async function countFixedCosts(db?: RepositoryDatabase) {
  const row = await getRepositoryDatabase(db).getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) AS count FROM fixed_costs WHERE deleted_at IS NULL",
  );
  return row?.count ?? 0;
}

export async function countFixedCostPayments(db?: RepositoryDatabase) {
  const row = await getRepositoryDatabase(db).getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) AS count FROM fixed_cost_payments WHERE deleted_at IS NULL",
  );
  return row?.count ?? 0;
}
