import { makeSettingId } from "@/domain/ids";
import type { AppSetting, AppSettingKey } from "@/domain/types";

import { getRepositoryDatabase, nowIso, type RepositoryDatabase } from "./shared";

type AppSettingRow = {
  id: string;
  key: AppSettingKey;
  value: string;
  value_type: AppSetting["valueType"];
  created_at: string;
  updated_at: string;
};

function mapAppSetting(row: AppSettingRow): AppSetting {
  return {
    id: row.id,
    key: row.key,
    value: row.value,
    valueType: row.value_type,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function setAppSetting(
  key: AppSettingKey,
  value: string,
  valueType: AppSetting["valueType"] = "string",
  db?: RepositoryDatabase,
) {
  const database = getRepositoryDatabase(db);
  const timestamp = nowIso();
  const existing = await getAppSetting(key, database);

  if (existing) {
    await database.runAsync("UPDATE app_settings SET value = ?, value_type = ?, updated_at = ? WHERE key = ?", [
      value,
      valueType,
      timestamp,
      key,
    ]);
    return { ...existing, value, valueType, updatedAt: timestamp };
  }

  const setting: AppSetting = {
    id: makeSettingId(),
    key,
    value,
    valueType,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  await database.runAsync(
    "INSERT INTO app_settings (id, key, value, value_type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    [setting.id, setting.key, setting.value, setting.valueType, setting.createdAt, setting.updatedAt],
  );

  return setting;
}

export async function getAppSetting(key: AppSettingKey, db?: RepositoryDatabase) {
  const row = await getRepositoryDatabase(db).getFirstAsync<AppSettingRow>("SELECT * FROM app_settings WHERE key = ?", [key]);
  return row ? mapAppSetting(row) : null;
}

export async function getBooleanAppSetting(key: AppSettingKey, db?: RepositoryDatabase) {
  const setting = await getAppSetting(key, db);
  return setting?.value === "true";
}

export async function setBooleanAppSetting(key: AppSettingKey, value: boolean, db?: RepositoryDatabase) {
  return setAppSetting(key, value ? "true" : "false", "boolean", db);
}

export async function listAppSettings(db?: RepositoryDatabase) {
  const rows = await getRepositoryDatabase(db).getAllAsync<AppSettingRow>("SELECT * FROM app_settings ORDER BY key ASC");
  return rows.map(mapAppSetting);
}
