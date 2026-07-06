export const fixedCostsMigration = {
  id: "008_fixed_costs",
  up: `
    CREATE TABLE IF NOT EXISTS fixed_costs (
      id TEXT PRIMARY KEY NOT NULL,
      business_id TEXT NOT NULL,
      branch_id TEXT,
      name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'other',
      amount REAL NOT NULL DEFAULT 0,
      frequency TEXT NOT NULL DEFAULT 'monthly',
      due_date TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'local' CHECK (sync_status IN ('local', 'pending', 'synced', 'failed')),
      deleted_at TEXT,
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
      FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS fixed_cost_payments (
      id TEXT PRIMARY KEY NOT NULL,
      business_id TEXT NOT NULL,
      fixed_cost_id TEXT NOT NULL,
      branch_id TEXT,
      due_date TEXT NOT NULL,
      paid_date TEXT,
      amount REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'paid',
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'local' CHECK (sync_status IN ('local', 'pending', 'synced', 'failed')),
      deleted_at TEXT,
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
      FOREIGN KEY (fixed_cost_id) REFERENCES fixed_costs(id) ON DELETE CASCADE,
      FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_fixed_costs_business_id ON fixed_costs(business_id);
    CREATE INDEX IF NOT EXISTS idx_fixed_cost_payments_business_id ON fixed_cost_payments(business_id);
    CREATE INDEX IF NOT EXISTS idx_fixed_cost_payments_cost_id ON fixed_cost_payments(fixed_cost_id);
  `,
} as const;
