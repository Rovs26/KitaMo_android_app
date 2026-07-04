export const ownerAlertFieldsMigration = {
  id: "003_owner_alert_fields",
  up: `
    ALTER TABLE owner_alerts ADD COLUMN severity TEXT NOT NULL DEFAULT 'info';
    ALTER TABLE owner_alerts ADD COLUMN product_id TEXT;

    CREATE INDEX IF NOT EXISTS idx_owner_alerts_status ON owner_alerts(status);
    CREATE INDEX IF NOT EXISTS idx_owner_alerts_product_id ON owner_alerts(product_id);
  `,
} as const;
