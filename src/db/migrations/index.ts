import type { SQLiteDatabase } from "expo-sqlite";

import { openKitamoDatabase } from "@/db/client";

import { initialSchemaMigration } from "./001_initial_schema";

export type Migration = {
  id: string;
  up: string;
};

const migrations: Migration[] = [initialSchemaMigration];

type MigrationRow = {
  id: string;
  applied_at: string;
};

async function ensureMigrationTable(db: SQLiteDatabase) {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);
}

export async function getAppliedMigrations(db = openKitamoDatabase()) {
  await ensureMigrationTable(db);
  return db.getAllAsync<MigrationRow>("SELECT id, applied_at FROM schema_migrations ORDER BY id ASC");
}

export async function runMigrations(db = openKitamoDatabase()) {
  await ensureMigrationTable(db);

  const appliedRows = await getAppliedMigrations(db);
  const appliedIds = new Set(appliedRows.map((row) => row.id));
  const newlyApplied: string[] = [];

  for (const migration of migrations) {
    if (appliedIds.has(migration.id)) {
      continue;
    }

    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.execAsync(migration.up);
      await txn.runAsync("INSERT OR IGNORE INTO schema_migrations (id, applied_at) VALUES (?, ?)", [
        migration.id,
        new Date().toISOString(),
      ]);
    });

    newlyApplied.push(migration.id);
  }

  return {
    appliedMigrationIds: [...appliedIds, ...newlyApplied],
    newlyAppliedMigrationIds: newlyApplied,
  };
}
