import * as SQLite from "expo-sqlite";

export const DATABASE_NAME = "kitamo_local.db";

export function openKitamoDatabase() {
  return SQLite.openDatabaseSync(DATABASE_NAME);
}
