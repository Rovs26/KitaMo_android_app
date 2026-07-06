export const productionMigration = {
  id: "006_production",
  up: `
    CREATE TABLE IF NOT EXISTS production_batches (
      id TEXT PRIMARY KEY NOT NULL,
      business_id TEXT NOT NULL,
      branch_id TEXT,
      recipe_id TEXT,
      output_product_id TEXT,
      recipe_name TEXT NOT NULL,
      output_quantity REAL NOT NULL DEFAULT 0,
      output_unit TEXT NOT NULL DEFAULT 'pcs',
      batch_multiplier REAL NOT NULL DEFAULT 1,
      total_batch_cost REAL NOT NULL DEFAULT 0,
      cost_per_output_unit REAL NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'local' CHECK (sync_status IN ('local', 'pending', 'synced', 'failed')),
      deleted_at TEXT,
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
      FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL,
      FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE SET NULL,
      FOREIGN KEY (output_product_id) REFERENCES products(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS production_ingredient_usages (
      id TEXT PRIMARY KEY NOT NULL,
      business_id TEXT NOT NULL,
      production_batch_id TEXT NOT NULL,
      ingredient_id TEXT,
      ingredient_lot_id TEXT,
      quantity_used REAL NOT NULL DEFAULT 0,
      unit TEXT NOT NULL DEFAULT 'pcs',
      line_cost REAL NOT NULL DEFAULT 0,
      source_label_snapshot TEXT,
      is_custom INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'local' CHECK (sync_status IN ('local', 'pending', 'synced', 'failed')),
      deleted_at TEXT,
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
      FOREIGN KEY (production_batch_id) REFERENCES production_batches(id) ON DELETE CASCADE,
      FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE SET NULL,
      FOREIGN KEY (ingredient_lot_id) REFERENCES ingredient_lots(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_production_batches_business_id ON production_batches(business_id);
    CREATE INDEX IF NOT EXISTS idx_production_batches_branch_id ON production_batches(branch_id);
    CREATE INDEX IF NOT EXISTS idx_production_usages_batch_id ON production_ingredient_usages(production_batch_id);
    CREATE INDEX IF NOT EXISTS idx_production_usages_business_id ON production_ingredient_usages(business_id);
  `,
} as const;
