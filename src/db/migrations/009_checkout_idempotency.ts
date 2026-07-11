export const checkoutIdempotencyMigration = {
  id: "009_checkout_idempotency",
  up: `
    ALTER TABLE sales ADD COLUMN checkout_token TEXT;

    CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_checkout_token
      ON sales(checkout_token)
      WHERE checkout_token IS NOT NULL AND deleted_at IS NULL;
  `,
} as const;
