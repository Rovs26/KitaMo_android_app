export type PaymentMethod = "cash" | "GCash" | "Maya" | "bank transfer" | "other";

export type SyncStatus = "local" | "pending" | "synced" | "failed";

export type PlaceholderEntity = {
  id: string;
  createdAt: string;
  updatedAt: string;
  syncStatus: SyncStatus;
};
