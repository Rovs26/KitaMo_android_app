export const recipesMigration = {
  id: "005_recipes",
  up: `
    CREATE TABLE IF NOT EXISTS recipes (
      id TEXT PRIMARY KEY NOT NULL,
      business_id TEXT NOT NULL,
      output_product_id TEXT NOT NULL,
      name TEXT NOT NULL,
      output_quantity REAL NOT NULL DEFAULT 1,
      output_unit TEXT NOT NULL DEFAULT 'pcs',
      production_mode TEXT NOT NULL DEFAULT 'prepared_before_selling',
      suggested_selling_price REAL,
      notes TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'local' CHECK (sync_status IN ('local', 'pending', 'synced', 'failed')),
      deleted_at TEXT,
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
      FOREIGN KEY (output_product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS recipe_ingredient_lines (
      id TEXT PRIMARY KEY NOT NULL,
      business_id TEXT NOT NULL,
      recipe_id TEXT NOT NULL,
      ingredient_id TEXT,
      ingredient_lot_id TEXT,
      custom_name TEXT,
      quantity REAL NOT NULL DEFAULT 0,
      unit TEXT NOT NULL DEFAULT 'pcs',
      cost_override REAL,
      cost_per_unit_snapshot REAL,
      line_cost_snapshot REAL NOT NULL DEFAULT 0,
      source_label_snapshot TEXT,
      is_custom INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'local' CHECK (sync_status IN ('local', 'pending', 'synced', 'failed')),
      deleted_at TEXT,
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
      FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
      FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE SET NULL,
      FOREIGN KEY (ingredient_lot_id) REFERENCES ingredient_lots(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_recipes_business_id ON recipes(business_id);
    CREATE INDEX IF NOT EXISTS idx_recipes_output_product_id ON recipes(output_product_id);
    CREATE INDEX IF NOT EXISTS idx_recipe_ingredient_lines_recipe_id ON recipe_ingredient_lines(recipe_id);
    CREATE INDEX IF NOT EXISTS idx_recipe_ingredient_lines_business_id ON recipe_ingredient_lines(business_id);
  `,
} as const;
