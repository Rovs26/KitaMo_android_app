import * as SQLite from "expo-sqlite";

export const DATABASE_NAME = "kitamo_local.db";

let database: SQLite.SQLiteDatabase | null = null;

export function openKitamoDatabase() {
  if (!database) {
    database = SQLite.openDatabaseSync(DATABASE_NAME);
    database.execSync("PRAGMA foreign_keys = ON;");
  }

  return database;
}
