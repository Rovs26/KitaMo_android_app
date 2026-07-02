export type OfflineQueueStatus = "idle" | "pending" | "syncing" | "failed";

export function getInitialOfflineQueueStatus(): OfflineQueueStatus {
  return "idle";
}
