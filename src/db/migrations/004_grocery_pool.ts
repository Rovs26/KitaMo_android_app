export const groceryPoolMigration = {
  id: "004_grocery_pool",
  up: `
    CREATE TABLE IF NOT EXISTS ingredients (
      id TEXT PRIMARY KEY NOT NULL,
      business_id TEXT NOT NULL,
      name TEXT NOT NULL,
      default_unit TEXT NOT NULL DEFAULT 'pcs',
      category TEXT NOT NULL DEFAULT 'General',
      low_stock_threshold REAL NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'local' CHECK (sync_status IN ('local', 'pending', 'synced', 'failed')),
      deleted_at TEXT,
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS ingredient_lots (
      id TEXT PRIMARY KEY NOT NULL,
      business_id TEXT NOT NULL,
      ingredient_id TEXT NOT NULL,
      brand_name TEXT,
      source_name TEXT,
      purchase_date TEXT NOT NULL,
      purchased_quantity REAL NOT NULL DEFAULT 0,
      remaining_quantity REAL NOT NULL DEFAULT 0,
      unit TEXT NOT NULL DEFAULT 'pcs',
      total_cost REAL NOT NULL DEFAULT 0,
      cost_per_unit REAL NOT NULL DEFAULT 0,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'local' CHECK (sync_status IN ('local', 'pending', 'synced', 'failed')),
      deleted_at TEXT,
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
      FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS ingredient_movements (
      id TEXT PRIMARY KEY NOT NULL,
      business_id TEXT NOT NULL,
      ingredient_id TEXT NOT NULL,
      lot_id TEXT,
      movement_type TEXT NOT NULL,
      quantity REAL NOT NULL DEFAULT 0,
      unit TEXT NOT NULL DEFAULT 'pcs',
      unit_cost REAL,
      total_cost REAL,
      reason TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'local' CHECK (sync_status IN ('local', 'pending', 'synced', 'failed')),
      deleted_at TEXT,
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
      FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE,
      FOREIGN KEY (lot_id) REFERENCES ingredient_lots(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_ingredients_business_id ON ingredients(business_id);
    CREATE INDEX IF NOT EXISTS idx_ingredients_name ON ingredients(name);
    CREATE INDEX IF NOT EXISTS idx_ingredient_lots_business_id ON ingredient_lots(business_id);
    CREATE INDEX IF NOT EXISTS idx_ingredient_lots_ingredient_id ON ingredient_lots(ingredient_id);
    CREATE INDEX IF NOT EXISTS idx_ingredient_lots_status ON ingredient_lots(status);
    CREATE INDEX IF NOT EXISTS idx_ingredient_movements_business_id ON ingredient_movements(business_id);
    CREATE INDEX IF NOT EXISTS idx_ingredient_movements_ingredient_id ON ingredient_movements(ingredient_id);
  `,
} as const;
