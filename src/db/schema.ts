export const schemaVersion = 1;

export const syncStatusValues = ["local", "pending", "synced", "failed"] as const;

export const resettableTables = [
  "offline_queue",
  "receipt_records",
  "owner_alerts",
  "recipe_batches",
  "inventory_movements",
  "sale_items",
  "sales",
  "products",
  "branches",
  "businesses",
  "app_settings",
] as const;

export const countableTables = [
  "businesses",
  "branches",
  "products",
  "sales",
  "inventory_movements",
  "recipe_batches",
  "owner_alerts",
  "receipt_records",
  "offline_queue",
] as const;

export type ResettableTable = (typeof resettableTables)[number];
export type CountableTable = (typeof countableTables)[number];
export type LocalDataCounts = Record<CountableTable, number>;
