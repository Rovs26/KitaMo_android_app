import type { SQLiteDatabase } from "expo-sqlite";

import { openKitamoDatabase } from "@/db/client";
import { countableTables, type CountableTable, type LocalDataCounts } from "@/db/schema";

export type RepositoryDatabase = SQLiteDatabase;

export function getRepositoryDatabase(db?: RepositoryDatabase) {
  return db ?? openKitamoDatabase();
}

export function nowIso() {
  return new Date().toISOString();
}

type CountRow = {
  count: number;
};

export async function countTable(table: CountableTable, db?: RepositoryDatabase) {
  const database = getRepositoryDatabase(db);
  const row = await database.getFirstAsync<CountRow>(`SELECT COUNT(*) AS count FROM ${table}`);
  return row?.count ?? 0;
}

export async function getLocalDataCounts(db?: RepositoryDatabase): Promise<LocalDataCounts> {
  const database = getRepositoryDatabase(db);
  const entries: (readonly [CountableTable, number])[] = [];

  for (const table of countableTables) {
    entries.push([table, await countTable(table, database)]);
  }

  return Object.fromEntries(entries) as LocalDataCounts;
}

export function toBoolean(value: number) {
  return value === 1;
}

export function toInteger(value: boolean) {
  return value ? 1 : 0;
}
