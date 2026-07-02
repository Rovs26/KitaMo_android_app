import { openKitamoDatabase } from "@/db/client";
import { resettableTables } from "@/db/schema";

import { getLocalDataCounts, type RepositoryDatabase } from "./shared";

export async function clearLocalPilotData(db: RepositoryDatabase = openKitamoDatabase()) {
  await db.withExclusiveTransactionAsync(async (txn) => {
    for (const table of resettableTables) {
      await txn.runAsync(`DELETE FROM ${table}`);
    }
  });

  return getLocalDataCounts(db);
}
