import { openKitamoDatabase } from "@/db/client";
import { runMigrations } from "@/db/migrations";
import {
  clearLocalPilotData as clearLocalPilotDataRepository,
  createBranch,
  createBusiness,
  createInventoryMovement,
  createProduct,
  getBooleanAppSetting,
  getLocalDataCounts,
  setAppSetting,
  setBooleanAppSetting,
  type RepositoryDatabase,
} from "@/db/repositories";

export async function initializeLocalDataFoundation(db: RepositoryDatabase = openKitamoDatabase()) {
  const migrationResult = await runMigrations(db);
  const counts = await getLocalDataCounts(db);

  return {
    ...migrationResult,
    counts,
  };
}

export async function getLocalDataSnapshot(db: RepositoryDatabase = openKitamoDatabase()) {
  const migrationResult = await runMigrations(db);
  const counts = await getLocalDataCounts(db);

  return {
    ...migrationResult,
    counts,
  };
}

export async function seedDemoData(db: RepositoryDatabase = openKitamoDatabase()) {
  await runMigrations(db);

  const alreadySeeded = await getBooleanAppSetting("hasSeededDemoData", db);
  if (alreadySeeded) {
    return {
      seeded: false,
      reason: "Demo data was already seeded on this local database.",
      counts: await getLocalDataCounts(db),
    };
  }

  const business = await createBusiness(
    {
      businessName: "KitaMo Demo Stall",
      businessType: "kiosk",
      ownerName: "Demo Seller",
      barangay: "Demo Barangay",
      contactNumber: null,
      preferredLanguage: "Taglish",
    },
    db,
  );

  const branch = await createBranch(
    {
      businessId: business.id,
      branchName: "Night Bazaar Booth",
      location: "Demo Night Market",
      branchType: "stall",
    },
    db,
  );

  const products = await Promise.all([
    createProduct(
      {
        businessId: business.id,
        branchId: branch.id,
        name: "Coke Mismo",
        category: "Drinks",
        price: 25,
        cost: 18,
        stockQty: 12,
        unitType: "bottle",
        lowStockThreshold: 6,
        productType: "retail item",
      },
      db,
    ),
    createProduct(
      {
        businessId: business.id,
        branchId: branch.id,
        name: "Adobo Rice Meal",
        category: "Rice meals",
        price: 85,
        cost: 48,
        stockQty: 10,
        unitType: "serving",
        lowStockThreshold: 4,
        productType: "cooked food",
      },
      db,
    ),
    createProduct(
      {
        businessId: business.id,
        branchId: branch.id,
        name: "Sushi Roll",
        category: "Night bazaar",
        price: 20,
        cost: 11,
        stockQty: 40,
        unitType: "piece",
        lowStockThreshold: 12,
        bundleQuantity: 8,
        bundlePrice: 150,
        bundleLabel: "8 for PHP 150",
        productType: "cooked food",
      },
      db,
    ),
  ]);

  for (const product of products) {
    await createInventoryMovement(
      {
        businessId: business.id,
        branchId: branch.id,
        productId: product.id,
        movementType: "stock_in",
        quantity: product.stockQty,
        reason: "Demo opening stock",
        unitCost: product.cost,
        totalCost: product.cost * product.stockQty,
      },
      db,
    );
  }

  await setAppSetting("activeBusinessId", business.id, "string", db);
  await setAppSetting("activeBranchId", branch.id, "string", db);
  await setBooleanAppSetting("hasSeededDemoData", true, db);

  return {
    seeded: true,
    business,
    branch,
    products,
    counts: await getLocalDataCounts(db),
  };
}

export async function clearLocalPilotData(db: RepositoryDatabase = openKitamoDatabase()) {
  await runMigrations(db);
  return clearLocalPilotDataRepository(db);
}

export function describePilotDataBoundary() {
  return "Fresh mode starts empty. Demo data is only inserted when seedDemoData() is called explicitly.";
}
