import { z } from "zod";

import { makeBranchId } from "@/domain/ids";
import type { Branch, SyncStatus } from "@/domain/types";

import { getRepositoryDatabase, nowIso, toBoolean, toInteger, type RepositoryDatabase } from "./shared";

const createBranchSchema = z.object({
  id: z.string().optional(),
  businessId: z.string().min(1),
  branchName: z.string().min(1),
  location: z.string().nullable().optional(),
  branchType: z.enum(["stall", "branch", "kiosk", "booth", "home kitchen", "pop-up"]).default("stall"),
  active: z.boolean().default(true),
});

export type CreateBranchInput = z.input<typeof createBranchSchema>;

type BranchRow = {
  id: string;
  business_id: string;
  branch_name: string;
  location: string | null;
  branch_type: Branch["branchType"];
  active: number;
  created_at: string;
  updated_at: string;
  sync_status: SyncStatus;
  deleted_at: string | null;
};

function mapBranch(row: BranchRow): Branch {
  return {
    id: row.id,
    businessId: row.business_id,
    branchName: row.branch_name,
    location: row.location,
    branchType: row.branch_type,
    active: toBoolean(row.active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncStatus: row.sync_status,
    deletedAt: row.deleted_at,
  };
}

export async function createBranch(input: CreateBranchInput, db?: RepositoryDatabase) {
  const parsed = createBranchSchema.parse(input);
  const database = getRepositoryDatabase(db);
  const createdAt = nowIso();
  const branch: Branch = {
    id: parsed.id ?? makeBranchId(),
    businessId: parsed.businessId,
    branchName: parsed.branchName,
    location: parsed.location ?? null,
    branchType: parsed.branchType,
    active: parsed.active,
    createdAt,
    updatedAt: createdAt,
    syncStatus: "local",
    deletedAt: null,
  };

  await database.runAsync(
    `
      INSERT INTO branches (
        id, business_id, branch_name, location, branch_type, active,
        created_at, updated_at, sync_status, deleted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      branch.id,
      branch.businessId,
      branch.branchName,
      branch.location,
      branch.branchType,
      toInteger(branch.active),
      branch.createdAt,
      branch.updatedAt,
      branch.syncStatus,
      branch.deletedAt,
    ],
  );

  return branch;
}

export async function listBranchesForBusiness(businessId: string, db?: RepositoryDatabase) {
  const rows = await getRepositoryDatabase(db).getAllAsync<BranchRow>(
    "SELECT * FROM branches WHERE business_id = ? AND deleted_at IS NULL ORDER BY created_at ASC",
    [businessId],
  );
  return rows.map(mapBranch);
}

export async function countBranches(db?: RepositoryDatabase) {
  const row = await getRepositoryDatabase(db).getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) AS count FROM branches WHERE deleted_at IS NULL",
  );
  return row?.count ?? 0;
}
