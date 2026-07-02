import { openKitamoDatabase } from "@/db/client";
import { runMigrations } from "@/db/migrations";
import type { LocalDataCounts } from "@/db/schema";
import {
  getAppSetting,
  getBooleanAppSetting,
  getLocalDataCounts,
  listBranchesForBusiness,
  listBusinesses,
  listProductsForBusiness,
  setAppSetting,
  setBooleanAppSetting,
  type RepositoryDatabase,
} from "@/db/repositories";
import type { Branch, Business, Product } from "@/domain/types";

import { seedDemoData } from "./pilotData";

export type OwnerSetupMode = "fresh" | "demo";

export type OwnerSetupStatus = {
  dbReady: boolean;
  firstRunComplete: boolean;
  mode: OwnerSetupMode;
  activeBusiness: Business | null;
  activeBranch: Branch | null;
  businesses: Business[];
  branches: Branch[];
  products: Product[];
  counts: LocalDataCounts;
  productCount: number;
  stallCount: number;
  pendingQueueCount: number;
  appliedMigrationIds: string[];
  newlyAppliedMigrationIds: string[];
};

type PendingQueueRow = {
  count: number;
};

async function countPendingQueue(db: RepositoryDatabase) {
  const row = await db.getFirstAsync<PendingQueueRow>(
    "SELECT COUNT(*) AS count FROM offline_queue WHERE status = 'pending' AND deleted_at IS NULL",
  );
  return row?.count ?? 0;
}

export async function completeFreshFirstRun(db: RepositoryDatabase = openKitamoDatabase()) {
  await runMigrations(db);
  await setBooleanAppSetting("hasSeededDemoData", false, db);
  await setBooleanAppSetting("hasCompletedFirstRun", true, db);
}

export async function completeDemoFirstRun(db: RepositoryDatabase = openKitamoDatabase()) {
  await runMigrations(db);
  await seedDemoData(db);
  await setBooleanAppSetting("hasCompletedFirstRun", true, db);
}

export async function setActiveBusiness(businessId: string, db: RepositoryDatabase = openKitamoDatabase()) {
  await runMigrations(db);
  return setAppSetting("activeBusinessId", businessId, "string", db);
}

export async function setActiveBranch(branchId: string, db: RepositoryDatabase = openKitamoDatabase()) {
  await runMigrations(db);
  return setAppSetting("activeBranchId", branchId, "string", db);
}

export async function loadOwnerSetupStatus(db: RepositoryDatabase = openKitamoDatabase()): Promise<OwnerSetupStatus> {
  const migrationResult = await runMigrations(db);
  const [firstRunComplete, hasSeededDemoData, activeBusinessSetting, activeBranchSetting, businesses, counts, pendingQueueCount] =
    await Promise.all([
      getBooleanAppSetting("hasCompletedFirstRun", db),
      getBooleanAppSetting("hasSeededDemoData", db),
      getAppSetting("activeBusinessId", db),
      getAppSetting("activeBranchId", db),
      listBusinesses(db),
      getLocalDataCounts(db),
      countPendingQueue(db),
    ]);

  const activeBusiness =
    businesses.find((business) => business.id === activeBusinessSetting?.value) ?? businesses[0] ?? null;
  const branches = activeBusiness ? await listBranchesForBusiness(activeBusiness.id, db) : [];
  const products = activeBusiness ? await listProductsForBusiness(activeBusiness.id, db) : [];
  const activeBranch = branches.find((branch) => branch.id === activeBranchSetting?.value) ?? branches[0] ?? null;

  return {
    dbReady: true,
    firstRunComplete,
    mode: hasSeededDemoData ? "demo" : "fresh",
    activeBusiness,
    activeBranch,
    businesses,
    branches,
    products,
    counts,
    productCount: products.length,
    stallCount: branches.length,
    pendingQueueCount,
    appliedMigrationIds: migrationResult.appliedMigrationIds,
    newlyAppliedMigrationIds: migrationResult.newlyAppliedMigrationIds,
  };
}
