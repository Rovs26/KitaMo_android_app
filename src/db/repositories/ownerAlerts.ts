import { z } from "zod";

import { makeAlertId } from "@/domain/ids";
import type { OwnerAlert, OwnerAlertSeverity, OwnerAlertStatus, SyncStatus } from "@/domain/types";

import { getRepositoryDatabase, nowIso, type RepositoryDatabase } from "./shared";

const createOwnerAlertSchema = z.object({
  id: z.string().optional(),
  businessId: z.string().min(1),
  branchId: z.string().nullable().optional(),
  productId: z.string().nullable().optional(),
  alertType: z.string().default("low_stock"),
  title: z.string().min(1),
  message: z.string().min(1),
  severity: z.enum(["info", "warning", "critical"]).default("warning"),
  source: z.string().default("local"),
});

export type CreateOwnerAlertInput = z.input<typeof createOwnerAlertSchema>;

type OwnerAlertRow = {
  id: string;
  business_id: string;
  branch_id: string | null;
  product_id: string | null;
  alert_type: string;
  title: string;
  message: string;
  severity: OwnerAlertSeverity;
  status: string;
  source: string;
  created_at: string;
  updated_at: string;
  sync_status: SyncStatus;
  deleted_at: string | null;
};

function mapOwnerAlert(row: OwnerAlertRow): OwnerAlert {
  return {
    id: row.id,
    businessId: row.business_id,
    branchId: row.branch_id,
    productId: row.product_id,
    alertType: row.alert_type,
    title: row.title,
    message: row.message,
    severity: row.severity,
    status: (row.status === "resolved" ? "resolved" : "active") as OwnerAlertStatus,
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncStatus: row.sync_status,
    deletedAt: row.deleted_at,
  };
}

export async function createOwnerAlert(input: CreateOwnerAlertInput, db?: RepositoryDatabase) {
  const parsed = createOwnerAlertSchema.parse(input);
  const database = getRepositoryDatabase(db);
  const createdAt = nowIso();
  const alert: OwnerAlert = {
    id: parsed.id ?? makeAlertId(),
    businessId: parsed.businessId,
    branchId: parsed.branchId ?? null,
    productId: parsed.productId ?? null,
    alertType: parsed.alertType,
    title: parsed.title,
    message: parsed.message,
    severity: parsed.severity,
    status: "active",
    source: parsed.source,
    createdAt,
    updatedAt: createdAt,
    syncStatus: "local",
    deletedAt: null,
  };

  await database.runAsync(
    `
      INSERT INTO owner_alerts (
        id, business_id, branch_id, product_id, alert_type, title, message,
        severity, status, source, created_at, updated_at, sync_status, deleted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      alert.id,
      alert.businessId,
      alert.branchId,
      alert.productId,
      alert.alertType,
      alert.title,
      alert.message,
      alert.severity,
      alert.status,
      alert.source,
      alert.createdAt,
      alert.updatedAt,
      alert.syncStatus,
      alert.deletedAt,
    ],
  );

  return alert;
}

export async function listActiveOwnerAlerts(businessId: string, db?: RepositoryDatabase) {
  const rows = await getRepositoryDatabase(db).getAllAsync<OwnerAlertRow>(
    `
      SELECT * FROM owner_alerts
      WHERE business_id = ? AND status IN ('active', 'open') AND deleted_at IS NULL
      ORDER BY created_at DESC
    `,
    [businessId],
  );
  return rows.map(mapOwnerAlert);
}

export async function listRecentOwnerAlerts(businessId: string, limit = 20, db?: RepositoryDatabase) {
  const rows = await getRepositoryDatabase(db).getAllAsync<OwnerAlertRow>(
    `
      SELECT * FROM owner_alerts
      WHERE business_id = ? AND deleted_at IS NULL
      ORDER BY created_at DESC
      LIMIT ?
    `,
    [businessId, limit],
  );
  return rows.map(mapOwnerAlert);
}

export async function getActiveOwnerAlertForProduct(
  businessId: string,
  productId: string,
  alertType: string,
  db?: RepositoryDatabase,
) {
  const row = await getRepositoryDatabase(db).getFirstAsync<OwnerAlertRow>(
    `
      SELECT * FROM owner_alerts
      WHERE business_id = ? AND product_id = ? AND alert_type = ?
        AND status IN ('active', 'open') AND deleted_at IS NULL
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [businessId, productId, alertType],
  );
  return row ? mapOwnerAlert(row) : null;
}

export async function resolveOwnerAlert(alertId: string, db?: RepositoryDatabase) {
  const database = getRepositoryDatabase(db);
  const result = await database.runAsync(
    `
      UPDATE owner_alerts
      SET status = 'resolved', updated_at = ?, sync_status = 'local'
      WHERE id = ? AND status != 'resolved' AND deleted_at IS NULL
    `,
    [nowIso(), alertId],
  );
  return result.changes === 1;
}

export async function countActiveOwnerAlerts(businessId: string, db?: RepositoryDatabase) {
  const row = await getRepositoryDatabase(db).getFirstAsync<{ count: number }>(
    `
      SELECT COUNT(*) AS count FROM owner_alerts
      WHERE business_id = ? AND status IN ('active', 'open') AND deleted_at IS NULL
    `,
    [businessId],
  );
  return row?.count ?? 0;
}
