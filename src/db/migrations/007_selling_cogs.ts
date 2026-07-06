export const sellingCogsMigration = {
  id: "007_selling_cogs",
  up: `
    ALTER TABLE sale_items ADD COLUMN cogs_total REAL;
    ALTER TABLE sale_items ADD COLUMN cogs_per_unit REAL;
    ALTER TABLE sale_items ADD COLUMN cogs_source TEXT;
    ALTER TABLE sale_items ADD COLUMN cogs_is_estimated INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE sale_items ADD COLUMN related_recipe_id TEXT;

    CREATE TABLE IF NOT EXISTS sale_ingredient_usages (
      id TEXT PRIMARY KEY NOT NULL,
      business_id TEXT NOT NULL,
      sale_id TEXT NOT NULL,
      sale_item_id TEXT NOT NULL,
      recipe_id TEXT,
      ingredient_id TEXT,
      ingredient_lot_id TEXT,
      quantity_used REAL NOT NULL DEFAULT 0,
      unit TEXT NOT NULL DEFAULT 'pcs',
      line_cost REAL NOT NULL DEFAULT 0,
      is_estimated INTEGER NOT NULL DEFAULT 0,
      shortfall_quantity REAL NOT NULL DEFAULT 0,
      source_label_snapshot TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'local' CHECK (sync_status IN ('local', 'pending', 'synced', 'failed')),
      deleted_at TEXT,
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
      FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
      FOREIGN KEY (sale_item_id) REFERENCES sale_items(id) ON DELETE CASCADE,
      FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE SET NULL,
      FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE SET NULL,
      FOREIGN KEY (ingredient_lot_id) REFERENCES ingredient_lots(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS product_transfers (
      id TEXT PRIMARY KEY NOT NULL,
      business_id TEXT NOT NULL,
      from_branch_id TEXT,
      to_branch_id TEXT,
      from_product_id TEXT,
      to_product_id TEXT,
      product_name TEXT NOT NULL,
      quantity REAL NOT NULL DEFAULT 0,
      unit_cost REAL NOT NULL DEFAULT 0,
      total_cost REAL NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'local' CHECK (sync_status IN ('local', 'pending', 'synced', 'failed')),
      deleted_at TEXT,
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
      FOREIGN KEY (from_branch_id) REFERENCES branches(id) ON DELETE SET NULL,
      FOREIGN KEY (to_branch_id) REFERENCES branches(id) ON DELETE SET NULL,
      FOREIGN KEY (from_product_id) REFERENCES products(id) ON DELETE SET NULL,
      FOREIGN KEY (to_product_id) REFERENCES products(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sale_ingredient_usages_sale_id ON sale_ingredient_usages(sale_id);
    CREATE INDEX IF NOT EXISTS idx_sale_ingredient_usages_business_id ON sale_ingredient_usages(business_id);
    CREATE INDEX IF NOT EXISTS idx_product_transfers_business_id ON product_transfers(business_id);
  `,
} as const;
